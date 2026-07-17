import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const SEASON_STATUS = { draft: "Brouillon", active: "Active", closed: "Clôturée" };
const SEASON_STATUS_COLOR = { draft: "var(--oc-amber-700)", active: "var(--lime-600)", closed: "var(--text-dim)" };
const canManage = (role) => role === "super_admin" || role === "admin";

export function SeasonsPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const manage = canManage(activeRole);

  const [seasons, setSeasons] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // saison en attente de confirmation

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("seasons.php", "create", { club_id: activeClubId, name, start_date: start, end_date: end }, token);
      setName(""); setStart(""); setEnd(""); setShowForm(false);
      load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const setStatus = async (seasonId, status) => {
    setError("");
    try {
      await api("seasons.php", "set_status", { club_id: activeClubId, season_id: seasonId, status }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const doDelete = async (season) => {
    setError("");
    try {
      await api("seasons.php", "delete", { club_id: activeClubId, season_id: season.id }, token);
      setConfirmDelete(null);
      load();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Saisons</h1>
      <p className="subtle" style={{ marginBottom: 18 }}>
        Une saison encadre le calendrier, les votes et les trophées d'une période
        (généralement août à juin). La supprimer efface aussi définitivement tous
        les événements qui tombent dans sa plage de dates.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="label-title" style={{ marginBottom: 0 }}>Toutes les saisons</div>
          {manage && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Annuler" : "+ Nouvelle saison"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={create} style={{ marginBottom: 18, paddingBottom: 4 }}>
            <div className="field"><label>Nom</label><input type="text" required placeholder="2026-2027" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Début</label><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div className="field"><label>Fin</label><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Création…" : "Créer la saison"}</button>
          </form>
        )}

        {seasons === null && <div className="spinner" />}
        {seasons?.length === 0 && <div className="subtle">Aucune saison. {manage ? "Crée la première pour lancer le suivi." : ""}</div>}
        {seasons?.map((s) => (
          <div key={s.id} className="list-row" style={{ flexWrap: "wrap", gap: 10, opacity: s.status === "closed" ? 0.55 : 1 }}>
            <div>
              <strong>{s.name}</strong>
              <div className="subtle">{s.start_date} → {s.end_date}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {manage ? (
                <div className="segmented">
                  {Object.entries(SEASON_STATUS).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      className={s.status === v ? "active" : ""}
                      onClick={() => v !== s.status && setStatus(s.id, v)}
                      style={s.status === v ? { color: SEASON_STATUS_COLOR[v], background: "var(--surface)" } : undefined}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`badge ${s.status === "active" ? "badge-info" : "badge-neutral"}`}>{SEASON_STATUS[s.status]}</span>
              )}
              {manage && (
                confirmDelete === s.id ? (
                  <>
                    <span className="subtle" style={{ fontSize: "0.78rem" }}>Vraiment tout supprimer ?</span>
                    <button className="btn btn-sm" style={{ background: "var(--danger-100)", color: "var(--danger-600)" }} onClick={() => doDelete(s)}>Oui, supprimer</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Annuler</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={() => setConfirmDelete(s.id)}>Supprimer</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
