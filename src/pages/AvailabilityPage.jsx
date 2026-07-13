import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AVAIL_LABELS, fmtDate, fmtTime, isPast, EVENT_TYPES } from "@/lib/events";

export function AvailabilityPage() {
  const { token, activeClubId } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token)
      .then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const setAvail = async (eventId, status) => {
    setError("");
    try {
      await api("events.php", "availability_set", { club_id: activeClubId, event_id: eventId, status }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const upcoming = events?.filter((e) => !isPast(e.starts_at) && e.status !== "cancelled") ?? [];
  const pending = upcoming.filter((e) => !e.my_availability);
  const answered = upcoming.filter((e) => e.my_availability);

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Disponibilités</h1>
      {error && <div className="error-box">{error}</div>}
      {events === null && <div className="spinner" />}

      {events !== null && upcoming.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucun événement à venir pour le moment.</p></div>
      )}

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">À renseigner ({pending.length})</div>
          {pending.map((e) => <Row key={e.id} event={e} setAvail={setAvail} />)}
        </div>
      )}

      {answered.length > 0 && (
        <div className="card">
          <div className="label-title">Mes réponses</div>
          {answered.map((e) => <Row key={e.id} event={e} setAvail={setAvail} />)}
        </div>
      )}
    </div>
  );
}

function Row({ event: e, setAvail }) {
  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
  return (
    <div className="list-row" style={{ flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <strong>{t.icon} {e.title}</strong>
        {e.team_name && <span className="badge badge-info" style={{ marginLeft: 8 }}>{e.team_name}</span>}
        <div className="subtle" style={{ textTransform: "capitalize" }}>{fmtDate(e.starts_at)} à {fmtTime(e.starts_at)}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {Object.entries(AVAIL_LABELS).map(([v, l]) => (
          <button
            key={v}
            className={`btn btn-sm ${e.my_availability === v ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setAvail(e.id, v)}
          >{l}</button>
        ))}
      </div>
    </div>
  );
}
