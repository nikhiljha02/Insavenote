import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Route, Routes, useLocation } from "react-router-dom";

import AuthBtn from "../components/AuthBtn.jsx";
import NoteBtn from "../components/NoteBtn.jsx";
import "./App.css";
import { useAuth } from "./context/AuthContext.jsx";
import NotesSkeleton from "../components/NotesSkeleton.jsx";
import { apiUrl } from "./api.js";
import ResetNotePasswordPage from "./ResetNotePasswordPage.jsx";
import MaintenancePage from "../components/MaintenancePage.jsx";

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialNotes, setInitialNotes] = useState(null);

  const { login } = useAuth();
  const location = useLocation();

  // Restore the existing backend session.
  useEffect(() => {
    let cancelled = false;

    if (window.location.pathname === "/maintenance") {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const checkAuth = async () => {
      try {
        const [response, notesResponse] = await Promise.all([
          fetch(apiUrl("/api/auth/getMe"), {
            method: "GET",
            credentials: "include",
          }),
          fetch(apiUrl("/note/notes"), {
            method: "GET",
            credentials: "include",
          }).catch((err) => {
            console.error("Initial notes request failed:", err);
            return null;
          }),
        ]);

        if (!response.ok) {
          return;
        }

        const [data, notesData] = await Promise.all([
          response.json(),
          notesResponse?.ok ? notesResponse.json().catch(() => null) : null,
        ]);

        if (cancelled) return;

        // if (data.loggedIn) {
        const currentUser = {
          email: data.clientUser.email?.trim(),
          name: data.clientUser.name,
          picture: data.clientUser.picture,
        };

        login(currentUser);
        setInitialNotes(
          Array.isArray(notesData?.allNotes)
            ? { userKey: currentUser.email, allNotes: notesData.allNotes }
            : null,
        );
        setShowAuth(false);
        // }
      } catch (err) {
        console.error("Authentication check failed:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Send Google's ID token to your Express backend.
  async function handleGoogleSuccess(response) {
    setError("");

    try {
      const res = await fetch(apiUrl("/api/auth/google"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Google login failed");
      }

      const currentUser = {
        email: data.user.email?.trim(),
        name: data.user.name,
        picture: data.user.picture,
      };

      // Update local state and your existing Context API.
      login(currentUser);

      setShowAuth(false);
    } catch (err) {
      setError(err.message || "Google login failed");
    }
  }

  if (loading && location.pathname !== "/maintenance") {
    return (
      <main style={{ padding: 40 }}>
        <NotesSkeleton />
      </main>
    );
  }

  if (
    import.meta.env.VITE_MAINTENANCE_MODE === "true" &&
    location.pathname !== "/maintenance"
  ) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      <Route path="/reset-note-password" element={<ResetNotePasswordPage />} />
      <Route
        path="*"
        element={
          <>
            <div className="heading">
              <h1 className="brand-heading">
                <img
                  className="app-logo"
                  src="/assets/insavenote-high-resolution-logo.png"
                  alt="InSaveNote"
                />
              </h1>
              <div className="userDetailAuth">
                <AuthBtn
                  onClick={() => {
                    setShowAuth(true);
                    setError("");
                  }}
                />
              </div>
            </div>

            {showAuth && (
              <div className="auth-overlay active">
                <div className="auth-popup">
                  <button
                    className="close-auth"
                    onClick={() => {
                      setShowAuth(false);
                      setError("");
                    }}
                  >
                    &times;
                  </button>

                  <img
                    className="auth-popup-logo"
                    src="/assets/insavenote-high-resolution-logo.png"
                    alt="InSaveNote"
                  />
                  <h2>Sign in to your account</h2>
                  <div className="google-login">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google sign-in failed.")}
                    />
                  </div>

                  {error && (
                    <p role="alert" className="auth-error">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            )}

            <NoteBtn initialNotes={initialNotes} />
          </>
        }
      />
    </Routes>
  );
}

export default App;
