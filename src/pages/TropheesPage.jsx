import { Trophy, Ruler, Flame, TrendingUp, Target, Frown, Laugh, Medal } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { fmtScore } from "@/lib/ballondor";

const TROPHY_ICONS = {
  ballon_dor: Trophy,
  most_regular: Ruler,
  most_assiduous: Flame,
  best_progression: TrendingUp,
  closest_perception: Target,
  most_severe_self: Frown,
  most_overrated_self: Laugh,
};

export function TropheesPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const [seasons, setSeasons] = useState(null);
  const [seasonId, setSeasonId] = useState(null);
  const [trophies, setTrophies] = useState(null);
  const [settings, setSettings] = useState(null);
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
    api("evaluations.php", "season_trophies", { club_id: activeClubId, season_id: seasonId }, token)
      .then(setTrophies).catch((e) => setError(e.message));
    api("evaluations.php", "season_settings_get", { club_id: activeClubId, season_id: seasonId }, token)
      .then((d) => setSettings(d.settings)).catch(() => {});
  }, [activeClubId, seasonId, token]);

  useEffect(load, [load]);

  const toggleHumorous = async () => {
    setNotice(""); setError("");
    try {
      await api("evaluations.php", "season_settings_update", { club_id: activeClubId, season_id: seasonId, ...settings, humorous_trophies_enabled: !settings.humorous_trophies_enabled }, token);
      setNotice("Réglage enregistré.");
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Trophées de fin de saison</h1>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="info-box">{notice}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Saison</label>
          <select value={seasonId ?? ""} onChange={(e) => setSeasonId(Number(e.target.value))}>
            {seasons?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {canManage && settings && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <span className="subtle">Trophées humoristiques (visibles seulement si activés)</span>
            <button className={`btn btn-sm ${settings.humorous_trophies_enabled ? "btn-primary" : "btn-secondary"}`} style={{ width: "auto" }} onClick={toggleHumorous}>
              {settings.humorous_trophies_enabled ? "Activés" : "Désactivés"}
            </button>
          </div>
        )}
      </div>

      {trophies === null && <div className="spinner" />}

      {trophies && trophies.trophies.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Pas encore assez de séances votées cette saison pour décerner des trophées.</p></div>
      )}

      {trophies && trophies.trophies.length > 0 && (
        <div className="card">
          {trophies.trophies.map((t) => (
            <div key={t.code} className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-flex", color: "var(--gold-500)" }}>{(() => { const I = TROPHY_ICONS[t.code] ?? Medal; return <I size={22} />; })()}</span>
                <div>
                  <strong>{t.label}</strong>
                  <div className="subtle">{t.player}</div>
                </div>
              </div>
              <strong style={{ color: "var(--oc-blue-600)" }}>{typeof t.value === "number" ? fmtScore(t.value) : t.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
