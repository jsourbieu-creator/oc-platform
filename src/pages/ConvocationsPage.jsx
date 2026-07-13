import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CONV_LABELS, fmtDate, fmtTime, isPast, EVENT_TYPES, canManageEvents } from "@/lib/events";
import { DateBadge } from "@/components/ui";

export function ConvocationsPage({ goto }) {
  const { token, activeClubId, activeRole } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token)
      .then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const respond = async (eventId, status) => {
    setError("");
    try {
      await api("events.php", "convocation_respond", { club_id: activeClubId, event_id: eventId, status }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const mine = events?.filter((e) => e.my_convocation && e.status !== "cancelled") ?? [];
  const upcoming = mine.filter((e) => !isPast(e.starts_at));
  const past = mine.filter((e) => isPast(e.starts_at)).reverse();

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Convocations</h1>
      {error && <div className="error-box">{error}</div>}
      {events === null && <div className="spinner" />}

      {events !== null && mine.length === 0 && (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>
            Tu n'as aucune convocation pour le moment.
            {canManageEvents(activeRole) && (
              <> Pour convoquer des joueurs, ouvre un événement dans le <span style={{ color: "var(--oc-blue-600)", cursor: "pointer", fontWeight: 700 }} onClick={() => goto?.("calendrier")}>Calendrier</span> → « Gérer les convocations ».</>
            )}
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">À venir ({upcoming.length})</div>
          {upcoming.map((e) => (
            <div key={e.id} className="event-row" style={{ flexWrap: "wrap" }}>
              <DateBadge date={e.starts_at} color={(EVENT_TYPES[e.type] ?? EVENT_TYPES.match).color} />
              <div className="event-row-body">
                <strong>{(EVENT_TYPES[e.type] ?? EVENT_TYPES.match).icon} {e.title}</strong>
                <span className={`badge ${e.my_convocation === "confirmed" ? "badge-info" : "badge-neutral"}`} style={{ marginLeft: 8 }}>{CONV_LABELS[e.my_convocation]}</span>
                <div className="subtle">
                  {fmtTime(e.starts_at)}
                  {e.meet_at ? ` — RDV ${fmtTime(e.meet_at)}` : ""}
                  {e.location ? ` — ${e.location}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className={`btn btn-sm ${e.my_convocation === "confirmed" ? "btn-primary" : "btn-secondary"}`} onClick={() => respond(e.id, "confirmed")}>Je confirme</button>
                  <button className={`btn btn-sm ${e.my_convocation === "declined" ? "btn-danger" : "btn-secondary"}`} onClick={() => respond(e.id, "declined")}>Je décline</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="card">
          <div className="label-title">Passées</div>
          {past.map((e) => (
            <div key={e.id} className="list-row">
              <div>
                <strong>{e.title}</strong>
                <div className="subtle" style={{ textTransform: "capitalize" }}>{fmtDate(e.starts_at)}</div>
              </div>
              <span className="badge badge-neutral">{CONV_LABELS[e.my_convocation]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
