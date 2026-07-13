import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtScore } from "@/lib/ballondor";

export function StatistiquesPage() {
  const { token, activeClubId } = useAuth();
  const [seasons, setSeasons] = useState(null);
  const [seasonId, setSeasonId] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => {
      setSeasons(d.seasons);
      const active = d.seasons.find((s) => s.status === "active") ?? d.seasons[0];
      if (active && !seasonId) setSeasonId(active.id);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  const load = useCallback(() => {
    if (!activeClubId || !seasonId) return;
    setError("");
    api("evaluations.php", "season_team_stats", { club_id: activeClubId, season_id: seasonId }, token)
      .then(setStats).catch((e) => setError(e.message));
  }, [activeClubId, seasonId, token]);

  useEffect(load, [load]);

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Statistiques collectives</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Saison</label>
          <select value={seasonId ?? ""} onChange={(e) => setSeasonId(Number(e.target.value))}>
            {seasons?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {stats === null && seasons !== null && seasons.length > 0 && <div className="spinner" />}
      {seasons !== null && seasons.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune saison créée pour le moment.</p></div>
      )}

      {stats && (
        <div className="card">
          <div className="list-row"><span>Séances jouées cette saison</span><strong>{stats.total_sessions}</strong></div>
          <div className="list-row"><span>Moyenne générale du groupe</span><strong>{stats.group_average !== null ? `${fmtScore(stats.group_average)}/10` : "—"}</strong></div>
          <div className="list-row"><span>Joueurs classés</span><strong>{stats.nb_ranked_players}</strong></div>
          <div className="list-row"><span>Taux de réponse aux convocations</span><strong>{stats.convocation_response_rate !== null ? `${stats.convocation_response_rate}%` : "—"}</strong></div>
          <div className="list-row"><span>Taux de participation aux votes</span><strong>{stats.vote_participation_rate !== null ? `${stats.vote_participation_rate}%` : "—"}</strong></div>
          {stats.most_regular && <div className="list-row"><span>Joueur le plus régulier</span><strong>{stats.most_regular.name}</strong></div>}
          {stats.most_assiduous && <div className="list-row"><span>Joueur le plus assidu</span><strong>{stats.most_assiduous.name} ({stats.most_assiduous.value}%)</strong></div>}
          {stats.best_progression && <div className="list-row"><span>Meilleure progression</span><strong>{stats.best_progression.name} ({stats.best_progression.value > 0 ? "+" : ""}{fmtScore(stats.best_progression.value)})</strong></div>}
        </div>
      )}
    </div>
  );
}
