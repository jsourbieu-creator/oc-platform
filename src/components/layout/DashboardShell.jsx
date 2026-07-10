import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Administrateur",
  coach: "Entraîneur",
  board_member: "Bureau",
  player: "Joueur",
};

export function DashboardShell({ view, goto, children }) {
  const { user, memberships, activeClubId, setActiveClubId, activeRole, signOut } = useAuth();

  return (
    <div className="dashboard-shell">
      <Sidebar view={view} goto={goto} />
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
            <ThemeToggle />
            <span onClick={signOut} className="subtle" style={{ cursor: "pointer" }}>Déconnexion</span>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
      <BottomNav view={view} goto={goto} />
    </div>
  );
}
