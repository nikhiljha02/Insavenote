import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl } from "./api.js";

function ResetNotePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const passwordRef = useRef(null);
  const token = searchParams.get("token") || "";
  const validToken = /^[a-f\d]{64}$/i.test(token);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const returnToNotes = () => navigate("/");

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");

    if (!validToken) {
      setError(
        "This password reset link is invalid. Request a new link from the note.",
      );
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Choose a password between 8 and 128 characters.");
      passwordRef.current?.focus();
      return;
    }
    if (!password.trim()) {
      setError("Password cannot contain only spaces.");
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl("/note/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.message || "Could not reset this note’s password.",
        );
      }

      setSuccess(true);
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      setError(
        requestError.message || "Could not reach the server. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="password-modal-backdrop reset-password-backdrop">
      <section
        className="password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        aria-describedby="reset-password-description"
      >
        <button
          className="password-modal-close"
          type="button"
          onClick={returnToNotes}
          disabled={loading}
          aria-label="Return to notes"
        >
          &times;
        </button>

        <div className="password-modal-icon" aria-hidden="true">
          <i className="fas fa-unlock-alt" />
        </div>
        <p className="password-modal-eyebrow">PRIVATE NOTE</p>
        <h2 id="reset-password-title">
          {success ? "Password reset" : "Reset note password"}
        </h2>
        <p
          className="password-modal-description"
          id="reset-password-description"
        >
          {success
            ? "Your note has a new password. Use it the next time you unlock the note."
            : "Choose a new password for this note, then confirm it below."}
        </p>

        {!validToken ? (
          <div className="password-reset-actions">
            <p className="password-modal-error" role="alert">
              This password reset link is invalid. Request a new link from the
              note.
            </p>
            <button
              className="password-modal-submit"
              type="button"
              onClick={returnToNotes}
            >
              Return to notes
            </button>
          </div>
        ) : success ? (
          <div className="password-reset-actions">
            <p className="password-reset-success" role="status">
              Password reset successfully.
            </p>
            <button
              className="password-modal-submit"
              type="button"
              onClick={returnToNotes}
            >
              Return to notes
            </button>
          </div>
        ) : (
          <form onSubmit={resetPassword}>
            <label
              className="password-field-label"
              htmlFor="reset-note-password"
            >
              New password
            </label>
            <input
              ref={passwordRef}
              id="reset-note-password"
              className="password-field"
              type="password"
              value={password}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => {
                setPassword(event.currentTarget.value);
                setError("");
              }}
              disabled={loading}
              required
            />

            <label
              className="password-field-label"
              htmlFor="confirm-reset-note-password"
            >
              Confirm new password
            </label>
            <input
              id="confirm-reset-note-password"
              className="password-field"
              type="password"
              value={confirmation}
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              onChange={(event) => {
                setConfirmation(event.currentTarget.value);
                setError("");
              }}
              disabled={loading}
              required
            />

            {error && (
              <p className="password-modal-error" role="alert">
                {error}
              </p>
            )}

            <div className="password-modal-actions">
              <button
                className="password-modal-cancel"
                type="button"
                onClick={returnToNotes}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="password-modal-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? "Please wait…" : "Reset password"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default ResetNotePasswordPage;
