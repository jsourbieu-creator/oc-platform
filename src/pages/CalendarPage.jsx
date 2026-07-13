import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, AVAIL_LABELS, AVAIL_COLORS, CONV_LABELS, fmtDate, fmtTime, fmtMonthKey, isPast, canManageEvents } from "@/lib/events";
import { DateBadge, AvatarStack } from "@/components/ui";

export function CalendarPage() {
  const { token, activeClubId } = useAuth();
  const [events, setEvents] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token)
      .then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const visible = events?.filter((e) => showPast || !isPast(e.starts_at)) ?? [];
  const grouped = [];
  let currentMonth = null;
  for (const e of visible) {
    const key = fmtMonthKey(e.starts_at);
    if (key !== currentMonth) { grouped.push({ month: key, items: [] }); currentMonth = key; }
    grouped[grouped.length - 1].items.push(e);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: "1.9rem" }}>Calendrier</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Masquer le passé" : "Voir le passé"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}

      {events === null && <div className="spinner" />}
      {events !== null && visible.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucun événement {showPast ? "" : "à venir"}. La création se fait dans la section Événements.</p></div>
      )}

      {grouped.map((g) => (
        <div key={g.month} style={{ marginBottom: 18 }}>
          <div className="label-title" style={{ textTransform: "capitalize" }}>{g.month}</div>
          {g.items.map((e) => (
            <EventCard key={e.id} event={e} open={openId === e.id} toggle={() => setOpenId(openId === e.id ? null : e.id)} reload={load} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EventCard({ event: e, open, toggle, reload }) {
  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
  const cancelled = e.status === "cancelled";
  const availableCount = e.avail_counts?.present ?? 0;
  const confirmedCount = e.conv_counts?.confirmed ?? 0;
  const convokedTotal = Object.values(e.conv_counts ?? {}).reduce((a, b) => a + b, 0);
  const confirmedPeople = (e.confirmed_names ?? []).map((name) => ({ name }));

  return (
    <div className="card" style={{ marginBottom: 10, padding: 16, opacity: cancelled ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: 12, cursor: "pointer" }} onClick={toggle}>
        <DateBadge date={e.starts_at} color={cancelled ? "var(--neutral-400)" : t.color} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>{t.icon} {e.title}</strong>
              {cancelled && <span className="badge badge-neutral">Annulé</span>}
              {e.team_name && <span className="badge badge-info">{e.team_name}</span>}
            </div>
            <div className="subtle">
              {fmtTime(e.starts_at)}{e.ends_at ? ` → ${fmtTime(e.ends_at)}` : ""}
              {e.location ? ` — ${e.location}` : ""}
              {e.opponent ? ` — vs ${e.opponent}` : ""}
            </div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {availableCount > 0 && <>✅ {availableCount} présent{availableCount > 1 ? "s" : ""} </>}
              {convokedTotal > 0 && <>📋 {confirmedCount}/{convokedTotal} confirmé{confirmedCount > 1 ? "s" : ""}</>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <AvatarStack people={confirmedPeople} />
            <span className="subtle">{open ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>
      {open && <EventDetail event={e} reload={reload} />}
    </div>
  );
}

function EventDetail({ event: e, reload }) {
  const { token, activeClubId, activeRole } = useAuth();
  const manage = canManageEvents(activeRole);
  const cancelled = e.status === "cancelled";
  const [error, setError] = useState("");
  const [availList, setAvailList] = useState(null);
  const [showAvail, setShowAvail] = useState(false);

  const setAvail = async (status) => {
    setError("");
    try {
      await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, status }, token);
      reload();
      if (showAvail) loadAvail();
    } catch (e2) { setError(e2.message); }
  };

  const loadAvail = useCallback(() => {
    api("events.php", "availability_list", { club_id: activeClubId, event_id: e.id }, token)
      .then((d) => setAvailList(d.availabilities)).catch((e2) => setError(e2.message));
  }, [activeClubId, e.id, token]);

  const respond = async (status) => {
    setError("");
    try {
      await api("events.php", "convocation_respond", { club_id: activeClubId, event_id: e.id, status }, token);
      reload();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      {error && <div className="error-box">{error}</div>}

      {(e.meet_at || e.notes) && (
        <div style={{ marginBottom: 12 }}>
          {e.meet_at && <div style={{ fontSize: "0.88rem" }}>🕐 Rendez-vous à <strong>{fmtTime(e.meet_at)}</strong></div>}
          {e.notes && <div className="subtle" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{e.notes}</div>}
        </div>
      )}

      {!cancelled && !isPast(e.starts_at) && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-title">Ma disponibilité</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(AVAIL_LABELS).map(([v, l]) => {
              const active = e.my_availability === v;
              return (
                <button
                  key={v}
                  className="btn btn-sm"
                  style={{
                    background: active ? AVAIL_COLORS[v] : "transparent",
                    color: active ? "#fff" : "var(--text-dim)",
                    border: `1.5px solid ${active ? AVAIL_COLORS[v] : "var(--border)"}`,
                    opacity: active ? 1 : 0.6,
                  }}
                  onClick={() => setAvail(v)}
                >{l}</button>
              );
            })}
          </div>
        </div>
      )}

      {e.my_convocation && !cancelled && (
        <div style={{ marginBottom: 12 }}>
          <div className="label-title">Ma convocation — {CONV_LABELS[e.my_convocation]}</div>
          {!isPast(e.starts_at) && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className={`btn btn-sm ${e.my_convocation === "confirmed" ? "btn-primary" : "btn-secondary"}`} onClick={() => respond("confirmed")}>Je confirme</button>
              <button className={`btn btn-sm ${e.my_convocation === "declined" ? "btn-danger" : "btn-secondary"}`} onClick={() => respond("declined")}>Je décline</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowAvail((v) => !v); if (!showAvail) loadAvail(); }}>
          {showAvail ? "Masquer les disponibilités" : "Voir les disponibilités"}
        </button>
        {manage && <ConvocationManager event={e} reload={reload} />}
      </div>

      {showAvail && (
        <div style={{ marginTop: 10 }}>
          {availList === null && <div className="spinner" />}
          {availList?.length === 0 && <div className="subtle">Personne n'a encore répondu.</div>}
          {availList?.map((a, i) => (
            <div key={i} className="list-row" style={{ padding: "6px 0" }}>
              <span>{a.first_name} {a.last_name}{a.comment ? <span className="subtle"> — {a.comment}</span> : ""}</span>
              <span className="badge" style={{ background: AVAIL_COLORS[a.status], color: "#fff" }}>{AVAIL_LABELS[a.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConvocationManager({ event: e, reload }) {
  const { token, activeClubId } = useAuth();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [convList, setConvList] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openManager = async () => {
    setOpen((v) => !v);
    if (open) return;
    setError("");
    try {
      const [m, c] = await Promise.all([
        api("members.php", "list", { club_id: activeClubId }, token),
        api("events.php", "convocation_list", { club_id: activeClubId, event_id: e.id }, token),
      ]);
      setMembers(m.members.filter((x) => x.status === "active"));
      setConvList(c.convocations);
      setSelected(new Set(c.convocations.map((x) => x.club_member_id)));
    } catch (e2) { setError(e2.message); }
  };

  const toggleMember = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const save = async () => {
    setError(""); setBusy(true);
    try {
      await api("events.php", "convoke_set", { club_id: activeClubId, event_id: e.id, member_ids: [...selected] }, token);
      setOpen(false);
      reload();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const statusOf = (memberId) => convList?.find((c) => c.club_member_id === memberId)?.status;

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={openManager}>
        {open ? "Fermer les convocations" : "Gérer les convocations"}
      </button>
      {open && (
        <div style={{ width: "100%", marginTop: 10 }}>
          {error && <div className="error-box">{error}</div>}
          {members === null && <div className="spinner" />}
          {members?.map((m) => (
            <label key={m.id} className="list-row" style={{ padding: "6px 0", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", fontWeight: 400, color: "var(--text)", display: "flex" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleMember(m.id)} style={{ width: "auto" }} />
                {m.first_name} {m.last_name}
              </span>
              {statusOf(m.id) && <span className={`badge ${statusOf(m.id) === "confirmed" ? "badge-info" : "badge-neutral"}`}>{CONV_LABELS[statusOf(m.id)]}</span>}
            </label>
          ))}
          {members && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={save}>
              {busy ? "Enregistrement…" : `Convoquer ${selected.size} membre${selected.size > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
