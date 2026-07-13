import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const SEASON_STATUS = { draft: "Brouillon", active: "Active", closed: "Clôturée" };
const canManage = (role) => role === "super_admin" || role === "admin";

export function TeamsPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const manage = canManage(activeRole);

  const [seasons, setSeasons] = useState(null);
  const [teams, setTeams] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch((e) => setError(e.message));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch((e) => setError(e.message));
    if (manage) {
      api("members.php", "list", { club_id: activeClubId }, token).then((d) => setMembers(d.members.filter((m) => m.status === "active"))).catch(() => {});
    }
  }, [activeClubId, token, manage]);

  useEffect(load, [load]);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Équipes & saisons</h1>
      {error && <div className="error-box">{error}</div>}
      <SeasonsBlock seasons={seasons} manage={manage} reload={load} />
      <TeamsBlock teams={teams} seasons={seasons} members={members} manage={manage} reload={load} />
    </div>
  );
}

function SeasonsBlock({ seasons, manage, reload }) {
  const { token, activeClubId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("seasons.php", "create", { club_id: activeClubId, name, start_date: start, end_date: end }, token);
      setName(""); setStart(""); setEnd(""); setShowForm(false);
      reload();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const setStatus = async (seasonId, status) => {
    setError("");
    try {
      await api("seasons.php", "set_status", { club_id: activeClubId, season_id: seasonId, status }, token);
      reload();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="label-title" style={{ marginBottom: 0 }}>Saisons</div>
        {manage && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Annuler" : "+ Nouvelle saison"}
          </button>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}

      {showForm && (
        <form onSubmit={create} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <div className="field"><label>Nom</label><input type="text" required placeholder="2026-2027" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Début</label><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="field"><label>Fin</label><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Création…" : "Créer la saison"}</button>
        </form>
      )}

      {seasons === null && <div className="spinner" />}
      {seasons?.length === 0 && <div className="subtle">Aucune saison. {manage ? "Crée la première pour pouvoir créer des équipes." : ""}</div>}
      {seasons?.map((s) => (
        <div key={s.id} className="list-row">
          <div>
            <strong>{s.name}</strong>
            <div className="subtle">{s.start_date} → {s.end_date}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {manage ? (
              <select value={s.status} onChange={(e) => setStatus(s.id, e.target.value)} style={{ width: "auto", padding: "6px 8px", fontSize: "0.8rem" }}>
                {Object.entries(SEASON_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <span className={`badge ${s.status === "active" ? "badge-info" : "badge-neutral"}`}>{SEASON_STATUS[s.status]}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamsBlock({ teams, seasons, members, manage, reload }) {
  const { token, activeClubId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openTeam, setOpenTeam] = useState(null);

  const activeSeason = seasons?.find((s) => s.status === "active");

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("teams.php", "create", { club_id: activeClubId, season_id: Number(seasonId || activeSeason?.id), name, category }, token);
      setName(""); setCategory(""); setShowForm(false);
      reload();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const remove = async (teamId) => {
    if (!confirm("Supprimer cette équipe et son effectif ?")) return;
    setError("");
    try {
      await api("teams.php", "delete", { club_id: activeClubId, team_id: teamId }, token);
      if (openTeam === teamId) setOpenTeam(null);
      reload();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="label-title" style={{ marginBottom: 0 }}>Équipes</div>
        {manage && seasons?.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Annuler" : "+ Nouvelle équipe"}
          </button>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}

      {showForm && (
        <form onSubmit={create} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
          <div className="field"><label>Nom</label><input type="text" required placeholder="Seniors A" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Catégorie</label><input type="text" placeholder="Seniors, U15…" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="field">
              <label>Saison</label>
              <select value={seasonId || activeSeason?.id || ""} onChange={(e) => setSeasonId(e.target.value)} required>
                <option value="" disabled>Choisir…</option>
                {seasons?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Création…" : "Créer l'équipe"}</button>
        </form>
      )}

      {teams === null && <div className="spinner" />}
      {teams?.length === 0 && <div className="subtle">Aucune équipe encore créée.</div>}
      {teams?.map((t) => (
        <div key={t.id}>
          <div className="list-row" style={{ cursor: "pointer" }} onClick={() => setOpenTeam(openTeam === t.id ? null : t.id)}>
            <div>
              <strong>{t.name}</strong>
              {t.category && <div className="subtle">{t.category}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="subtle">{seasons?.find((s) => s.id === t.season_id)?.name}</span>
              <span className="subtle">{openTeam === t.id ? "▲" : "▼"}</span>
            </div>
          </div>
          {openTeam === t.id && (
            <Roster team={t} members={members} manage={manage} onDelete={() => remove(t.id)} />
          )}
        </div>
      ))}
    </div>
  );
}

function Roster({ team, members, manage, onDelete }) {
  const { token, activeClubId } = useAuth();
  const [roster, setRoster] = useState(null);
  const [addId, setAddId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("teams.php", "roster_list", { club_id: activeClubId, team_id: team.id }, token)
      .then((d) => setRoster(d.roster)).catch((e) => setError(e.message));
  }, [activeClubId, team.id, token]);

  useEffect(load, [load]);

  const add = async () => {
    if (!addId) return;
    setError("");
    try {
      await api("teams.php", "roster_add", { club_id: activeClubId, team_id: team.id, club_member_id: Number(addId) }, token);
      setAddId(""); load();
    } catch (e2) { setError(e2.message); }
  };

  const remove = async (rowId) => {
    setError("");
    try {
      await api("teams.php", "roster_remove", { club_id: activeClubId, team_id: team.id, team_member_id: rowId }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const toggleFlag = async (row, flag) => {
    setError("");
    try {
      await api("teams.php", "roster_set_flags", {
        club_id: activeClubId, team_id: team.id, team_member_id: row.id,
        is_captain: flag === "captain" ? !Number(row.is_captain) : Number(row.is_captain),
        is_goalkeeper: flag === "goalkeeper" ? !Number(row.is_goalkeeper) : Number(row.is_goalkeeper),
      }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const inRoster = new Set(roster?.map((r) => r.club_member_id));
  const addable = members.filter((m) => !inRoster.has(m.id));

  return (
    <div style={{ padding: "6px 0 14px 14px", borderLeft: "3px solid var(--border)", marginLeft: 4, marginBottom: 8 }}>
      {error && <div className="error-box">{error}</div>}
      {roster === null && <div className="spinner" />}
      {roster?.length === 0 && <div className="subtle" style={{ marginBottom: 8 }}>Effectif vide.</div>}
      {roster?.map((r) => (
        <div key={r.id} className="list-row" style={{ padding: "7px 0" }}>
          <div>
            {r.first_name} {r.last_name}
            {Number(r.is_captain) === 1 && <span className="badge badge-info" style={{ marginLeft: 8 }}>Capitaine</span>}
            {Number(r.is_goalkeeper) === 1 && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Gardien</span>}
          </div>
          {manage && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleFlag(r, "captain")}>C</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleFlag(r, "goalkeeper")}>G</button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={() => remove(r.id)}>Retirer</button>
            </div>
          )}
        </div>
      ))}

      {manage && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
          <select value={addId} onChange={(e) => setAddId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Ajouter un membre…</option>
            {addable.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={add} disabled={!addId}>Ajouter</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={onDelete}>Supprimer l'équipe</button>
        </div>
      )}
    </div>
  );
}
