import { createContext, useContext, useState } from "react";
import { apiUrl } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (userDetails) => {
    setUser(userDetails);
  };

  const logout = async () => {
    try {
      const response = await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);

      alert("Unable to logout. Please try again.");
    }
  };

  const value = {
    user,
    userLogged: Boolean(user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
