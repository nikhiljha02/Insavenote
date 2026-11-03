import { Router } from "express";
import bcrypt from "bcrypt";
import { noteSchema } from "../middleware/zodLayer.js";
import { query } from "../database/db.js";
import { decryptNote, encryptNote } from "../database/noteCrypto.js";
import authenticateToken from "../middleware/authCheck.js";

const router = Router();
const paperColors = Array.from({ length: 10 }, (_, index) => `paper-${index + 1}`);

function randomPaperColor() {
  return paperColors[Math.floor(Math.random() * paperColors.length)];
}

function isValidNoteId(noteId) {
  return /^\d+$/.test(String(noteId)) && Number.isSafeInteger(Number(noteId)) && Number(noteId) > 0;
}

router.post("/entry", authenticateToken, async (req, res) => {
  try {
    const result = noteSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error.flatten());

    const { rows } = await query(
      `INSERT INTO notes ("userId", note, note_encrypted, label, color)
       SELECT COALESCE("googleId", id::text), $2, true, $3, $4
       FROM users
       WHERE id = $1
       RETURNING id, note, label, color, locked`,
      [
        req.user,
        encryptNote(result.data.note.trim()),
        result.data.label || "General",
        result.data.color || randomPaperColor(),
      ],
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });

    return res.status(201).json({
      message: "Note added successfully",
      notesId: rows[0].id,
      data: { ...rows[0], note: decryptNote(rows[0].note) },
    });
  } catch (error) {
    console.error("Entry note error:", error.message);
    return res.status(500).json({ message: "Failed to add note" });
  }
});

router.delete("/delete", authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.body;
    if (!isValidNoteId(noteId)) {
      return res.status(400).json({ message: "A valid note ID is required" });
    }

    const { rows } = await query(
      `DELETE FROM notes AS n
       USING users AS u
       WHERE n.id = $1
         AND u.id = $2
         AND n."userId" = COALESCE(u."googleId", u.id::text)
       RETURNING n.id`,
      [Number(noteId), req.user],
    );
    if (!rows[0]) return res.status(404).json({ message: "Note not found" });
    return res.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Delete note error:", error.message);
    return res.status(500).json({ message: "Failed to delete note" });
  }
});

router.patch("/edit", authenticateToken, async (req, res) => {
  try {
    const result = noteSchema.safeParse(req.body);
    const { noteId } = req.body;
    if (!result.success) return res.status(400).json(result.error.flatten());
    if (!isValidNoteId(noteId)) {
      return res.status(400).json({ message: "A valid note ID is required" });
    }

    const { rows } = await query(
      `UPDATE notes AS n
       SET note = $1, note_encrypted = true, label = $2
       FROM users AS u
       WHERE n.id = $3
         AND u.id = $4
         AND n."userId" = COALESCE(u."googleId", u.id::text)
       RETURNING n.id, n.note, n.label, n.color, n.locked`,
      [encryptNote(result.data.note.trim()), result.data.label || "General", Number(noteId), req.user],
    );
    if (!rows[0]) return res.status(404).json({ message: "Note not found" });
    return res.json({
      message: "Note updated successfully",
      data: { ...rows[0], note: decryptNote(rows[0].note) },
    });
  } catch (error) {
    console.error("Edit note error:", error.message);
    return res.status(500).json({ message: "Failed to update note" });
  }
});

router.get("/notes", authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT n.id, CASE WHEN n.locked THEN '' ELSE n.note END AS note,
              COALESCE(NULLIF(BTRIM(n.label), ''), 'General') AS label, n.color, n.locked
       FROM notes AS n
       JOIN users AS u
         ON u.id = $1
        AND n."userId" = COALESCE(u."googleId", u.id::text)
       ORDER BY n.id DESC`,
      [req.user],
    );
    return res.json({
      allNotes: rows.map((item) => ({
        note: item.locked ? "" : decryptNote(item.note),
        noteId: item.id,
        label: item.label || "General",
        color: item.color,
        locked: item.locked,
      })),
    });
  } catch (error) {
    console.error("Get notes error:", error.message);
    return res.status(500).json({ message: "Failed to fetch notes" });
  }
});

router.post("/lock", authenticateToken, async (req, res) => {
  try {
    const { noteId, password } = req.body;
    if (!isValidNoteId(noteId) || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Note ID and password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `UPDATE notes AS n
       SET locked = true, password = $1
       FROM users AS u
       WHERE n.id = $2
         AND u.id = $3
         AND n."userId" = COALESCE(u."googleId", u.id::text)
       RETURNING n.id, n.locked`,
      [passwordHash, Number(noteId), req.user],
    );
    if (!rows[0]) return res.status(404).json({ message: "Note not found" });
    return res.status(200).json({ message: "Note locked successfully", data: rows[0] });
  } catch (error) {
    console.error("Lock note error:", error.message);
    return res.status(500).json({ message: "Failed to lock note" });
  }
});

router.post("/unlock", authenticateToken, async (req, res) => {
  try {
    const { noteId, password } = req.body;
    if (!isValidNoteId(noteId) || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Note ID and password are required" });
    }

    const { rows } = await query(
      `SELECT n.id, n.note, n.locked, n.password
       FROM notes AS n
       JOIN users AS u
         ON u.id = $1
        AND n."userId" = COALESCE(u."googleId", u.id::text)
       WHERE n.id = $2
       LIMIT 1`,
      [req.user, Number(noteId)],
    );
    const note = rows[0];
    if (!note) return res.status(404).json({ message: "Note not found" });

    const passwordMatches = note.password && await bcrypt.compare(password, note.password);
    if (!passwordMatches) return res.status(401).json({ message: "Wrong password. Try again." });
    return res.status(200).json({
      message: "Note unlocked successfully",
      data: [{ id: note.id, note: decryptNote(note.note) }],
    });
  } catch (error) {
    console.error("Unlock note error:", error.message);
    return res.status(500).json({ message: "Failed to unlock note" });
  }
});

export default router;
