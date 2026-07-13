import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell } from "lucide-react";

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Administrateur",
  coach: "Entraîneur",
  board_member: "Bureau",
  player: "Joueur",
};

export function DashboardShell({ view, goto, children }) {
  const { user, memberships, activeClubId, setActiveClubId, activeRole, signOut, token } = useAuth();
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!activeClubId || !token) return;
    let alive = true;
    const poll = () => {
      api("notifications.php", "unread_count", { club_id: activeClubId }, token)
        .then((d) => { if (alive) setUnread(d.count); })
        .catch(() => {});
      api("messages.php", "unread_total", { club_id: activeClubId }, token)
        .then((d) => { if (alive) setUnreadMessages(d.count); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 25000);
    return () => { alive = false; clearInterval(id); };
  }, [activeClubId, token, view]);

  const badges = { messages: unreadMessages, notifications: unread };

  return (
    <div className="dashboard-shell">
      <Sidebar view={view} goto={goto} badges={badges} />
      <div className="dashboard-main">
        <header className="topbar">
          <div className="topbar-left">
            {memberships.length > 1 ? (
              <select value={activeClubId ?? ""} onChange={(e) => setActiveClubId(Number(e.target.value))} style={{ width: "auto", border: "none", fontWeight: 700 }}>
                {memberships.map((m) => <option key={m.club_id} value={m.club_id}>{m.club_short_name}</option>)}
              </select>
            ) : (
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{memberships[0]?.club_name}</span>
            )}
            {activeRole && <span className="badge badge-info">{ROLE_LABELS[activeRole] ?? activeRole}</span>}
          </div>
          <div className="topbar-right">
            <span className="subtle" style={{ display: "none" }}>{user?.first_name} {user?.last_name}</span>
            <span onClick={() => goto("notifications")} style={{ cursor: "pointer", position: "relative", display: "inline-flex", color: "var(--text-dim)" }} title="Notifications">
              <Bell size={18} />
              {unread > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: "var(--danger-600)", color: "#fff", borderRadius: "var(--radius-full)", fontSize: "0.6rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </span>
            <ThemeToggle />
            <span onClick={signOut} className="subtle" style={{ cursor: "pointer" }}>Déconnexion</span>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
      <BottomNav view={view} goto={goto} badges={badges} />
    </div>
  );
}
