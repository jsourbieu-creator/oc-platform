import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime, isPast, toLocalInput, fromLocalInput, canManageEvents } from "@/lib/events";

const EMPTY = { type: "match", title: "", opponent: "", location: "", starts_at: "", meet_at: "", notes: "", team_id: "" };

export function EventsPage({ goto }) {
  const { token, activeClubId, activeRole } = useAuth();
  const manage = canManageEvents(activeRole);

  const [events, setEvents] = useState(null);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(null); // null | {..., event_id?}
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch(() => {});
  }, [activeClubId, token]);

  useEffect(load, [load]);

  if (!manage) {
    return (
      <div>
        <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Événements</h1>
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>
            La création d'événements est réservée aux entraîneurs et
            administrateurs. Consulte le <span style={{ color: "var(--oc-blue-600)", cursor: "pointer", fontWeight: 700 }} onClick={() => goto?.("calendrier")}>Calendrier</span> pour
            voir les événements et indiquer tes disponibilités.
          </p>
        </div>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const payload = {
      club_id: activeClubId,
      type: form.type,
      title: form.title,
      opponent: form.opponent,
      location: form.location,
      starts_at: fromLocalInput(form.starts_at),
      meet_at: fromLocalInput(form.meet_at),
      notes: form.notes,
      team_id: form.team_id ? Number(form.team_id) : 0,
    };
    try {
      if (form.event_id) {
        await api("events.php", "update", { ...payload, event_id: form.event_id }, token);
      } else {
        await api("events.php", "create", payload, token);
      }
      setForm(null);
      load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const edit = (ev) => setForm({
    event_id: ev.id, type: ev.type, title: ev.title, opponent: ev.opponent ?? "",
    location: ev.location ?? "", starts_at: toLocalInput(ev.starts_at),
    meet_at: toLocalInput(ev.meet_at), notes: ev.notes ?? "", team_id: ev.team_id ?? "",
  });

  const setStatus = async (eventId, status) => {
    setError("");
    try {
      await api("events.php", "set_status", { club_id: activeClubId, event_id: eventId, status }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const remove = async (eventId) => {
    if (!confirm("Supprimer définitivement cet événement (dispos et convocations comprises) ? Pour un simple report, préfère « Annuler ».")) return;
    setError("");
    try {
      await api("events.php", "delete", { club_id: activeClubId, event_id: eventId }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const upcoming = events?.filter((e) => !isPast(e.starts_at)) ?? [];
  const past = events?.filter((e) => isPast(e.starts_at)).reverse() ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: "1.9rem" }}>Événements</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setForm(form ? null : { ...EMPTY })}>
          {form ? "Annuler" : "+ Nouvel événement"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">{form.event_id ? "Modifier l'événement" : "Nouvel événement"}</div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {Object.entries(EVENT_TYPES).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Équipe (optionnel)</label>
                <select value={form.team_id} onChange={(e) => set("team_id", e.target.value)}>
                  <option value="">Tout le club</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Titre</label><input type="text" required placeholder="Match de championnat J5" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
            {form.type === "match" && (
              <div className="field"><label>Adversaire</label><input type="text" placeholder="FC Exemple" value={form.opponent} onChange={(e) => set("opponent", e.target.value)} /></div>
            )}
            <div className="field"><label>Lieu</label><input type="text" placeholder="Gymnase municipal" value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Début</label><input type="datetime-local" required value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div className="field"><label>Rendez-vous (optionnel)</label><input type="datetime-local" value={form.meet_at} onChange={(e) => set("meet_at", e.target.value)} /></div>
            </div>
            <div className="field"><label>Notes (optionnel)</label><input type="text" placeholder="Maillots bleus, covoiturage…" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Enregistrement…" : form.event_id ? "Enregistrer" : "Créer l'événement"}</button>
          </form>
        </div>
      )}

      <EventList title="À venir" events={upcoming} onEdit={edit} onStatus={setStatus} onDelete={remove} />
      <EventList title="Passés" events={past} onEdit={edit} onStatus={setStatus} onDelete={remove} />
    </div>
  );
}

function EventList({ title, events, onEdit, onStatus, onDelete }) {
  if (!events.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="label-title">{title} ({events.length})</div>
      {events.map((e) => {
        const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
        const cancelled = e.status === "cancelled";
        return (
          <div key={e.id} className="list-row" style={{ opacity: cancelled ? 0.55 : 1 }}>
            <div style={{ minWidth: 0 }}>
              <strong>{t.icon} {e.title}</strong>
              {cancelled && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Annulé</span>}
              {e.team_name && <span className="badge badge-info" style={{ marginLeft: 8 }}>{e.team_name}</span>}
              <div className="subtle" style={{ textTransform: "capitalize" }}>{fmtDate(e.starts_at)} à {fmtTime(e.starts_at)}{e.location ? ` — ${e.location}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e)}>Modifier</button>
              {cancelled
                ? <button className="btn btn-ghost btn-sm" onClick={() => onStatus(e.id, "scheduled")}>Rétablir</button>
                : <button className="btn btn-ghost btn-sm" style={{ color: "var(--warning-600)" }} onClick={() => onStatus(e.id, "cancelled")}>Annuler</button>}
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={() => onDelete(e.id)}>Suppr.</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
