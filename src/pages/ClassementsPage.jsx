import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtScore } from "@/lib/ballondor";

const PODIUM_COLORS = ["var(--gold-500)", "var(--silver-400)", "var(--bronze-500)"];

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
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Classement Ballon d'Or</h1>
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

      {rankings === null && <div className="spinner" />}

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
                <strong>{p.name}</strong>
                <span className="subtle">({p.sessions_played} séances, {p.attendance_rate}% présence)</span>
              </div>
              <strong style={{ color: "var(--oc-blue-600)", fontSize: "1.1rem" }}>{fmtScore(p.ballon_dor_score)}</strong>
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
              <span className="subtle">{fmtScore(p.ballon_dor_score)}</span>
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
        </div>
      )}
    </div>
  );
}
