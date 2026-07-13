import { Trophy, Star, Users } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtScore } from "@/lib/ballondor";
import { StatTile, Avatar } from "@/components/ui";

const PODIUM_COLORS = ["var(--gold-500)", "var(--silver-400)", "var(--bronze-500)"];

function PerceptionChart({ sessions }) {
  if (!sessions || sessions.length < 2) return null;
  const w = 600, h = 180, pad = 24;
  const allVals = sessions.flatMap((s) => [s.self_score, s.received_avg]);
  const min = Math.min(1, ...allVals), max = Math.max(10, ...allVals);
  const x = (i) => pad + (i * (w - 2 * pad)) / (sessions.length - 1);
  const y = (v) => h - pad - ((v - min) / (max - min)) * (h - 2 * pad);
  const path = (key) => sessions.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s[key])}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", marginTop: 10 }}>
      <path d={path("self_score")} fill="none" stroke="var(--oc-sky-400)" strokeWidth="2.5" />
      <path d={path("received_avg")} fill="none" stroke="var(--oc-blue-600)" strokeWidth="2.5" />
      {sessions.map((s, i) => (
        <g key={s.event_id}>
          <circle cx={x(i)} cy={y(s.self_score)} r="3" fill="var(--oc-sky-400)" />
          <circle cx={x(i)} cy={y(s.received_avg)} r="3" fill="var(--oc-blue-600)" />
        </g>
      ))}
      <text x={pad} y={14} fontSize="11" fill="var(--oc-sky-400)" fontWeight="700">● Auto-évaluation</text>
      <text x={pad + 140} y={14} fontSize="11" fill="var(--oc-blue-600)" fontWeight="700">● Moyenne reçue</text>
    </svg>
  );
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function ClassementsPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const [seasons, setSeasons] = useState(null);
  const [seasonId, setSeasonId] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [perception, setPerception] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManage = ["super_admin", "admin"].includes(activeRole);

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
    api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: seasonId }, token)
      .then(setRankings).catch((e) => setError(e.message));
    api("evaluations.php", "my_perception", { club_id: activeClubId, season_id: seasonId }, token)
      .then(setPerception).catch(() => setPerception(null));
    api("evaluations.php", "season_settings_get", { club_id: activeClubId, season_id: seasonId }, token)
      .then((d) => setSettings(d.settings)).catch(() => {});
  }, [activeClubId, seasonId, token]);

  useEffect(load, [load]);

  const saveSettings = async () => {
    setNotice(""); setError("");
    try {
      await api("evaluations.php", "season_settings_update", { club_id: activeClubId, season_id: seasonId, ...settings }, token);
      setNotice("Paramètres enregistrés — le classement est recalculé automatiquement.");
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Classement Ballon d'Or</h1>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="info-box">{notice}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: canManage ? 12 : 0 }}>
          <label>Saison</label>
          <select value={seasonId ?? ""} onChange={(e) => setSeasonId(Number(e.target.value))}>
            {seasons?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {canManage && (
          <button className="btn btn-ghost" style={{ width: "auto", padding: 0 }} onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "Masquer les réglages" : "Réglages de calcul"}
          </button>
        )}
        {canManage && showSettings && settings && (
          <div style={{ marginTop: 12 }}>
            <div className="field">
              <label>Seuil de fiabilité (moyenne ajustée)</label>
              <input type="text" value={settings.reliability_threshold} onChange={(e) => setSettings({ ...settings, reliability_threshold: e.target.value })} />
            </div>
            <div className="field">
              <label>Séances minimum (éligibilité classement officiel)</label>
              <input type="text" value={settings.eligibility_min_sessions} onChange={(e) => setSettings({ ...settings, eligibility_min_sessions: e.target.value })} />
            </div>
            <div className="field">
              <label>Taux de présence minimum % (éligibilité)</label>
              <input type="text" value={settings.eligibility_min_attendance_pct} onChange={(e) => setSettings({ ...settings, eligibility_min_attendance_pct: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={saveSettings}>Enregistrer</button>
          </div>
        )}
      </div>

      {rankings === null && seasons !== null && seasons.length > 0 && <div className="spinner" />}

      {seasons !== null && seasons.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>
            Aucune saison créée pour le moment. Rends-toi dans <strong>Équipes</strong> pour créer une saison (et l'activer) avant de pouvoir consulter le classement.
          </p>
        </div>
      )}

      {rankings && (rankings.official.length > 0 || rankings.provisional.length > 0) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            className="btn btn-sm btn-secondary" style={{ width: "auto" }}
            onClick={() => downloadCsv(
              `classement-${seasons.find((s) => s.id === seasonId)?.name ?? seasonId}.csv`,
              [
                ["Rang", "Joueur", "Score Ballon d'Or", "Moyenne ajustée", "Moyenne brute", "Séances", "Taux de présence %", "Régularité", "Statut"],
                ...rankings.official.map((p) => [p.rank, p.name, p.ballon_dor_score, p.adjusted_average, p.raw_average, p.sessions_played, p.attendance_rate, p.regularity, "Officiel"]),
                ...rankings.provisional.map((p) => ["-", p.name, p.ballon_dor_score, p.adjusted_average, p.raw_average, p.sessions_played, p.attendance_rate, p.regularity, "Provisoire"]),
              ]
            )}
          >Exporter en CSV</button>
        </div>
      )}

      {rankings && (rankings.official.length > 0 || rankings.provisional.length > 0) && (
        <div className="stat-tiles">
          <StatTile icon={<Trophy size={20} />} value={rankings.official[0]?.name ?? "—"} label="En tête du classement" tint="gold" />
          <StatTile icon={<Star size={20} />} value={rankings.group_average !== null ? fmtScore(rankings.group_average) : "—"} label="Moyenne du groupe" tint="blue" />
          <StatTile icon={<Users size={20} />} value={rankings.official.length + rankings.provisional.length} label="Joueurs classés" tint="green" />
        </div>
      )}

      {rankings && rankings.official.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Podium</div>
          <div className="podium-row">
            {[rankings.official[1], rankings.official[0], rankings.official[2]].map((p, i) => {
              if (!p) return <div key={i} style={{ width: 90 }} />;
              const heights = [70, 100, 55]; // 2e, 1er, 3e
              return (
                <div key={p.club_member_id} className="podium-step">
                  <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} size={i === 1 ? 42 : 34} />
                  <div className="podium-name">{p.name}</div>
                  <div className="podium-score">{fmtScore(p.ballon_dor_score)}</div>
                  <div className="podium-bar" style={{ height: heights[i], background: p.rank === 1 ? "var(--oc-gradient)" : `linear-gradient(180deg, ${PODIUM_COLORS[p.rank - 1]}, ${PODIUM_COLORS[p.rank - 1]})` }}>
                    <span className="rank">{p.rank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rankings && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Classement officiel</div>
          {rankings.official.length === 0 && <p className="subtle">Personne ne remplit encore les conditions d'éligibilité.</p>}
          {rankings.official.map((p) => (
            <div key={p.club_member_id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: p.rank <= 3 ? PODIUM_COLORS[p.rank - 1] : "var(--surface-alt)",
                  color: p.rank <= 3 ? "#fff" : "var(--text-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.8rem",
                }}>{p.rank}</span>
                <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} size={28} />
                <strong>{p.name}</strong>
                <span className="subtle">({p.sessions_played} séances, {p.attendance_rate}% présence)</span>
              </div>
              <strong className="num" style={{ color: "var(--oc-blue-600)", fontSize: "1.1rem" }}>{fmtScore(p.ballon_dor_score)}</strong>
            </div>
          ))}
        </div>
      )}

      {rankings && rankings.provisional.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Classement provisoire</div>
          {rankings.provisional.map((p) => (
            <div key={p.club_member_id} className="list-row">
              <div>
                <strong>{p.name}</strong>
                <div className="subtle">Encore {p.sessions_until_eligible} séance(s) pour intégrer le classement officiel</div>
              </div>
              <span className="subtle num">{fmtScore(p.ballon_dor_score)}</span>
            </div>
          ))}
        </div>
      )}

      {perception?.summary && (
        <div className="card">
          <div className="label-title">Mon ressenti face au groupe</div>
          <div className="list-row"><span>Ma moyenne d'auto-évaluation</span><strong>{fmtScore(perception.summary.avg_self)}/10</strong></div>
          <div className="list-row"><span>Moyenne attribuée par mes coéquipiers</span><strong>{fmtScore(perception.summary.avg_received)}/10</strong></div>
          <div className="list-row"><span>Écart moyen</span><strong>{perception.summary.avg_gap > 0 ? "+" : ""}{fmtScore(perception.summary.avg_gap)}</strong></div>
          <p className="subtle" style={{ marginTop: 10, marginBottom: 0 }}>{perception.summary.perception_level}</p>
          <PerceptionChart sessions={perception.sessions} />
        </div>
      )}
    </div>
  );
}
