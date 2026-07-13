import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import blason from "@/assets/blason.svg";
import { StatTile } from "@/components/ui";
import { EVENT_TYPES, fmtDate, fmtTime, isPast } from "@/lib/events";
import { fmtScore } from "@/lib/ballondor";

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
  const [nextEvent, setNextEvent] = useState(undefined); // undefined = loading, null = aucun
  const [myScore, setMyScore] = useState(undefined);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch(() => setSeasons([]));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch(() => setTeams([]));
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => {
      const upcoming = d.events.filter((e) => !isPast(e.starts_at) && e.status !== "cancelled");
      setNextEvent(upcoming[0] ?? null);
    }).catch(() => setNextEvent(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  useEffect(() => {
    if (!activeClubId || !seasons) return;
    const active = seasons.find((s) => s.status === "active");
    if (!active) { setMyScore(null); return; }
    Promise.all([
      api("members.php", "list", { club_id: activeClubId }, token),
      api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: active.id }, token),
    ]).then(([m, r]) => {
      const me = m.members.find((x) => x.user_id === user?.id);
      const mine = [...r.official, ...r.provisional].find((p) => p.club_member_id === me?.id);
      setMyScore(mine ?? null);
    }).catch(() => setMyScore(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, seasons, token, user?.id]);

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

      <div className="stat-tiles">
        <StatTile
          icon={nextEvent ? (EVENT_TYPES[nextEvent.type] ?? EVENT_TYPES.match).icon : "📅"}
          value={nextEvent === undefined ? "…" : nextEvent ? fmtDate(nextEvent.starts_at) : "Aucune"}
          label={nextEvent ? `${nextEvent.title} à ${fmtTime(nextEvent.starts_at)}` : "Prochaine séance"}
          tint="blue"
        />
        <StatTile
          icon="⭐"
          value={myScore === undefined ? "…" : myScore ? fmtScore(myScore.ballon_dor_score) : "—"}
          label={myScore ? "Mon score Ballon d'Or" : "Pas encore classé"}
          tint="gold"
        />
        <StatTile icon="🛡️" value={teams?.length ?? "…"} label="Équipes" tint="green" />
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
