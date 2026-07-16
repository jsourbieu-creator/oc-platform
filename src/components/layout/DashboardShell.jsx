import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell, ChatDots } from "react-bootstrap-icons";
import blason from "@/assets/blason.svg";

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
          <div className="topbar-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={blason} alt="" style={{ width: 30, height: 30, flexShrink: 0 }} />
            {memberships.length > 1 ? (
              <select value={activeClubId ?? ""} onChange={(e) => setActiveClubId(Number(e.target.value))} style={{ width: "auto", border: "none", fontWeight: 700, background: "transparent", minHeight: 0, padding: 0 }}>
                {memberships.map((m) => <option key={m.club_id} value={m.club_id}>{m.club_short_name}</option>)}
              </select>
            ) : (
              <span style={{ fontWeight: 800, fontSize: "0.92rem", letterSpacing: "-0.01em" }}>{memberships[0]?.club_name}</span>
            )}
          </div>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span onClick={() => goto("messages")} style={{ cursor: "pointer", position: "relative", display: "inline-flex", color: "var(--text-dim)" }} title="Messages">
              <ChatDots size={19} />
              {unreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: "var(--danger-500)", color: "#fff", borderRadius: "999px", fontSize: "0.6rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>{unreadMessages > 9 ? "9+" : unreadMessages}</span>
              )}
            </span>
            <span onClick={() => goto("notifications")} style={{ cursor: "pointer", position: "relative", display: "inline-flex", color: "var(--text-dim)" }} title="Notifications">
              <Bell size={19} />
              {unread > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: "var(--danger-500)", color: "#fff", borderRadius: "999px", fontSize: "0.6rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </span>
          </div>
        </header>
        <main className="dashboard-content"><div key={view} className="view-enter">{children}</div></main>
      </div>
      <BottomNav view={view} goto={goto} badges={badges} />
    </div>
  );
}
