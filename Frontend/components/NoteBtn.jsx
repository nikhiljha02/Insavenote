import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MsgPopUp from "./MsgPopUp.jsx";
import PasswordPopUp from "./PasswordPopUp.jsx";
import { apiUrl } from "../src/api.js";
import { useAuth } from "../src/context/AuthContext.jsx";

const paperColors = Array.from({ length: 10 }, (_, index) => `paper-${index + 1}`);

function randomPaperColor() {
  return paperColors[Math.floor(Math.random() * paperColors.length)];
}

function normalizePaperColor(color, fallback = "paper-1") {
  return paperColors.includes(color) ? color : fallback;
}

function normalizeNotes(allNotes) {
  return (allNotes || []).map((item) => ({
    clientId: String(item.noteId),
    noteId: item.noteId,
    note: item.note || "",
    label: String(item.label || "General").trim() || "General",
    color: normalizePaperColor(item.color, randomPaperColor()),
    locked: Boolean(item.locked),
    isDraft: false,
  }));
}

function NoteBtn({ initialNotes = null }) {
  const { user, userLogged } = useAuth();
  const userKey = user?.email || null;
  const [noteState, setNoteState] = useState(() =>
    initialNotes
      ? { userKey: initialNotes.userKey, items: normalizeNotes(initialNotes.allNotes) }
      : { userKey: null, items: [] },
  );
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);
  const draftSequence = useRef(0);
  const notes = userLogged && noteState.userKey === userKey ? noteState.items : [];
  const loading = Boolean(userLogged && userKey && noteState.userKey !== userKey);

  const showMessage = useCallback((message, type = "success") => {
    setToast({ id: ++toastId.current, message, type });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  const updateNotes = useCallback(
    (update) => {
      setNoteState((current) => {
        const currentNotes = current.userKey === userKey ? current.items : [];
        return { userKey, items: update(currentNotes) };
      });
    },
    [userKey],
  );

  useEffect(() => {
    if (!userLogged || !userKey) {
      setNoteState((current) =>
        current.userKey === null ? current : { userKey: null, items: [] },
      );
      return undefined;
    }

    if (noteState.userKey === userKey) return undefined;

    let active = true;

    const loadNotes = async () => {
      try {
        const response = await fetch(apiUrl("/note/notes"), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Could not load your notes.");
        }

        if (active) {
          setNoteState({
            userKey,
            items: normalizeNotes(data.allNotes),
          });
        }
      } catch (error) {
        if (active) {
          setNoteState({ userKey, items: [] });
          showMessage(error.message || "Could not load your notes.", "error");
        }
      }
    };

    loadNotes();
    return () => {
      active = false;
    };
  }, [userKey, userLogged, showMessage, noteState.userKey]);

  const createNote = useCallback(() => {
    if (!userLogged) {
      showMessage("Sign in with Google to create notes.", "error");
      return;
    }

    const clientId = `draft-${Date.now()}-${++draftSequence.current}`;
    const color = randomPaperColor();
    updateNotes((current) => [
      {
        clientId,
        noteId: null,
        note: "",
        label: "General",
        color,
        locked: false,
        isDraft: true,
      },
      ...current,
    ]);
  }, [showMessage, updateNotes, userLogged]);

  const saveNote = useCallback(
    async (note, text, label) => {
      const isNew = !note.noteId;
      const response = await fetch(apiUrl(`/note/${isNew ? "entry" : "edit"}`), {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          note: text,
          label,
          color: note.color,
          ...(!isNew && { noteId: note.noteId }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not save this note.");
      }

      const savedNoteId = data.notesId || data.data?.id || note.noteId;
      updateNotes((current) =>
        current.map((item) =>
          item.clientId === note.clientId
            ? {
                ...item,
                noteId: savedNoteId,
                note: data.data?.note ?? text,
                label: String(data.data?.label || label).trim() || "General",
                color: normalizePaperColor(data.data?.color, item.color),
                locked: Boolean(data.data?.locked ?? item.locked),
                isDraft: false,
              }
            : item,
        ),
      );
      showMessage(data.message || "Note saved.");
    },
    [showMessage, updateNotes],
  );

  const deleteNote = useCallback(
    async (note) => {
      if (note.noteId) {
        const response = await fetch(apiUrl("/note/delete"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ noteId: note.noteId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Could not delete this note.");
        }
        showMessage(data.message || "Note deleted.");
      }

      updateNotes((current) => current.filter((item) => item.clientId !== note.clientId));
    },
    [showMessage, updateNotes],
  );

  const updateNote = useCallback((updatedNote) => {
    updateNotes((current) =>
      current.map((item) => (item.clientId === updatedNote.clientId ? updatedNote : item)),
    );
  }, [updateNotes]);

  return (
    <>
      <div className="btn-div">
        <button className="learn-more add" type="button" onClick={createNote}>
          <span className="circle" aria-hidden="true">
            <span className="icon arrow" />
          </span>
          <span className="button-text">Add note</span>
        </button>
      </div>

      <main className="notes-container" aria-label="Your notes" aria-busy={loading}>
        {loading && <p className="notes-loading">Loading your notes…</p>}
        {notes.map((note) => (
          <NoteCard
            key={note.clientId}
            note={note}
            onSave={saveNote}
            onDelete={deleteNote}
            onUpdate={updateNote}
            showMessage={showMessage}
          />
        ))}
      </main>
      <MsgPopUp toast={toast} onClose={closeToast} />
    </>
  );
}

function NoteCard({ note, onSave, onDelete, onUpdate, showMessage }) {
  const [editing, setEditing] = useState(note.isDraft);
  const [draft, setDraft] = useState(note.note);
  const [labelDraft, setLabelDraft] = useState(note.label || "General");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [passwordMode, setPasswordMode] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockedText, setUnlockedText] = useState(note.note);
  const editorRef = useRef(null);
  const closeDialogRef = useRef(null);
  const isProtected = note.locked && !unlocked;
  const visibleText = note.locked ? unlockedText : note.note;
  const label = labelDraft.trim() || "General";
  const noteColor = `var(--${normalizePaperColor(note.color)})`;

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing, expanded]);

  useEffect(() => {
    if (expanded && !editing) closeDialogRef.current?.focus();
  }, [expanded, editing]);

  useEffect(() => {
    if (!expanded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !passwordMode) setExpanded(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [expanded, passwordMode]);

  const startEditing = () => {
    setDraft(visibleText);
    setLabelDraft(note.label || "General");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (note.isDraft) {
      onDelete(note).catch((error) => showMessage(error.message, "error"));
      return;
    }
    setDraft(visibleText);
    setLabelDraft(note.label || "General");
    setEditing(false);
  };

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      showMessage("A note cannot be empty.", "error");
      editorRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      await onSave(note, text, label);
      setUnlockedText(text);
      setLabelDraft(label);
      setEditing(false);
    } catch (error) {
      showMessage(error.message || "Could not save this note.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (note.locked && !unlocked) {
      setPasswordMode("delete");
      return;
    }

    setBusy(true);
    try {
      await onDelete(note);
    } catch (error) {
      showMessage(error.message || "Could not delete this note.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSuccess = async (data) => {
    if (passwordMode === "delete") {
      setBusy(true);
      try {
        await onDelete(note);
      } catch (error) {
        setPasswordMode(null);
        showMessage(error.message || "Could not delete this note.", "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (passwordMode === "lock") {
      onUpdate({ ...note, locked: true });
      setUnlocked(false);
    } else {
      const unlockedNote = data.data?.[0]?.note ?? note.note;
      setUnlockedText(unlockedNote);
      setUnlocked(true);
    }

    setPasswordMode(null);
    showMessage(data.message || (passwordMode === "lock" ? "Note locked." : "Note unlocked."));
  };

  const noteCard = (
    <article
      className={`note${expanded ? " expanded" : ""}`}
      style={{ "--paper": noteColor, "--label-accent": noteColor }}
    >
      <div className="operation" aria-label="Note actions">
        <button
          type="button"
          className="expand"
          title={expanded ? "Collapse note" : "Expand note"}
          aria-label={expanded ? "Collapse note" : "Expand note"}
          onClick={() => setExpanded((value) => !value)}
        >
          <i className={`fas ${expanded ? "fa-compress" : "fa-expand"}`} aria-hidden="true" />
        </button>

        {editing ? (
          <>
            <button
              type="button"
              className="save_note"
              title="Save note"
              aria-label="Save note"
              onClick={save}
              disabled={busy}
            >
              <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-check"}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cancel_note"
              title="Cancel editing"
              aria-label="Cancel editing"
              onClick={cancelEditing}
              disabled={busy}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </>
        ) : (
          !isProtected && (
            <button
              type="button"
              className="edit_note"
              title="Edit note"
              aria-label="Edit note"
              onClick={startEditing}
            >
              <i className="fas fa-edit" aria-hidden="true" />
            </button>
          )
        )}

        {!note.isDraft && !note.locked && !editing && (
          <button
            type="button"
            className="lock-note"
            title="Lock note"
            aria-label="Lock note"
            onClick={() => setPasswordMode("lock")}
          >
            <i className="fas fa-lock" aria-hidden="true" />
          </button>
        )}
        {note.locked && unlocked && !editing && (
          <button
            type="button"
            className="lock-note"
            title="Hide note"
            aria-label="Hide note"
            onClick={() => setUnlocked(false)}
          >
            <i className="fas fa-lock" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="delete"
          title="Delete note"
          aria-label="Delete note"
          onClick={remove}
          disabled={busy}
        >
          <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-trash-alt"}`} aria-hidden="true" />
        </button>
      </div>

      {editing ? (
        <div className="note-label-editor">
          <label htmlFor={`note-label-${note.clientId}`}>Label</label>
          <input
            id={`note-label-${note.clientId}`}
            type="text"
            value={labelDraft}
            maxLength={24}
            placeholder="e.g. Work or Personal"
            onChange={(event) => setLabelDraft(event.currentTarget.value)}
            disabled={busy}
          />
        </div>
      ) : (
        <span className="note-label-tag" title={label}>{label}</span>
      )}

      {isProtected ? (
        <div className="note-locked-content">
          <span className="note-locked-icon" aria-hidden="true">
            <i className="fas fa-lock" />
          </span>
          <span>Private note</span>
          <button type="button" onClick={() => setPasswordMode("unlock")}>
            Enter password
          </button>
        </div>
      ) : editing ? (
        <>
          <textarea
            ref={editorRef}
            className="note-editor"
            value={draft}
            maxLength={5000}
            placeholder="Write something worth remembering…"
            aria-label="Note text"
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") save();
              if (event.key === "Escape") {
                event.stopPropagation();
                cancelEditing();
              }
            }}
            disabled={busy}
          />
          <span className="note-character-count">{draft.length}/5000</span>
        </>
      ) : (
        <div className="note-content">{visibleText}</div>
      )}

      {passwordMode && (
        <PasswordPopUp
          mode={passwordMode === "delete" ? "unlock" : passwordMode}
          intent={passwordMode}
          noteId={note.noteId}
          onClose={() => setPasswordMode(null)}
          onSuccess={handlePasswordSuccess}
        />
      )}
    </article>
  );

  if (!expanded) return noteCard;

  return createPortal(
    <>
      <div
        className="note-expand-backdrop"
        aria-hidden="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !passwordMode) {
            setExpanded(false);
          }
        }}
      />
      <section
        className="note-expand-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Expanded ${label} note`}
      >
        <button
          ref={closeDialogRef}
          className="note-expand-close"
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close expanded note"
          title="Close expanded note"
        >
          &times;
        </button>
        {noteCard}
      </section>
    </>,
    document.body,
  );
}

export default NoteBtn;
