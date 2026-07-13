import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime } from "@/lib/events";
import { REAL_STATUS_LABELS, canManageVotes } from "@/lib/ballondor";

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function PresencesPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const [events, setEvents] = useState(null);
  const [members, setMembers] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [statuses, setStatuses] = useState({}); // { club_member_id: status }
  const [addMemberId, setAddMemberId] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = canManageVotes(activeRole);

  useEffect(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => {
      const sorted = [...d.events].filter((e) => e.status !== "cancelled")
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      setEvents(sorted);
      if (sorted.length && !selectedEventId) setSelectedEventId(sorted[0].id);
    }).catch((e) => setError(e.message));
    api("members.php", "list", { club_id: activeClubId }, token)
      .then((d) => setMembers(d.members.filter((m) => m.status === "active")))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  const loadCandidates = useCallback(() => {
    if (!activeClubId || !selectedEventId) return;
    setError(""); setNotice("");
    api("evaluations.php", "attendance_candidates", { club_id: activeClubId, event_id: selectedEventId }, token)
      .then((d) => {
        setCandidates(d.candidates);
        const map = {};
        d.candidates.forEach((c) => { if (c.real_status) map[c.club_member_id] = c.real_status; });
        setStatuses(map);
      }).catch((e) => setError(e.message));
    api("evaluations.php", "vote_session_status", { club_id: activeClubId, event_id: selectedEventId }, token)
      .then(setSession).catch(() => setSession(null));
  }, [activeClubId, selectedEventId, token]);

  useEffect(loadCandidates, [loadCandidates]);

  const setStatus = (mid, status) => setStatuses((s) => ({ ...s, [mid]: status }));

  const addMember = () => {
    if (!addMemberId || !candidates) return;
    const m = members.find((x) => x.id === Number(addMemberId));
    if (!m || candidates.some((c) => c.club_member_id === m.id)) return;
    setCandidates([...candidates, { club_member_id: m.id, name: `${m.first_name} ${m.last_name}`, real_status: null }]);
    setAddMemberId("");
  };

  const save = async () => {
    const rows = Object.entries(statuses).map(([mid, real_status]) => ({ club_member_id: Number(mid), real_status }));
    if (!rows.length) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api("evaluations.php", "attendance_set", { club_id: activeClubId, event_id: selectedEventId, attendances: rows }, token);
      setNotice("Présences enregistrées.");
      loadCandidates();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;

  const openVotes = async () => {
    setError(""); setNotice("");
    try {
      await api("evaluations.php", "vote_session_open", { club_id: activeClubId, event_id: selectedEventId }, token);
      loadCandidates();
    } catch (e) { setError(e.message); }
  };
  const closeVotes = async () => {
    setError(""); setNotice("");
    try {
      await api("evaluations.php", "vote_session_close", { club_id: activeClubId, event_id: selectedEventId }, token);
      loadCandidates();
    } catch (e) { setError(e.message); }
  };

  const availableToAdd = useMemo(
    () => (members ?? []).filter((m) => !candidates?.some((c) => c.club_member_id === m.id)),
    [members, candidates]
  );

  if (!canManage) {
    return (
      <div>
        <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Présences réelles</h1>
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Réservé aux coachs et administrateurs.</p></div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Présences réelles</h1>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="info-box">{notice}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Séance</label>
          <select value={selectedEventId ?? ""} onChange={(e) => setSelectedEventId(Number(e.target.value))}>
            {events?.map((e) => (
              <option key={e.id} value={e.id}>
                {(EVENT_TYPES[e.type] ?? EVENT_TYPES.match).icon} {e.title} — {fmtDate(e.starts_at)} {fmtTime(e.starts_at)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {candidates === null && <div className="spinner" />}

      {candidates !== null && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Qui était réellement présent ({presentCount})</div>
          {candidates.length === 0 && (
            <p className="subtle">Aucune dispo ni convocation enregistrée pour cette séance — ajoute des joueurs manuellement ci-dessous.</p>
          )}
          {candidates.map((c) => (
            <div key={c.club_member_id} className="list-row" style={{ flexWrap: "wrap" }}>
              <strong>{c.name}</strong>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {Object.entries(REAL_STATUS_LABELS).map(([v, l]) => (
                  <button
                    key={v}
                    className={`btn btn-sm ${statuses[c.club_member_id] === v ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setStatus(c.club_member_id, v)}
                  >{l}</button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <select style={{ flex: 1, minWidth: 180 }} value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)}>
              <option value="">+ Ajouter un membre…</option>
              {availableToAdd.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={addMember} disabled={!addMemberId}>Ajouter</button>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer les présences"}
          </button>
          <button
            className="btn btn-secondary" style={{ marginTop: 8 }}
            onClick={() => downloadCsv(
              `presences-${events.find((e) => e.id === selectedEventId)?.title ?? selectedEventId}.csv`,
              [["Joueur", "Statut réel"], ...candidates.map((c) => [c.name, REAL_STATUS_LABELS[statuses[c.club_member_id]] ?? "Non renseigné"])]
            )}
          >Exporter en CSV</button>
        </div>
      )}

      {presentCount > 0 && (
        <div className="card">
          <div className="label-title">Session de vote</div>
          {!session?.session && (
            <>
              <p className="subtle">Les votes ne sont pas encore ouverts pour cette séance.</p>
              <button className="btn btn-primary" onClick={openVotes}>Ouvrir les votes</button>
            </>
          )}
          {session?.session?.status === "open" && (
            <>
              <p className="subtle">{session.submitted_count} / {session.present_count} ont validé leur vote.</p>
              {session.participants.map((p) => (
                <div key={p.club_member_id} className="list-row">
                  <span>{p.name}</span>
                  <span className={`badge ${p.submitted ? "badge-info" : "badge-neutral"}`}>{p.submitted ? "Voté" : "En attente"}</span>
                </div>
              ))}
              <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={closeVotes}>Clôturer les votes</button>
            </>
          )}
          {session?.session?.status === "closed" && (
            <p className="subtle" style={{ margin: 0 }}>Votes clôturés — {session.submitted_count} / {session.present_count} avaient voté. Résultats disponibles dans Classements.</p>
          )}
        </div>
      )}
    </div>
  );
}
