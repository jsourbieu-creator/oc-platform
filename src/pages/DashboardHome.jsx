import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Administrateur",
  coach: "Entraîneur",
  board_member: "Bureau",
  player: "Joueur",
};

export function DashboardHome() {
  const { user, token, activeClubId, memberships, activeRole } = useAuth();
  const [seasons, setSeasons] = useState(null);
  const [teams, setTeams] = useState(null);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch(() => setSeasons([]));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch(() => setTeams([]));
  }, [activeClubId, token]);

  const club = memberships.find((m) => m.club_id === activeClubId);

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 4 }}>Salut {user?.first_name} 👋</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        {club?.club_name} — connecté en tant que {ROLE_LABELS[activeRole] ?? activeRole}.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="card">
          <div className="label-title">Saisons</div>
          {seasons === null && <div className="subtle">Chargement…</div>}
          {seasons?.length === 0 && <div className="subtle">Aucune saison encore créée.</div>}
          {seasons?.map((s) => (
            <div key={s.id} style={{ padding: "4px 0", fontSize: "0.9rem" }}>{s.name} — <span className="subtle" style={{ display: "inline" }}>{s.status}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="label-title">Équipes</div>
          {teams === null && <div className="subtle">Chargement…</div>}
          {teams?.length === 0 && <div className="subtle">Aucune équipe encore créée.</div>}
          {teams?.map((t) => (
            <div key={t.id} style={{ padding: "4px 0", fontSize: "0.9rem" }}>{t.name}</div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="subtle">
          C'est la Phase 0 : les fondations (auth, rôles, isolation par club) sont
          en place et connectées en direct à ta base MySQL — ce que tu vois
          ci-dessus vient réellement de ta base. Les sections du menu grisées
          arriveront phase après phase.
        </div>
      </div>
    </div>
  );
}
