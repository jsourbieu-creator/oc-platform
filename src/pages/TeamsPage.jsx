import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui";

const SEASON_STATUS = { draft: "Brouillon", active: "Active", closed: "Clôturée" };
const SEASON_STATUS_COLOR = { draft: "var(--oc-amber-700)", active: "var(--lime-600)", closed: "var(--text-dim)" };
const canManage = (role) => role === "super_admin" || role === "admin";

export function TeamsPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const manage = canManage(activeRole);

  const [seasons, setSeasons] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch((e) => setError(e.message));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Équipes & saisons</h1>
      {error && <div className="error-box">{error}</div>}
      <SeasonsBlock seasons={seasons} manage={manage} reload={load} />
      <TeamsBlock teams={teams} seasons={seasons} manage={manage} reload={load} />
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
      {seasons?.length === 0 && <div className="subtle">Aucune saison. {manage ? "Crée la première pour pouvoir créer des équipes." : ""}</div>}
      {seasons?.map((s) => (
        <div key={s.id} className="list-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <strong>{s.name}</strong>
            <div className="subtle">{s.start_date} → {s.end_date}</div>
          </div>
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
        </div>
      ))}
    </div>
  );
}

function TeamsBlock({ teams, seasons, manage }) {
  const activeSeason = seasons?.find((s) => s.status === "active");
  const team = teams?.[0];

  return (
    <div className="card">
      <div className="label-title">Équipe</div>

      {teams === null && <div className="spinner" />}
      {teams !== null && !team && (
        <p className="subtle" style={{ margin: 0 }}>
          L'effectif apparaîtra ici dès qu'une saison sera créée.
        </p>
      )}
      {team && (
        <div>
          <div className="subtle" style={{ marginBottom: 10 }}>{activeSeason?.name ?? seasons?.find((s) => s.id === team.season_id)?.name}</div>
          <Roster team={team} manage={manage} />
        </div>
      )}
    </div>
  );
}

function Roster({ team, manage }) {
  const { token, activeClubId } = useAuth();
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("teams.php", "roster_list", { club_id: activeClubId, team_id: team.id }, token)
      .then((d) => setRoster(d.roster)).catch((e) => setError(e.message));
  }, [activeClubId, team.id, token]);

  useEffect(load, [load]);

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

  return (
    <div style={{ padding: "6px 0 14px 14px", borderLeft: "3px solid var(--border)", marginLeft: 4, marginBottom: 8 }}>
      {error && <div className="error-box">{error}</div>}
      {roster === null && <div className="spinner" />}
      {roster?.length === 0 && <div className="subtle" style={{ marginBottom: 8 }}>Aucun membre actif pour le moment.</div>}
      {roster?.map((r) => (
        <div key={r.id} className="list-row" style={{ padding: "7px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={`${r.first_name} ${r.last_name}`} userId={r.user_id} avatarUrl={r.avatar_url} size={30} />
            <span>
              {r.first_name} {r.last_name}
              {Number(r.is_captain) === 1 && <span className="badge badge-info" style={{ marginLeft: 8 }}>Capitaine</span>}
              {Number(r.is_goalkeeper) === 1 && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Gardien</span>}
            </span>
          </div>
          {manage && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleFlag(r, "captain")}>C</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleFlag(r, "goalkeeper")}>G</button>
            </div>
          )}
        </div>
      ))}
      <p className="subtle" style={{ marginTop: 10, marginBottom: 0 }}>
        Tous les membres actifs du club font automatiquement partie de l'effectif.
      </p>
    </div>
  );
}
