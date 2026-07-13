import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AVAIL_LABELS, AVAIL_COLORS, fmtDate, fmtTime, isPast, EVENT_TYPES } from "@/lib/events";
import { DateBadge } from "@/components/ui";

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
    <div className="event-row" style={{ flexWrap: "wrap" }}>
      <DateBadge date={e.starts_at} color={t.color} />
      <div className="event-row-body">
        <strong>{t.icon} {e.title}</strong>
        {e.team_name && <span className="badge badge-info" style={{ marginLeft: 8 }}>{e.team_name}</span>}
        <div className="subtle">{fmtTime(e.starts_at)}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(AVAIL_LABELS).map(([v, l]) => {
            const active = e.my_availability === v;
            return (
              <button
                key={v}
                onClick={() => setAvail(e.id, v)}
                style={{
                  flex: "1 1 90px", padding: "12px 10px", borderRadius: "var(--radius-sm)",
                  fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
                  background: active ? AVAIL_COLORS[v] : "transparent",
                  color: active ? "#fff" : "var(--text-dim)",
                  border: `1.5px solid ${active ? AVAIL_COLORS[v] : "var(--border)"}`,
                  opacity: active ? 1 : 0.55,
                  transition: "opacity .12s ease, background .12s ease",
                }}
              >{l}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
