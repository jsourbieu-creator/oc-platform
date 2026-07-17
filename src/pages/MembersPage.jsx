import { Check, HeartPulse, Receipt } from "react-bootstrap-icons";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, PillMenu } from "@/components/ui";

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Administrateur",
  coach: "Entraîneur",
  board_member: "Bureau",
  player: "Joueur",
};
const ROLE_COLORS = {
  super_admin: "var(--oc-orange-500)",
  admin: "var(--electric-blue)",
  coach: "var(--lime-600)",
  board_member: "var(--oc-amber-700)",
  player: "var(--text-dim)",
};
const STATUS_LABELS = { active: "Actif", invited: "En attente", suspended: "Suspendu", archived: "Archivé" };
const STATUS_COLORS = {
  active: "var(--lime-600)", invited: "var(--oc-amber-700)",
  suspended: "var(--oc-orange-500)", archived: "var(--text-dim)",
};
const SEASON_STATUS = { draft: "Brouillon", active: "Active", closed: "Clôturée" };
const SEASON_STATUS_COLOR = { draft: "var(--oc-amber-700)", active: "var(--lime-600)", closed: "var(--text-dim)" };
const INVITE_ROLES = { player: "Joueur", coach: "Entraîneur", board_member: "Bureau", admin: "Administrateur" };
const canManage = (role) => role === "super_admin" || role === "admin";

