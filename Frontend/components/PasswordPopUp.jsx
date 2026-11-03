import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "../src/api.js";

function PasswordPopUp({ mode, intent = mode, noteId, onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const isLocking = mode === "lock";
  const isDeleting = intent === "delete";

  useEffect(() => {
    passwordRef.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [loading, onClose]);

  const submitPassword = async (event) => {
    event.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Enter a password to continue.");
      passwordRef.current?.focus();
      return;
    }
    if (isLocking && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/note/${mode}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ noteId, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `Could not ${mode} this note.`);
      }

      await onSuccess(data);
    } catch (requestError) {
      setError(requestError.message || "Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="password-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        className="password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        aria-describedby="password-modal-description"
      >
        <button
          className="password-modal-close"
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close password dialog"
        >
          &times;
        </button>

        <div className="password-modal-icon" aria-hidden="true">
          <i className={`fas ${isLocking ? "fa-lock" : "fa-unlock-alt"}`} />
        </div>
        <p className="password-modal-eyebrow">PRIVATE NOTE</p>
        <h2 id="password-modal-title">
          {isLocking ? "Lock this note" : isDeleting ? "Unlock to delete" : "Unlock your note"}
        </h2>
        <p className="password-modal-description" id="password-modal-description">
          {isLocking
            ? "Choose a password to keep this note private."
            : isDeleting
              ? "Enter this note’s password to confirm deletion."
              : "Enter the password you used to protect this note."}
        </p>

        <form onSubmit={submitPassword}>
          <label className="password-field-label" htmlFor="note-password">
            Password
          </label>
          <input
            ref={passwordRef}
            id="note-password"
            className="password-field"
            type="password"
            value={password}
            autoComplete={isLocking ? "new-password" : "current-password"}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setError("");
            }}
            disabled={loading}
            required
          />

          {isLocking && (
            <>
              <label className="password-field-label" htmlFor="note-password-confirm">
                Confirm password
              </label>
              <input
                id="note-password-confirm"
                className="password-field"
                type="password"
                value={confirmation}
                autoComplete="new-password"
                onChange={(event) => {
                  setConfirmation(event.currentTarget.value);
                  setError("");
                }}
                disabled={loading}
                required
              />
            </>
          )}

          {error && (
            <p className="password-modal-error" role="alert">
              {error}
            </p>
          )}

          <div className="password-modal-actions">
            <button
              className="password-modal-cancel"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button className="password-modal-submit" type="submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : isLocking
                  ? "Lock note"
                  : isDeleting
                    ? "Unlock and delete"
                    : "Unlock note"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export default PasswordPopUp;
