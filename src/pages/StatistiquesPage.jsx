import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtScore } from "@/lib/ballondor";
import { Donut, StatTile } from "@/components/ui";

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
        <>
          <div className="stat-tiles">
            <StatTile icon="🏃" value={stats.total_sessions} label="Séances jouées" tint="blue" />
            <StatTile icon="⭐" value={stats.group_average !== null ? fmtScore(stats.group_average) : "—"} label="Moyenne du groupe" tint="gold" />
            <StatTile icon="👥" value={stats.nb_ranked_players} label="Joueurs classés" tint="green" />
          </div>

          <div className="card" style={{ marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            {stats.convocation_response_rate !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Donut
                  segments={[
                    { value: stats.convocation_response_rate, color: "var(--oc-blue-bright)" },
                    { value: 100 - stats.convocation_response_rate, color: "var(--surface-alt)" },
                  ]}
                  centerLabel={`${stats.convocation_response_rate}%`} centerSub="réponses"
                />
                <div>
                  <strong>Taux de réponse</strong>
                  <div className="subtle">aux convocations</div>
                </div>
              </div>
            )}
            {stats.vote_participation_rate !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Donut
                  segments={[
                    { value: stats.vote_participation_rate, color: "var(--gold-500)" },
                    { value: 100 - stats.vote_participation_rate, color: "var(--surface-alt)" },
                  ]}
                  centerLabel={`${stats.vote_participation_rate}%`} centerSub="votes"
                />
                <div>
                  <strong>Participation</strong>
                  <div className="subtle">aux votes Ballon d'Or</div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            {stats.most_regular && <div className="list-row"><span>🎯 Joueur le plus régulier</span><strong>{stats.most_regular.name}</strong></div>}
            {stats.most_assiduous && <div className="list-row"><span>🔥 Joueur le plus assidu</span><strong>{stats.most_assiduous.name} ({stats.most_assiduous.value}%)</strong></div>}
            {stats.best_progression && <div className="list-row"><span>📈 Meilleure progression</span><strong>{stats.best_progression.name} ({stats.best_progression.value > 0 ? "+" : ""}{fmtScore(stats.best_progression.value)})</strong></div>}
          </div>
        </>
      )}
    </div>
  );
}
