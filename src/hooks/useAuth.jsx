import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "oc_token";
const ACTIVE_CLUB_KEY = "oc_active_club_id";

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeClubId, setActiveClubIdState] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_CLUB_KEY);
    return stored ? Number(stored) : null;
  });

  const refresh = useCallback(async (tok) => {
    const useToken = tok ?? token;
    if (!useToken) {
      setUser(null);
      setMemberships([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api("auth.php", "me", {}, useToken);
      setUser(data.user);
      setMemberships(data.memberships);
      const stillValid = data.memberships.some((m) => m.club_id === activeClubId);
      if (!stillValid) {
        const first = data.memberships[0]?.club_id ?? null;
        setActiveClubIdState(first);
        if (first) localStorage.setItem(ACTIVE_CLUB_KEY, String(first));
      }
    } catch (e) {
      // token invalide/expiré
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, [token, activeClubId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api("auth.php", "login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    await refresh(data.token);
    return data;
  }, [refresh]);

  const signOut = useCallback(async () => {
    try { await api("auth.php", "logout", {}, token); } catch (_) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVE_CLUB_KEY);
    setToken(null);
    setUser(null);
    setMemberships([]);
    setActiveClubIdState(null);
  }, [token]);

  const setActiveClubId = useCallback((clubId) => {
    setActiveClubIdState(clubId);
    localStorage.setItem(ACTIVE_CLUB_KEY, String(clubId));
  }, []);

  const hasPermission = useCallback(async (code) => {
    if (!activeClubId || !token) return false;
    try {
      const data = await api("permissions.php", "check", { club_id: activeClubId, code }, token);
      return Boolean(data.granted);
    } catch (e) {
      return false;
    }
  }, [activeClubId, token]);

  const activeRole = memberships.find((m) => m.club_id === activeClubId)?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        loading,
        token,
        user,
        memberships,
        activeClubId,
        setActiveClubId,
        activeRole,
        hasPermission,
        login,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
