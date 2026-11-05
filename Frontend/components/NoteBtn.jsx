import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MsgPopUp from "./MsgPopUp.jsx";
import PasswordPopUp from "./PasswordPopUp.jsx";
import { apiUrl } from "../src/api.js";
import { useAuth } from "../src/context/AuthContext.jsx";

const paperColors = Array.from(
  { length: 10 },
  (_, index) => `paper-${index + 1}`,
);

function randomPaperColor() {
  return paperColors[Math.floor(Math.random() * paperColors.length)];
}

function normalizePaperColor(color, fallback = "paper-1") {
  return paperColors.includes(color) ? color : fallback;
}

function NoteBtn() {
  const { user, userLogged } = useAuth();
  const userKey = user?.email || null;
  const [noteState, setNoteState] = useState({ userKey: null, items: [] });
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const toastId = useRef(0);
  const draftSequence = useRef(0);
  const notes =
    userLogged && noteState.userKey === userKey ? noteState.items : [];
  const loading = Boolean(
    userLogged && userKey && noteState.userKey !== userKey,
  );

  const availableLabels = Array.from(
    new Map(
      notes.map((note) => {
        const label = String(note.label || "General").trim() || "General";
        return [label.toLocaleLowerCase(), label];
      }),
    ).values(),
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const visibleNotes = notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => {
      const matchesLabel =
        !labelFilter ||
        note.label.toLocaleLowerCase() === labelFilter.toLocaleLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        note.label.toLocaleLowerCase().includes(normalizedSearch) ||
        note.note.toLocaleLowerCase().includes(normalizedSearch);
      return matchesLabel && matchesSearch;
    })
    .sort((left, right) => {
      if (sortOrder === "oldest") return right.index - left.index;
      if (sortOrder === "label-asc" || sortOrder === "label-desc") {
        const labelOrder = left.note.label.localeCompare(
          right.note.label,
          undefined,
          { sensitivity: "base" },
        );
        return (
          (sortOrder === "label-desc" ? -labelOrder : labelOrder) ||
          left.index - right.index
        );
      }
      return left.index - right.index;
    })
    .map(({ note }) => note);

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
    if (!userLogged || !userKey) return undefined;

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
            items: (data.allNotes || []).map((item) => ({
              clientId: String(item.noteId),
              noteId: item.noteId,
              note: item.note || "",
              label: String(item.label || "General").trim() || "General",
              color: normalizePaperColor(item.color, randomPaperColor()),
              locked: Boolean(item.locked),
              isDraft: false,
            })),
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
  }, [userKey, userLogged, showMessage]);

  const createNote = useCallback(() => {
    if (!userLogged) {
      showMessage("Sign in with Google to create notes.", "error");
      return;
    }

    setSearchTerm("");
    setLabelFilter("");
    setSortOrder("newest");

    const clientId = `draft-${Date.now()}-${++draftSequence.current}`;
    const color = randomPaperColor();
    updateNotes((current) => [
      {
        clientId,
        noteId: null,
        note: "",
        label: "Enter Label",
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
      const response = await fetch(
        apiUrl(`/note/${isNew ? "entry" : "edit"}`),
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            note: text,
            label,
            color: note.color,
            ...(!isNew && { noteId: note.noteId }),
          }),
        },
      );
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

      updateNotes((current) =>
        current.filter((item) => item.clientId !== note.clientId),
      );
    },
    [showMessage, updateNotes],
  );

  const updateNote = useCallback(
    (updatedNote) => {
      updateNotes((current) =>
        current.map((item) =>
          item.clientId === updatedNote.clientId ? updatedNote : item,
        ),
      );
    },
    [updateNotes],
  );

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

      {userLogged && notes.length > 0 && (
        <section className="notes-toolbar" aria-label="Find and organize notes">
          <label className="notes-search-field">
            <span>Search notes</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
              placeholder="Search text or labels"
            />
          </label>
          <label className="notes-filter-field">
            <span>Label</span>
            <select
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.currentTarget.value)}
            >
              <option value="">All labels</option>
              {availableLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-sort-field">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.currentTarget.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="label-asc">Label A–Z</option>
              <option value="label-desc">Label Z–A</option>
            </select>
          </label>
          <p className="notes-result-count" aria-live="polite">
            Showing {visibleNotes.length} of {notes.length}{" "}
            {notes.length === 1 ? "note" : "notes"}
          </p>
        </section>
      )}

      <main
        className="notes-container"
        aria-label="Your notes"
        aria-busy={loading}
      >
        {loading && <p className="notes-loading">Loading your notes…</p>}
        {visibleNotes.map((note) => (
          <NoteCard
            key={note.clientId}
            note={note}
            onSave={saveNote}
            onDelete={deleteNote}
            onUpdate={updateNote}
            showMessage={showMessage}
          />
        ))}
        {!loading && notes.length > 0 && visibleNotes.length === 0 && (
          <p className="notes-empty-filtered">
            No notes match your search or filters.
          </p>
        )}
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
  const [saveStatus, setSaveStatus] = useState(
    note.isDraft ? "unsaved" : "saved",
  );
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
  const hasUnsavedChanges =
    editing &&
    (note.isDraft ||
      draft.trim() !== visibleText ||
      label !== (note.label || "General"));

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
    setSaveStatus("saved");
    setEditing(true);
  };

  const cancelEditing = () => {
    if (note.isDraft) {
      onDelete(note).catch((error) => showMessage(error.message, "error"));
      return;
    }
    setDraft(visibleText);
    setLabelDraft(note.label || "General");
    setSaveStatus("saved");
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
    setSaveStatus("saving");
    try {
      await onSave(note, text, label);
      setUnlockedText(text);
      setLabelDraft(label);
      setEditing(false);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
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
    showMessage(
      data.message ||
        (passwordMode === "lock" ? "Note locked." : "Note unlocked."),
    );
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
          <i
            className={`fas ${expanded ? "fa-compress" : "fa-expand"}`}
            aria-hidden="true"
          />
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
              <i
                className={`fas ${busy ? "fa-spinner fa-spin" : "fa-check"}`}
                aria-hidden="true"
              />
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
          <i
            className={`fas ${busy ? "fa-spinner fa-spin" : "fa-trash-alt"}`}
            aria-hidden="true"
          />
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
            onChange={(event) => {
              setLabelDraft(event.currentTarget.value);
              setSaveStatus("saved");
            }}
            disabled={busy}
          />
        </div>
      ) : (
        <span className="note-label-tag" title={label}>
          {label}
        </span>
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
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setSaveStatus("saved");
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                save();
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

      <span
        className={`note-save-status note-save-status-${busy ? "saving" : hasUnsavedChanges ? "unsaved" : saveStatus}`}
      >
        {busy || saveStatus === "saving"
          ? "Saving…"
          : saveStatus === "error"
            ? "Save failed"
            : hasUnsavedChanges
              ? "Unsaved changes"
              : "Saved"}
      </span>

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
