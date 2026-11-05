import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { noteSchema } from "../middleware/zodLayer.js";
import { query } from "../database/db.js";
import { decryptNote, encryptNote } from "../database/noteCrypto.js";
import authenticateToken from "../middleware/authCheck.js";
import { Resend } from "resend";
const resend = new Resend(process.env.SMTP_PASS);

const router = Router();
const newNotePasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((password) => password.trim().length > 0);
const paperColors = Array.from(
  { length: 10 },
  (_, index) => `paper-${index + 1}`,
);

function randomPaperColor() {
  return paperColors[Math.floor(Math.random() * paperColors.length)];
}

function isValidNoteId(noteId) {
  return (
    /^\d+$/.test(String(noteId)) &&
    Number.isSafeInteger(Number(noteId)) &&
    Number(noteId) > 0
  );
}

router.post("/entry", authenticateToken, async (req, res) => {
  try {
    const result = noteSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error.flatten());
    const { rows } = await query(
      `INSERT INTO notes ("userId", note, note_encrypted, label, color)
       SELECT id, $2, true, $3, $4
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
       WHERE n.id = $1
         AND n."userId" = $2
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
       WHERE n.id = $3
         AND n."userId" = $4
       RETURNING n.id, n.note, n.label, n.color, n.locked`,
      [
        encryptNote(result.data.note.trim()),
        result.data.label || "General",
        Number(noteId),
        req.user,
      ],
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
       WHERE n."userId" = $1
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
    if (!isValidNoteId(noteId)) {
      return res.status(400).json({ message: "A valid note ID is required" });
    }
    const passwordResult = newNotePasswordSchema.safeParse(password);
    if (!passwordResult.success) {
      return res.status(400).json({
        message:
          "Password must be 8 to 128 characters and cannot contain only spaces",
      });
    }

    const passwordHash = await bcrypt.hash(passwordResult.data, 12);
    const { rows } = await query(
      `UPDATE notes AS n
       SET locked = true, password = $1
       WHERE n.id = $2
         AND n."userId" = $3
       RETURNING n.id, n.locked`,
      [passwordHash, Number(noteId), req.user],
    );
    if (!rows[0]) return res.status(404).json({ message: "Note not found" });
    return res
      .status(200)
      .json({ message: "Note locked successfully", data: rows[0] });
  } catch (error) {
    console.error("Lock note error:", error.message);
    return res.status(500).json({ message: "Failed to lock note" });
  }
});

router.post("/unlock", authenticateToken, async (req, res) => {
  try {
    const { noteId, password } = req.body;
    if (
      !isValidNoteId(noteId) ||
      typeof password !== "string" ||
      !password.trim()
    ) {
      return res
        .status(400)
        .json({ message: "Note ID and password are required" });
    }

    const { rows } = await query(
      `SELECT n.id, n.note, n.locked, n.password
       FROM notes AS n
       WHERE n."userId" = $1
         AND n.id = $2
       LIMIT 1`,
      [req.user, Number(noteId)],
    );
    const note = rows[0];
    if (!note) return res.status(404).json({ message: "Note not found" });

    const passwordMatches =
      note.password && (await bcrypt.compare(password, note.password));
    if (!passwordMatches)
      return res.status(401).json({ message: "Wrong password. Try again." });
    return res.status(200).json({
      message: "Note unlocked successfully",
      data: [{ id: note.id, note: decryptNote(note.note) }],
    });
  } catch (error) {
    console.error("Unlock note error:", error.message);
    return res.status(500).json({ message: "Failed to unlock note" });
  }
});

router.post("/forget-password", authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.body;
    if (!isValidNoteId(noteId)) {
      return res.status(400).json({ message: "A valid note ID is required" });
    }

    const userDbId = req.user;
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const emailResult = await query(`SELECT email FROM users WHERE id = $1`, [
      userDbId,
    ]);
    if (!emailResult.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    const userEmail = emailResult.rows[0].email;

    const { rows } = await query(
      `INSERT INTO note_password_reset_tokens
       (user_id, note_id, token_hash, expires_at)
       SELECT u.id, n.id, $3, NOW() + INTERVAL '5 minutes'
       FROM users AS u
       JOIN notes AS n ON n."userId" = u.id
       WHERE u.id = $1 AND n.id = $2
       RETURNING id`,
      [userDbId, Number(noteId), tokenHash],
    );
    if (!rows[0]) return res.status(404).json({ message: "Note not found" });

    const frontendUrl =
      process.env.FRONTEND_LIVE_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173";
    const resetLink = new URL(
      `/reset-note-password?token=${token}`,
      frontendUrl,
    ).toString();

    const { data, error } = await resend.emails.send({
      from: process.env.SMTP_FROM || "noreply@insavenote.nikhiljha.in",
      to: userEmail,
      template: {
        id: "password-reset",
        variables: {
          RESET_LINK: resetLink,
          YEAR: new Date().getFullYear().toString(),
        },
      },
    });
    if (error) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.json({
      message: "If the account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== "string" || !/^[a-f\d]{64}$/i.test(token)) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const passwordResult = newNotePasswordSchema.safeParse(password);
    if (!passwordResult.success) {
      return res.status(400).json({
        message:
          "Password must be 8 to 128 characters and cannot contain only spaces",
      });
    }

    const hashedPassword = await bcrypt.hash(passwordResult.data, 12);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { rows } = await query(
      `WITH matched_token AS (
         SELECT id, note_id, user_id
         FROM note_password_reset_tokens
         WHERE token_hash = $2
           AND used = FALSE
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE
       ), updated_note AS (
         UPDATE notes AS n
         SET password = $1, locked = TRUE
         FROM matched_token AS t
         WHERE n.id = t.note_id
           AND n."userId" = t.user_id
         RETURNING n.id
       ), marked_token AS (
         UPDATE note_password_reset_tokens AS t
         SET used = TRUE
         FROM matched_token AS mt
         WHERE t.id = mt.id
           AND EXISTS (SELECT 1 FROM updated_note)
         RETURNING t.id
       )
       SELECT id FROM marked_token`,
      [hashedPassword, tokenHash],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset note password error:", error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
