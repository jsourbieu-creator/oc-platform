import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import blason from "@/assets/blason.svg";

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
  const activeSeason = seasons?.find((s) => s.status === "active");

  return (
    <div>
      <div className="hero-banner" style={{ marginBottom: 20 }}>
        <div className="hero-content">
          <img src={blason} alt="Blason OC" className="hero-blason" style={{ width: 64 }} />
          <div className="hero-eyebrow">{club?.club_name}</div>
          <div className="hero-title" style={{ fontSize: "1.9rem" }}>Salut {user?.first_name}</div>
          <div className="hero-sub">
            {ROLE_LABELS[activeRole] ?? activeRole}{activeSeason ? ` — Saison ${activeSeason.name}` : ""}
          </div>
        </div>
      </div>

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
    </div>
  );
}
