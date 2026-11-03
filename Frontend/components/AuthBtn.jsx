import { useEffect, useRef, useState } from "react";
import DarkModeToggle from "./DarKModeToggle";
import { useAuth } from "../src/context/AuthContext.jsx";

function AuthBtn({ onClick }) {
    const { user, userLogged, logout } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [failedAvatarSrc, setFailedAvatarSrc] = useState("");
    const profileRef = useRef(null);
    const triggerRef = useRef(null);
    const avatarSrc = user?.picture || "";
    const avatarFailed = failedAvatarSrc === avatarSrc;

    useEffect(() => {
        if (!profileOpen) return undefined;

        const closeOnOutsideClick = (event) => {
            if (!profileRef.current?.contains(event.target)) {
                setProfileOpen(false);
            }
        };

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setProfileOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [profileOpen]);

    const initials = (user?.name || user?.email || "U")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    const handleLogout = async () => {
        setProfileOpen(false);
        await logout();
    };

    return (
        <div className="auth-buttons">
            {userLogged ? (
                <div className="profile-menu-anchor" ref={profileRef}>
                    <button ref={triggerRef} className="profile-trigger" type="button" aria-label="Open profile menu" aria-haspopup="true" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
                        {avatarSrc && !avatarFailed ? (
                            <img
                                src={avatarSrc}
                                alt=""
                                referrerPolicy="no-referrer"
                                onError={() => setFailedAvatarSrc(avatarSrc)}
                            />
                        ) : (
                            <span aria-hidden="true">{initials}</span>
                        )}
                    </button>

                    {profileOpen && (
                        <div className="profile-menu" aria-label="Profile menu">
                            <div className="profile-menu-user">
                                {avatarSrc && !avatarFailed ? (
                                    <img
                                        className="profile-menu-avatar"
                                        referrerPolicy="no-referrer"
                                        src={avatarSrc}
                                        alt=""
                                        onError={() => setFailedAvatarSrc(avatarSrc)}
                                    />
                                ) : (
                                    <span className="profile-menu-avatar profile-menu-initials" aria-hidden="true">
                                        {initials}
                                    </span>
                                )}
                                <div className="profile-menu-details">
                                    <strong>{user.name || "Your account"}</strong>
                                    {user.email && <span title={user.email}>{user.email}</span>}
                                </div>
                            </div>

                            <div className="profile-menu-divider" />

                            <button className="profile-logout" id="logout" type="button" onClick={handleLogout}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M10 17l5-5-5-5M15 12H3m9-7h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
                                </svg>
                                <span>Log out</span>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="authBtn">
                    <button className="login-btn" id="login" type="button" onClick={onClick}>
                        Login
                    </button>
                </div>
            )}

            <DarkModeToggle />
        </div>
    );
}

export default AuthBtn;
