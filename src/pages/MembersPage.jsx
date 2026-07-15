import { Check } from "react-bootstrap-icons";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui";

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Administrateur",
  coach: "Entraîneur",
  board_member: "Bureau",
  player: "Joueur",
};
const STATUS_LABELS = { active: "Actif", invited: "En attente", suspended: "Suspendu", archived: "Archivé" };
const canManage = (role) => role === "super_admin" || role === "admin";

export function MembersPage() {
  const { token, activeClubId, activeRole, user } = useAuth();
  const manage = canManage(activeRole);

  const [members, setMembers] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("members.php", "list", { club_id: activeClubId }, token)
      .then((d) => setMembers(d.members)).catch((e) => setError(e.message));
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

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Membres</h1>
      {error && <div className="error-box">{error}</div>}

      {manage && <InvitationsBlock />}

      <div className="card">
        <div className="label-title">Membres du club {members ? `(${members.length})` : ""}</div>
        {members === null && <div className="spinner" />}
        {members?.map((m) => {
          const isSelf = m.user_id === user?.id;
          return (
            <div key={m.id} className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={`${m.first_name} ${m.last_name}`} userId={m.user_id} avatarUrl={m.avatar_url} size={34} />
                <div style={{ minWidth: 0 }}>
                  <strong>{m.first_name} {m.last_name}</strong>{isSelf && <span className="subtle"> (toi)</span>}
                  <div className="subtle" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {manage && !isSelf ? (
                  <>
                    <select value={m.role} onChange={(e) => setRole(m.id, e.target.value)} style={{ width: "auto", padding: "6px 8px", fontSize: "0.8rem" }}>
                      {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={m.status} onChange={(e) => setStatus(m.id, e.target.value)} style={{ width: "auto", padding: "6px 8px", fontSize: "0.8rem" }}>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
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

      <form onSubmit={create} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: lastCode || pending.length ? 14 : 0 }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
          <label>Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="player">Joueur</option>
            <option value="coach">Entraîneur</option>
            <option value="board_member">Bureau</option>
            {activeRole === "super_admin" && <option value="admin">Administrateur</option>}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "2 1 200px" }}>
          <label>E-mail (optionnel, pour mémoire)</label>
          <input type="email" placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" style={{ padding: "11px 18px" }} disabled={busy}>{busy ? "…" : "Générer un code"}</button>
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
