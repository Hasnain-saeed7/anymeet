import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("meetclone_token"));
  const [loading, setLoading] = useState(true);

  // On first app load, if a token is already stored, verify it's still valid
  // by asking the backend's /auth/me route, and restore the user session.
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem("meetclone_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
        setToken(storedToken);
      } catch {
        localStorage.removeItem("meetclone_token");
        localStorage.removeItem("meetclone_user");
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  function persistSession(data) {
    localStorage.setItem("meetclone_token", data.token);
    localStorage.setItem("meetclone_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function signup(name, email, password) {
    const res = await api.post("/auth/signup", { name, email, password });
    persistSession(res.data);
    return res.data.user;
  }

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    persistSession(res.data);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem("meetclone_token");
    localStorage.removeItem("meetclone_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}