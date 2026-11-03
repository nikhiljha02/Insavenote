import { useEffect } from "react";
import { createPortal } from "react-dom";

function MsgPopUp({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast, onClose]);

  if (!toast) return null;

  return createPortal(
    <div
      className={`message-popup message-popup--${toast.type || "success"}`}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <span className="message-popup-icon" aria-hidden="true">
        {toast.type === "error" ? "!" : "✓"}
      </span>
      <p>{toast.message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss message">
        &times;
      </button>
    </div>,
    document.body,
  );
}

export default MsgPopUp;