export function MembersPage() {
  const { token, activeClubId, activeRole, user } = useAuth();
  const manage = canManage(activeRole);

  const [members, setMembers] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [roster, setRoster] = useState(null); // club_member_id -> { team_member_id, is_goalkeeper }
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("members.php", "list", { club_id: activeClubId }, token)
      .then((d) => setMembers(d.members)).catch((e) => setError(e.message));
    api("seasons.php", "list", { club_id: activeClubId }, token)
      .then((d) => setSeasons(d.seasons)).catch(() => {});
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => {
      const team = d.teams?.[0];
      if (!team) { setRoster({}); return; }
      api("teams.php", "roster_list", { club_id: activeClubId, team_id: team.id }, token).then((r) => {
        const map = {};
        for (const row of r.roster ?? []) map[row.club_member_id] = { teamId: team.id, teamMemberId: row.id, isGoalkeeper: Number(row.is_goalkeeper) === 1 };
        setRoster(map);
      }).catch(() => setRoster({}));
    }).catch(() => setRoster({}));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const setRole = async (memberId, role) => {
    setError("");
    try {
      await api("members.php", "set_role", { club_id: activeClubId, member_id: memberId, role }, token);
      load();
    } catch (e2) { setError(e2.message); load(); }
  };

  const setStatus = async (memberId, status) => {
    setError("");
    try {
      await api("members.php", "set_status", { club_id: activeClubId, member_id: memberId, status }, token);
      load();
    } catch (e2) { setError(e2.message); load(); }
  };

  const toggleFlag = async (member, field) => {
    setError("");
    try {
      await api("members.php", "set_flags", { club_id: activeClubId, member_id: member.id, [field]: member[field] ? 0 : 1 }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const toggleGoalkeeper = async (member) => {
    const r = roster?.[member.id];
    if (!r) return;
    setError("");
    try {
      await api("teams.php", "roster_set_flags", { club_id: activeClubId, team_id: r.teamId, team_member_id: r.teamMemberId, is_captain: 0, is_goalkeeper: !r.isGoalkeeper }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Membres</h1>
      {error && <div className="error-box">{error}</div>}

      <SeasonsBlock seasons={seasons} manage={manage} reload={load} />

      {manage && <InvitationsBlock />}

      <div className="card">
        <div className="label-title">Membres du club {members ? `(${members.length})` : ""}</div>
        {members === null && <div className="spinner" />}
        {members?.map((m) => {
          const isSelf = m.user_id === user?.id;
          const r = roster?.[m.id];
          return (
            <div key={m.id} className="list-row" style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={`${m.first_name} ${m.last_name}`} userId={m.user_id} avatarUrl={m.avatar_url} size={34} />
                <div style={{ minWidth: 0 }}>
                  <strong>{m.first_name} {m.last_name}</strong>{isSelf && <span className="subtle"> (toi)</span>}
                  {r?.isGoalkeeper && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>Gardien</span>}
                  <div className="subtle" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  title={m.has_medical_certificate ? "Certificat médical à jour — cliquer pour retirer" : "Pas de certificat médical — cliquer pour valider"}
                  onClick={() => manage && toggleFlag(m, "has_medical_certificate")}
                  disabled={!manage}
                  className="btn btn-sm"
                  style={{
                    cursor: manage ? "pointer" : "default",
                    background: m.has_medical_certificate ? "var(--lime-100)" : "var(--surface-soft)",
                    color: m.has_medical_certificate ? "var(--lime-600)" : "var(--text-dim)",
                  }}
                ><HeartPulse size={14} /> Certificat</button>
                <button
                  title={m.has_paid ? "Cotisation payée — cliquer pour retirer" : "Cotisation non payée — cliquer pour valider"}
                  onClick={() => manage && toggleFlag(m, "has_paid")}
                  disabled={!manage}
                  className="btn btn-sm"
                  style={{
                    cursor: manage ? "pointer" : "default",
                    background: m.has_paid ? "var(--lime-100)" : "var(--surface-soft)",
                    color: m.has_paid ? "var(--lime-600)" : "var(--text-dim)",
                  }}
                ><Receipt size={14} /> Payé</button>
                {manage && r && (
                  <button
                    className="btn btn-sm"
                    style={{
                      background: r.isGoalkeeper ? "color-mix(in srgb, var(--electric-blue) 18%, transparent)" : "var(--surface-soft)",
                      color: r.isGoalkeeper ? "var(--electric-blue)" : "var(--text-dim)",
                    }}
                    onClick={() => toggleGoalkeeper(m)}
                  >Gardien</button>
                )}
                {manage && !isSelf ? (
                  <>
                    <PillMenu value={m.role} options={ROLE_LABELS} colors={ROLE_COLORS} onChange={(v) => setRole(m.id, v)} />
                    <PillMenu value={m.status} options={STATUS_LABELS} colors={STATUS_COLORS} onChange={(v) => setStatus(m.id, v)} />
                  </>
                ) : (
                  <>
                    <span className="badge badge-info">{ROLE_LABELS[m.role]}</span>
                    {m.status !== "active" && <span className="badge badge-neutral">{STATUS_LABELS[m.status]}</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
      {seasons?.length === 0 && <div className="subtle">Aucune saison. {manage ? "Crée la première pour lancer le suivi." : ""}</div>}
      {seasons?.map((s) => (
        <div key={s.id} className="list-row" style={{ flexWrap: "wrap", gap: 10, opacity: s.status === "closed" ? 0.55 : 1 }}>
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

function InvitationsBlock() {
  const { token, activeClubId, activeRole } = useAuth();
  const [invitations, setInvitations] = useState(null);
  const [role, setRole] = useState("player");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCode, setLastCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api("members.php", "invite_list", { club_id: activeClubId }, token)
      .then((d) => setInvitations(d.invitations)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true); setCopied(false);
    try {
      const d = await api("members.php", "invite_create", { club_id: activeClubId, role, email }, token);
      setLastCode(d.code);
      setEmail("");
      load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const revoke = async (id) => {
    setError("");
    try {
      await api("members.php", "invite_revoke", { club_id: activeClubId, invitation_id: id }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const pending = invitations?.filter((i) => i.status === "pending") ?? [];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="label-title">Inviter quelqu'un</div>
      <p className="subtle" style={{ marginTop: 0, marginBottom: 12 }}>
        Génère un code, transmets-le à la personne : elle crée son compte sur la
        plateforme puis saisit le code pour rejoindre le club. Valable 14 jours.
      </p>
      {error && <div className="error-box">{error}</div>}

      <form onSubmit={create} style={{ marginBottom: lastCode || pending.length ? 14 : 0 }}>
        <div className="field">
          <label>Rôle</label>
          <div className="segmented" style={{ display: "flex", flexWrap: "wrap", width: "100%" }}>
            {Object.entries(INVITE_ROLES).filter(([v]) => v !== "admin" || activeRole === "super_admin").map(([v, l]) => (
              <button key={v} type="button" className={role === v ? "active" : ""} style={{ flex: "1 1 45%" }} onClick={() => setRole(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label>E-mail (optionnel, pour mémoire)</label>
            <input type="email" placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ padding: "11px 18px", width: "auto" }} disabled={busy}>{busy ? "…" : "Générer un code"}</button>
        </div>
      </form>

      {lastCode && (
        <div className="info-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>Code : <strong style={{ fontFamily: "monospace", fontSize: "1.05rem", letterSpacing: "0.08em" }}>{lastCode}</strong></span>
          <button className="btn btn-secondary btn-sm" onClick={() => copy(lastCode)}>{copied ? <><Check size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />Copié</> : "Copier"}</button>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <div className="label-title" style={{ marginTop: 6 }}>Invitations en attente</div>
          {pending.map((i) => (
            <div key={i.id} className="list-row" style={{ padding: "7px 0" }}>
              <div>
                <strong style={{ fontFamily: "monospace", letterSpacing: "0.06em" }}>{i.code}</strong>
                <div className="subtle">{ROLE_LABELS[i.role]}{i.email ? ` — ${i.email}` : ""} — expire le {i.expires_at?.slice(0, 10)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={() => revoke(i.id)}>Révoquer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
