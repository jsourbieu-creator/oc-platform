import { createPortal } from "react-dom";
import { Calendar3, CaretLeft, CaretRight, GeoAlt, Star, Shield, ArrowCounterclockwise, X, ClipboardCheck, Clock, Flag, People, ThreeDots, ChatDots, Search, Check, Trophy, Activity } from "react-bootstrap-icons";
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  EVENT_TYPES, AVAIL_LABELS, AVAIL_COLORS, AVAIL_FILL, AVAIL_INK, CONV_LABELS,
  fmtTime, fmtMonthKey, isPast, toLocalInput, fromLocalInput, canManageEvents, timeAgo,
} from "@/lib/events";
import { REAL_STATUS_LABELS, fmtScore } from "@/lib/ballondor";
import { DateBadge, AvatarStack, StatTile, CountChip, Avatar } from "@/components/ui";

const EMPTY_FORM = { type: "match", title: "", opponent: "", location: "", starts_at: "", ends_at: "", meet_at: "", notes: "", team_id: "", repeat_weekly: false, repeat_until: "" };

/**
 * Salutation qui change chaque jour — courte, familière, ton vestiaire entre
 * potes plutôt que grandiloquent. Une phrase par jour (stable, pas de
 * flicker au rechargement).
 */
function greeting(firstName) {
  const n = firstName || "champion";
  const phrases = [
    (n) => `Bonjour ${n}`,
    (n) => `Chaud pour un foot, ${n} ?`,
    (n) => `Salut ${n}, prêt ?`,
    (n) => `${n}, on chauffe ?`,
    (n) => `Alors ${n}, en forme ?`,
    (n) => `Hello ${n}`,
    (n) => `${n}, la forme ?`,
    (n) => `On y va, ${n} ?`,
    (n) => `Re ${n}`,
    (n) => `${n}, prêt à jouer ?`,
    (n) => `Yo ${n}`,
    (n) => `${n}, ça sent le but`,
    (n) => `Debout ${n}, on joue`,
    (n) => `${n}, direction le gymnase`,
  ];
  const dayIndex = Math.floor(Date.now() / 86400000);
  return phrases[dayIndex % phrases.length](n);
}

export function HomePage({ gotoConversation }) {
  const { user, token, activeClubId, memberships, activeRole } = useAuth();
  const manage = canManageEvents(activeRole);

  const [seasons, setSeasons] = useState(null);
  const [teams, setTeams] = useState(null);
  const [members, setMembers] = useState(null);
  const [events, setEvents] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [scope, setScope] = useState("upcoming"); // upcoming | month
  const [gridMonth, setGridMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null); // "YYYY-MM-DD" ou null
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [myScore, setMyScore] = useState(undefined); // undefined=chargement, null=pas classé, objet sinon

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  // Mon score Ballon d'Or : dérivé du classement de la saison active
  useEffect(() => {
    if (!activeClubId || !token || !user || seasons === null) return;
    let alive = true;
    const active = seasons.find((s) => s.status === "active");
    if (!active) { setMyScore(null); return; }
    api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: active.id }, token)
      .then((r) => {
        if (!alive) return;
        const full = `${user.first_name} ${user.last_name}`.trim().toLowerCase();
        const all = [...(r.official ?? []), ...(r.provisional ?? [])];
        const mine = all.find((p) => (p.name ?? "").trim().toLowerCase() === full);
        setMyScore(mine ?? null);
      })
      .catch(() => { if (alive) setMyScore(null); });
    return () => { alive = false; };
  }, [activeClubId, token, user, seasons]);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => setSeasons(d.seasons)).catch(() => setSeasons([]));
    api("teams.php", "list", { club_id: activeClubId }, token).then((d) => setTeams(d.teams)).catch(() => setTeams([]));
    api("members.php", "list", { club_id: activeClubId }, token).then((d) => setMembers(d.members.filter((m) => m.status === "active"))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const payload = {
      club_id: activeClubId, type: form.type, title: form.title, opponent: form.opponent,
      location: form.location, starts_at: fromLocalInput(form.starts_at), ends_at: fromLocalInput(form.ends_at),
      meet_at: fromLocalInput(form.meet_at), repeat_weekly: !form.event_id && form.repeat_weekly,
      repeat_until: form.repeat_until, notes: form.notes, team_id: form.team_id ? Number(form.team_id) : 0,
    };
    try {
      if (form.event_id) await api("events.php", "update", { ...payload, event_id: form.event_id }, token);
      else await api("events.php", "create", payload, token);
      setForm(null);
      load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const edit = (ev) => setForm({
    event_id: ev.id, type: ev.type, title: ev.title, opponent: ev.opponent ?? "",
    location: ev.location ?? "", starts_at: toLocalInput(ev.starts_at), ends_at: toLocalInput(ev.ends_at),
    meet_at: toLocalInput(ev.meet_at), notes: ev.notes ?? "", team_id: ev.team_id ?? "", repeat_weekly: false, repeat_until: "",
  });

  const setStatus = async (eventId, status) => {
    setError("");
    try { await api("events.php", "set_status", { club_id: activeClubId, event_id: eventId, status }, token); load(); }
    catch (e2) { setError(e2.message); }
  };

  const remove = async (eventId) => {
    if (!confirm("Supprimer définitivement cet événement (dispos, convocations et votes compris) ? Pour un simple report, préfère « Annuler ».")) return;
    setError("");
    try { await api("events.php", "delete", { club_id: activeClubId, event_id: eventId }, token); load(); }
    catch (e2) { setError(e2.message); }
  };

  const club = memberships.find((m) => m.club_id === activeClubId);
  const activeSeason = seasons?.find((s) => s.status === "active");
  const nextEvent = events?.filter((e) => !isPast(e.starts_at) && e.status !== "cancelled")?.[0];

  const now = new Date();
  const viewingOtherMonth = scope === "month" && (gridMonth.getFullYear() !== now.getFullYear() || gridMonth.getMonth() !== now.getMonth());
  const inScope = (dateStr) => {
    const d = new Date(dateStr.replace(" ", "T"));
    if (scope === "upcoming") return true;
    if (scope === "month") return d.getFullYear() === gridMonth.getFullYear() && d.getMonth() === gridMonth.getMonth();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - dow);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
  };
  const visible = (events ?? []).filter((e) => (showPast || viewingOtherMonth || !isPast(e.starts_at)) && inScope(e.starts_at) && (!selectedDay || e.starts_at.slice(0, 10) === selectedDay));

  const grouped = [];
  let currentMonth = null;
  for (const e of visible) {
    const key = fmtMonthKey(e.starts_at);
    if (key !== currentMonth) { grouped.push({ month: key, items: [] }); currentMonth = key; }
    grouped[grouped.length - 1].items.push(e);
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
          {club?.club_name}{activeSeason ? ` · ${activeSeason.name}` : ""}
        </div>
        <h1 className="page-title" style={{ marginTop: 2 }}>{greeting(user?.first_name)}</h1>
      </div>

      <NextSessionCard
        event={nextEvent}
        loading={nextEvent === undefined}
        hasSeason={seasons !== null && seasons.length > 0}
        manage={manage}
        onCreate={() => setForm({ ...EMPTY_FORM })}
        onOpen={() => { if (nextEvent) { setScope("upcoming"); setSelectedDay(null); setOpenId(nextEvent.id); } }}
        onSetAvailability={async (eventId, status) => {
          setError("");
          try { await api("events.php", "availability_set", { club_id: activeClubId, event_id: eventId, status }, token); load(); }
          catch (e2) { setError(e2.message); }
        }}
      />

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi solid-coral">
          <Trophy size={18} style={{ opacity: 0.55, marginBottom: 8 }} />
          <b>{myScore === undefined ? "…" : myScore ? fmtScore(myScore.ballon_dor_score) : "—"}</b>
          <span>{myScore ? "Ballon d'Or" : "Pas classé"}</span>
        </div>
        <div className="kpi solid-lime">
          <Activity size={18} style={{ opacity: 0.55, marginBottom: 8 }} />
          <b>{myScore === undefined ? "…" : myScore ? `${myScore.attendance_rate}%` : "—"}</b>
          <span>Ma présence</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div className="segmented">
          {[["upcoming", "À venir"], ["month", "Mois"]].map(([v, l]) => (
            <button key={v} className={scope === v ? "active" : ""} onClick={() => { setScope(v); setSelectedDay(null); }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          title={showPast ? "Masquer le passé" : "Voir le passé"}
          onClick={() => setShowPast((v) => !v)}
          style={{
            width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer", boxShadow: "var(--shadow-xs)",
            background: showPast ? "var(--oc-sky-100)" : "var(--surface)", color: showPast ? "var(--oc-sky-700)" : "var(--muted)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        ><ArrowCounterclockwise size={17} /></button>
        {manage && (
          <button
            title={form ? "Annuler" : "Ajouter une séance"}
            onClick={() => setForm(form ? null : { ...EMPTY_FORM })}
            style={{
              width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer",
              background: form ? "var(--oc-red-50)" : "var(--hero-sky)", color: form ? "var(--oc-red-700)" : "var(--hero-ink)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: form ? "none" : "0 8px 18px rgba(143,211,238,.35)", fontSize: "1.3rem", fontWeight: 700,
              transition: ".2s var(--ease-spring)",
            }}
          >{form ? <X size={18} /> : "+"}</button>
        )}
      </div>

      {scope === "month" && (
        <MonthGrid
          events={events}
          month={gridMonth}
          onPrev={() => { setSelectedDay(null); setGridMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }}
          onNext={() => { setSelectedDay(null); setGridMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }}
          selectedDay={selectedDay}
          onSelect={setSelectedDay}
        />
      )}

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
                  {teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
              <div className="field"><label>Fin (optionnel)</label><input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></div>
            </div>
            <div className="field"><label>Rendez-vous (optionnel)</label><input type="datetime-local" value={form.meet_at} onChange={(e) => set("meet_at", e.target.value)} /></div>
            {!form.event_id && (
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", color: "var(--text)", marginBottom: form.repeat_weekly ? 10 : 0, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.repeat_weekly} onChange={(e) => set("repeat_weekly", e.target.checked)} style={{ width: "auto" }} />
                  Répéter chaque semaine (même jour, même heure)
                </label>
                {form.repeat_weekly && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Jusqu'au (inclus)</label>
                    <input type="date" required value={form.repeat_until} onChange={(e) => set("repeat_until", e.target.value)} />
                  </div>
                )}
              </div>
            )}
            <div className="field"><label>Notes (optionnel)</label><input type="text" placeholder="Maillots bleus, covoiturage…" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Enregistrement…" : form.event_id ? "Enregistrer" : "Créer l'événement"}</button>
          </form>
        </div>
      )}

      {events === null && <div className="spinner" />}
      {events !== null && visible.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucun événement {showPast ? "" : "à venir"}.</p></div>
      )}

      {grouped.map((g) => (
        <div key={g.month} style={{ marginBottom: 18 }}>
          <div className="label-title" style={{ textTransform: "capitalize" }}>{g.month}</div>
          {g.items.map((e) => (
            <EventAccordionCard
              key={e.id} event={e} open={openId === e.id} toggle={() => setOpenId(openId === e.id ? null : e.id)}
              reload={load} manage={manage} members={members} onEdit={edit} onStatus={setStatus} onDelete={remove}
              gotoConversation={gotoConversation}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function NextSessionCard({ event: e, loading, hasSeason, manage, onCreate, onOpen, onSetAvailability }) {
  if (loading) return <div className="card" style={{ marginBottom: 16, height: 150 }}><div className="spinner" /></div>;

  if (!e) {
    if (!hasSeason) {
      return (
        <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "28px 20px" }}>
          <Calendar3 size={26} style={{ color: "var(--text-dim)", marginBottom: 8 }} />
          <div style={{ fontWeight: 800 }}>Bienvenue sur la plateforme !</div>
          <div className="subtle" style={{ marginTop: 2, marginBottom: manage ? 14 : 0 }}>
            {manage
              ? "Commence par créer une saison dans Paramètres → Équipes, puis ajoute ta première séance ici."
              : "Le club n'a pas encore ouvert de saison — reviens un peu plus tard."}
          </div>
        </div>
      );
    }
    return (
      <div className="card" style={{ marginBottom: 16, textAlign: "center", padding: "28px 20px" }}>
        <Calendar3 size={26} style={{ color: "var(--text-dim)", marginBottom: 8 }} />
        <div style={{ fontWeight: 800 }}>Aucune séance à venir</div>
        <div className="subtle" style={{ marginTop: 2, marginBottom: manage ? 14 : 0 }}>
          {manage ? "Ajoute un entraînement ou un match pour lancer la saison." : "Le calendrier est vide pour le moment."}
        </div>
        {manage && <button className="btn btn-primary btn-sm" style={{ width: "auto" }} onClick={onCreate}>+ Ajouter une séance</button>}
      </div>
    );
  }

  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
  const d = new Date(e.starts_at.replace(" ", "T"));
  const dayNum = d.getDate();
  const monthShort = MONTH_NAMES[d.getMonth()].slice(0, 4);
  const isCoral = e.type === "match";

  return (
    <div className={`event-card-ds${isCoral ? " orange" : ""}`} style={{ marginBottom: 16 }}>
      <div onClick={onOpen} style={{ cursor: "pointer" }}>
        <div style={{ marginBottom: 6 }}>
          <span className="kicker">
          Prochaine séance
          {(() => {
            const days = Math.ceil((new Date(e.starts_at.replace(" ", "T")) - Date.now()) / 86400000);
            if (days <= 0) return " · Aujourd'hui";
            if (days === 1) return " · Demain";
            return ` · Dans ${days} jours`;
          })()}
        </span>
        </div>

        <h3>{e.title}</h3>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", color: "var(--hero-ink)", opacity: 0.82, fontSize: "0.9rem", fontWeight: 600 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Calendar3 size={15} /> {dayNum} {monthShort} · {fmtTime(e.starts_at)}
          </span>
          {e.location && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><GeoAlt size={15} /> {e.location}</span>}
        </div>

        {e.opponent && <div style={{ marginTop: 8, fontSize: "0.88rem", fontWeight: 700 }}>vs {e.opponent}</div>}
        {e.team_name && (
          <span style={{ display: "inline-block", marginTop: 12, padding: "5px 11px", borderRadius: 999, background: "rgba(11,58,82,0.12)", fontSize: "0.72rem", fontWeight: 800 }}>
            {e.team_name}
          </span>
        )}
      </div>

      <div style={{ marginTop: 20, position: "relative", zIndex: 1 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", marginBottom: (e.present_names?.length ?? 0) > 0 || onOpen ? 14 : 0 }}
          onClick={onOpen} role="button"
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--hero-ink)", opacity: 0.65 }}>
            Qui est là
          </div>
          {(e.present_names?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AvatarStack people={e.present_names} />
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{e.avail_counts?.present ?? 0} présent{(e.avail_counts?.present ?? 0) > 1 ? "s" : ""}</span>
            </div>
          ) : (
            <span style={{ fontSize: "0.82rem", opacity: 0.65 }}>Sois le premier à répondre</span>
          )}
        </div>

        <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--hero-ink)", opacity: 0.65, marginBottom: 8 }}>
          Ma présence
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(AVAIL_LABELS).map(([v, l]) => {
            const active = e.my_availability === v;
            return (
              <button
                key={v}
                onClick={() => onSetAvailability(e.id, v)}
                style={{
                  flex: 1, border: "none", cursor: "pointer", padding: "11px 6px", borderRadius: 14,
                  fontSize: "0.8rem", fontWeight: 850, fontFamily: "inherit",
                  background: active ? AVAIL_FILL[v] : "rgba(11,58,82,0.10)",
                  color: active ? AVAIL_INK[v] : "var(--hero-ink)",
                  transform: active ? "scale(1.02)" : "none",
                  transition: ".18s var(--ease-spring)",
                }}
              >{l}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ events, month, onPrev, onNext, selectedDay, onSelect }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const todayIso = new Date().toISOString().slice(0, 10);

  // Lundi = premier jour. offset = nb de cases vides avant le 1er.
  const first = new Date(year, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  // Regroupe les événements du mois par jour (ISO)
  const byDay = {};
  for (const e of events ?? []) {
    if (e.status === "cancelled") continue;
    const iso = e.starts_at.slice(0, 10);
    if (iso.slice(0, 7) === `${year}-${String(m + 1).padStart(2, "0")}`) {
      (byDay[iso] = byDay[iso] || []).push(e);
    }
  }

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, iso, events: byDay[iso] ?? [], isToday: iso === todayIso });
  }

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onPrev} aria-label="Mois précédent"><CaretLeft size={18} /></button>
        <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "1.05rem" }}>{MONTH_NAMES[m]} {year}</div>
        <button className="btn btn-ghost btn-sm" onClick={onNext} aria-label="Mois suivant"><CaretRight size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", paddingBottom: 4 }}>{l}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`e${i}`} />;
          const active = selectedDay === c.iso;
          const types = [...new Set(c.events.map((e) => e.type))];
          const myStatus = c.events.find((e) => e.my_availability)?.my_availability;
          const respondedBg = myStatus ? AVAIL_FILL[myStatus] : null;
          const respondedInk = myStatus ? AVAIL_INK[myStatus] : null;
          return (
            <div
              key={c.iso}
              onClick={() => c.events.length ? onSelect(active ? null : c.iso) : null}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                borderRadius: 14, cursor: c.events.length ? "pointer" : "default",
                background: active ? "var(--hero-sky)" : respondedBg ?? (c.events.length ? "var(--oc-sky-50)" : "var(--oc-bluegray-50)"),
                color: active ? "var(--hero-ink)" : respondedInk ?? (c.events.length ? "var(--oc-sky-700)" : "var(--text)"),
                fontWeight: 800,
                boxShadow: c.isToday && !active ? "inset 0 0 0 100px var(--oc-sky-50)" : "none",
                transition: "background .12s ease",
              }}
            >
              <span className="num" style={{ fontSize: "0.9rem", lineHeight: 1 }}>{c.d}</span>
              {types.length > 0 && (
                <span style={{ display: "flex", gap: 2 }}>
                  {types.slice(0, 3).map((t) => (
                    <span key={t} style={{ width: 5, height: 5, borderRadius: "50%", background: active || respondedBg ? "currentColor" : (EVENT_TYPES[t] ?? EVENT_TYPES.match).color, opacity: active || respondedBg ? 0.55 : 1 }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventAccordionCard({ event: e, open, toggle, reload, manage, members, onEdit, onStatus, onDelete, gotoConversation }) {
  const { token, activeClubId } = useAuth();
  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
  const cancelled = e.status === "cancelled";
  const presentCount = e.avail_counts?.present ?? 0;
  const absentCount = e.avail_counts?.absent ?? 0;
  const injuredCount = e.avail_counts?.injured ?? 0;
  const totalMembers = members?.length ?? 0;
  const noResponseCount = Math.max(0, totalMembers - presentCount - absentCount - injuredCount);
  const confirmedCount = e.conv_counts?.confirmed ?? 0;
  const convokedTotal = Object.values(e.conv_counts ?? {}).reduce((a, b) => a + b, 0);
  const confirmedPeople = e.confirmed_names ?? [];
  const [convBusy, setConvBusy] = useState(false);

  const quickRespond = async (status) => {
    try { await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, status }, token); reload(); }
    catch (_) { /* affiché en détail si besoin */ }
  };

  const openConversation = async (ev) => {
    ev.stopPropagation();
    setConvBusy(true);
    try {
      const d = await api("events.php", "conversation_get_or_create", { club_id: activeClubId, event_id: e.id }, token);
      gotoConversation?.(d);
      reload();
    } catch (_) { /* silencieux, pas critique */ } finally { setConvBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 10, padding: 16, opacity: cancelled ? 0.6 : 1, position: "relative" }}>
      <div style={{ cursor: "pointer", display: "flex", gap: 12 }} onClick={toggle}>
        <DateBadge
          date={e.starts_at}
          color={cancelled ? "var(--neutral-400)" : e.my_availability ? AVAIL_FILL[e.my_availability] : t.color}
          ink={!cancelled && e.my_availability ? AVAIL_INK[e.my_availability] : "var(--hero-ink)"}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>{e.title}</strong>
            {cancelled && <span className="badge badge-neutral">Annulé</span>}
            {e.team_name && <span className="badge badge-info">{e.team_name}</span>}
          </div>
          <div className="subtle">
            {fmtTime(e.starts_at)}{e.ends_at ? ` → ${fmtTime(e.ends_at)}` : ""}
            {e.location ? ` — ${e.location}` : ""}{e.opponent ? ` — vs ${e.opponent}` : ""}
          </div>
        </div>
        <ThreeDots size={17} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <CountChip value={presentCount} tint="green" />
          <CountChip value={absentCount} tint="orange" />
          <CountChip value={injuredCount} tint="violet" />
          <CountChip value={noResponseCount} tint="gray" />
        </div>
        <AvatarStack people={confirmedPeople} />
      </div>

      {!cancelled && !isPast(e.starts_at) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {Object.entries(AVAIL_LABELS).map(([v, l]) => {
            const active = e.my_availability === v;
            return (
              <button
                key={v} className="btn btn-sm" style={{
                  flex: "1 1 80px", background: active ? AVAIL_FILL[v] : `color-mix(in srgb, ${AVAIL_FILL[v]} 20%, transparent)`, color: active ? AVAIL_INK[v] : AVAIL_COLORS[v],
                }}
                onClick={(ev) => { ev.stopPropagation(); quickRespond(v); }}
              >{l}</button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto" }} onClick={openConversation} disabled={convBusy}>
          <ChatDots size={15} /> {e.conversation_id ? "Discussion de la séance" : "Créer la discussion"}
        </button>
      </div>

      {e.type === "match" && convokedTotal > 0 && (
        <div className="subtle" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}><ClipboardCheck size={13} />{confirmedCount}/{convokedTotal} confirmé{confirmedCount > 1 ? "s" : ""} à la convocation</div>
      )}

      <div style={{ textAlign: "center", marginTop: 6 }}>
        <span className="subtle" style={{ cursor: "pointer" }} onClick={toggle}>Voir tous les détails</span>
      </div>

      {open && (
        <EventModal event={e} onClose={toggle} reload={reload} manage={manage} members={members} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />
      )}
    </div>
  );
}

function MenuItem({ children, onClick, color }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: "10px 14px", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", color: color ?? "var(--text)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >{children}</div>
  );
}

/** Modal plein écran façon TeamPulse : en-tête + onglets Informations/Participants */
function EventModal({ event: e, onClose, reload, manage, members, onEdit, onStatus, onDelete }) {
  const { token, activeClubId } = useAuth();
  const [tab, setTab] = useState("participants");
  const [menuOpen, setMenuOpen] = useState(false);
  const cancelled = e.status === "cancelled";
  const canRespond = !cancelled && !isPast(e.starts_at);

  const setMyAvailability = async (status) => {
    try { await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, status }, token); reload(); }
    catch (_) { /* affiché en détail si besoin */ }
  };

  return createPortal(
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="event-modal-header">
          <button className="event-modal-close" onClick={onClose}><X size={17} /></button>
          <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: "1.05rem" }}>{e.title}</strong>
            <div className="subtle" style={{ textTransform: "capitalize" }}>{fmtDateBadgeLabel(e)} à {fmtTime(e.starts_at)}</div>
          </div>
          {manage ? (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button className="event-modal-close" onClick={() => setMenuOpen((v) => !v)}><ThreeDots size={17} /></button>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "100%", background: "var(--surface)", border: "none",
                  borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)", zIndex: 10, minWidth: 140, overflow: "hidden",
                }}>
                  <MenuItem onClick={() => { setMenuOpen(false); onClose(); onEdit(e); }}>Modifier</MenuItem>
                  {cancelled
                    ? <MenuItem onClick={() => { setMenuOpen(false); onStatus(e.id, "scheduled"); }}>Rétablir</MenuItem>
                    : <MenuItem color="var(--warning-600)" onClick={() => { setMenuOpen(false); onStatus(e.id, "cancelled"); }}>Annuler</MenuItem>}
                  <MenuItem color="var(--danger-600)" onClick={() => { setMenuOpen(false); onClose(); onDelete(e.id); }}>Supprimer</MenuItem>
                </div>
              )}
            </div>
          ) : <div style={{ width: 34 }} />}
        </div>

        {canRespond && (
          <div style={{ marginBottom: 18 }}>
            <div className="label-title" style={{ marginBottom: 8 }}>Ma présence</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(AVAIL_LABELS).map(([v, l]) => {
                const active = e.my_availability === v;
                return (
                  <button
                    key={v} className="btn btn-sm" style={{
                      flex: "1 1 80px", background: active ? AVAIL_FILL[v] : `color-mix(in srgb, ${AVAIL_FILL[v]} 18%, transparent)`, color: active ? AVAIL_INK[v] : AVAIL_COLORS[v],
                    }}
                    onClick={() => setMyAvailability(v)}
                  >{l}</button>
                );
              })}
            </div>
          </div>
        )}

        <div className="tab-switch">
          <div className={`tab-switch-item ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}>Qui est là</div>
          <div className={`tab-switch-item ${tab === "infos" ? "active" : ""}`} onClick={() => setTab("infos")}>Détails</div>
        </div>

        {tab === "infos" && <InfosTab event={e} reload={reload} manage={manage} members={members} />}
        {tab === "participants" && <ParticipantsTab event={e} manage={manage} />}
      </div>
    </div>
  , document.body);
}

function fmtDateBadgeLabel(e) {
  const d = new Date(e.starts_at.replace(" ", "T"));
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function InfosTab({ event: e, reload, manage, members }) {
  const cancelled = e.status === "cancelled";
  return (
    <div>
      {(e.meet_at || e.notes || e.location) && (
        <div className="card" style={{ marginBottom: 14, boxShadow: "none" }}>
          {e.meet_at && <div style={{ fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6, marginBottom: e.notes || e.location ? 8 : 0 }}><Clock size={13} />Rendez-vous à <strong>{fmtTime(e.meet_at)}</strong></div>}
          {e.location && <div className="subtle" style={{ marginBottom: e.notes ? 8 : 0 }}>{e.location}</div>}
          {e.notes && <div className="subtle" style={{ whiteSpace: "pre-wrap" }}>{e.notes}</div>}
        </div>
      )}

      {!cancelled && !isPast(e.starts_at) && e.my_availability && (
        <CommentEditor event={e} reload={reload} />
      )}

      {manage && e.type === "match" && !cancelled && <ConvocationManager event={e} reload={reload} members={members} />}

      {manage && !cancelled && <PresenceValidator event={e} members={members} />}
    </div>
  );
}

function ParticipantsTab({ event: e, manage }) {
  const { token, activeClubId } = useAuth();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("events.php", "availability_list", { club_id: activeClubId, event_id: e.id }, token)
      .then((d) => setList(d.availabilities)).catch((e2) => setError(e2.message));
  }, [activeClubId, e.id, token]);

  useEffect(load, [load]);

  const setFor = async (memberId, status) => {
    setError("");
    try {
      await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, target_member_id: memberId, status }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  if (list === null) return <div className="spinner" />;

  const q = search.trim().toLowerCase();
  const filtered = q ? list.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) : list;
  const responded = list.filter((p) => p.status).length;
  const rate = list.length ? Math.round((100 * responded) / list.length) : 0;

  const SECTIONS = [
    { key: "present", label: "Présents" },
    { key: "injured", label: "Blessés" },
    { key: "absent", label: "Absents" },
    { key: null, label: "En attente" },
  ];

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-dim)" }} />
        <input type="text" placeholder="Rechercher…" value={search} onChange={(e2) => setSearch(e2.target.value)} style={{ paddingLeft: 36 }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
          <span className="subtle">Taux de réponse</span>
          <span className="num" style={{ fontWeight: 700 }}>{responded}/{list.length}</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${rate}%` }} /></div>
      </div>

      {SECTIONS.map((sec) => {
        const items = filtered.filter((p) => p.status === sec.key);
        if (!items.length) return null;
        return (
          <div key={sec.label} style={{ marginBottom: 18 }}>
            <div className="label-title">{sec.label} ({items.length})</div>
            {items.map((p) => (
              <div key={p.club_member_id} className="participant-row">
                <Avatar name={`${p.first_name} ${p.last_name}`} userId={p.user_id} avatarUrl={p.avatar_url} size={38} />
                <div className="participant-row-body">
                  <strong style={{ fontSize: "0.9rem" }}>{p.first_name} {p.last_name}</strong>
                  {p.comment && <div className="subtle" style={{ fontSize: "0.8rem" }}>{p.comment}</div>}
                  {p.updated_at && <div className="subtle" style={{ fontSize: "0.72rem" }}>{timeAgo(p.updated_at)}</div>}
                </div>
                {editMode && manage ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {Object.entries(AVAIL_LABELS).map(([v, l]) => (
                      <button
                        key={v} className="btn btn-sm" style={{
                          width: "auto", padding: "5px 8px", fontSize: "0.68rem",
                          background: p.status === v ? AVAIL_FILL[v] : `color-mix(in srgb, ${AVAIL_FILL[v]} 20%, transparent)`, color: p.status === v ? AVAIL_INK[v] : AVAIL_COLORS[v],
                        }}
                        onClick={() => setFor(p.club_member_id, v)}
                      >{l[0]}</button>
                    ))}
                  </div>
                ) : (
                  <div className="participant-status-icon" style={{ background: sec.key ? AVAIL_COLORS[sec.key] : "var(--neutral-400)" }}>
                    {sec.key === "present" && <Check size={14} />}
                    {sec.key === "absent" && <X size={14} />}
                    {sec.key === "injured" && <span style={{ fontSize: 12 }}>!</span>}
                    {!sec.key && <Clock size={14} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {manage && (
        <div className="sticky-cta">
          <button className="btn" onClick={() => setEditMode((v) => !v)}>{editMode ? "Terminer l'édition" : "Éditer les présences"}</button>
        </div>
      )}
    </div>
  );
}

/** Petit mot facultatif accroché à sa réponse de dispo (ex. "je ramène les bières") */
function CommentEditor({ event: e, reload }) {
  const { token, activeClubId } = useAuth();
  const [value, setValue] = useState(e.my_comment ?? "");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, status: e.my_availability, comment: value }, token);
      setSaved(true);
      reload();
    } catch (_) { /* pas bloquant */ } finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label-title">Un petit mot ? (optionnel)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text" placeholder="Ex. je ramène les ballons, j'ai encore du boulot…" value={value}
          onChange={(ev) => { setValue(ev.target.value); setSaved(false); }}
          onKeyDown={(ev) => { if (ev.key === "Enter") save(); }}
        />
        <button className="btn btn-secondary btn-sm" style={{ width: "auto" }} disabled={saved || saving} onClick={save}>
          {saving ? "…" : "OK"}
        </button>
      </div>
    </div>
  );
}
function ConvocationManager({ event: e, reload, members }) {
  const { token, activeClubId } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [convList, setConvList] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openManager = async () => {
    setOpen((v) => !v);
    if (open) return;
    setError("");
    try {
      const c = await api("events.php", "convocation_list", { club_id: activeClubId, event_id: e.id }, token);
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
    <div style={{ marginBottom: 14 }}>
      <button className="btn btn-secondary btn-sm" onClick={openManager}>
        <Flag size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{open ? "Fermer les convocations" : "Gérer les convocations (match)"}
      </button>
      {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
      {open && (
        <div style={{ width: "100%", marginTop: 10 }}>
          <p className="subtle" style={{ marginTop: 0 }}>Sélectionne les joueurs convoqués pour ce match (effectif limité).</p>
          {!members && <div className="spinner" />}
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
              {busy ? "Enregistrement…" : `Convoquer ${selected.size} joueur${selected.size > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Validation de la présence réelle + session de vote — scoping automatique à cette séance */
function PresenceValidator({ event: e, members }) {
  const { token, activeClubId } = useAuth();
  const [candidates, setCandidates] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [addMemberId, setAddMemberId] = useState("");
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCandidates = useCallback(() => {
    setError(""); setNotice("");
    api("evaluations.php", "attendance_candidates", { club_id: activeClubId, event_id: e.id }, token)
      .then((d) => {
        setCandidates(d.candidates);
        const map = {};
        d.candidates.forEach((c) => { if (c.real_status) map[c.club_member_id] = c.real_status; });
        setStatuses(map);
      }).catch((err) => setError(err.message));
    api("evaluations.php", "vote_session_status", { club_id: activeClubId, event_id: e.id }, token)
      .then(setSession).catch(() => setSession(null));
  }, [activeClubId, e.id, token]);

  const toggleOpen = () => { setOpen((v) => !v); if (!open && candidates === null) loadCandidates(); };

  const setStatus = (mid, status) => setStatuses((s) => ({ ...s, [mid]: status }));

  const addMember = () => {
    if (!addMemberId || !candidates) return;
    const m = members?.find((x) => x.id === Number(addMemberId));
    if (!m || candidates.some((c) => c.club_member_id === m.id)) return;
    setCandidates([...candidates, { club_member_id: m.id, name: `${m.first_name} ${m.last_name}`, real_status: null }]);
    setAddMemberId("");
  };

  const save = async () => {
    const rows = Object.entries(statuses).map(([mid, real_status]) => ({ club_member_id: Number(mid), real_status }));
    if (!rows.length) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api("evaluations.php", "attendance_set", { club_id: activeClubId, event_id: e.id, attendances: rows }, token);
      setNotice("Présences enregistrées.");
      loadCandidates();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;

  const openVotes = async () => {
    setError(""); setNotice("");
    try { await api("evaluations.php", "vote_session_open", { club_id: activeClubId, event_id: e.id }, token); loadCandidates(); }
    catch (err) { setError(err.message); }
  };
  const closeVotes = async () => {
    setError(""); setNotice("");
    try { await api("evaluations.php", "vote_session_close", { club_id: activeClubId, event_id: e.id }, token); loadCandidates(); }
    catch (err) { setError(err.message); }
  };

  const availableToAdd = useMemo(
    () => (members ?? []).filter((m) => !candidates?.some((c) => c.club_member_id === m.id)),
    [members, candidates]
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <button className="btn btn-secondary btn-sm" onClick={toggleOpen}>
        <People size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{open ? "Fermer les présences réelles" : "Présences réelles & votes"}
      </button>
      {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
      {notice && <div className="info-box" style={{ marginTop: 8 }}>{notice}</div>}

      {open && (
        <div style={{ marginTop: 10 }}>
          {candidates === null && <div className="spinner" />}
          {candidates !== null && (
            <>
              <div className="label-title">Qui était réellement présent ({presentCount})</div>
              {candidates.length === 0 && <p className="subtle">Personne pour l'instant — ajoute des joueurs manuellement ci-dessous.</p>}
              {candidates.map((c) => (
                <div key={c.club_member_id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <strong>{c.name}</strong>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {Object.entries(REAL_STATUS_LABELS).map(([v, l]) => (
                      <button key={v} className={`btn btn-sm ${statuses[c.club_member_id] === v ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatus(c.club_member_id, v)}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <select style={{ flex: 1, minWidth: 160 }} value={addMemberId} onChange={(e2) => setAddMemberId(e2.target.value)}>
                  <option value="">+ Ajouter un membre…</option>
                  {availableToAdd.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
                <button className="btn btn-secondary" style={{ width: "auto" }} onClick={addMember} disabled={!addMemberId}>Ajouter</button>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer les présences"}
              </button>

              {presentCount > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="label-title">Session de vote</div>
                  {!session?.session && (
                    <>
                      <p className="subtle">Les votes ne sont pas encore ouverts.</p>
                      <button className="btn btn-primary btn-sm" onClick={openVotes}>Ouvrir les votes</button>
                    </>
                  )}
                  {session?.session?.status === "open" && (
                    <>
                      <p className="subtle">{session.submitted_count} / {session.present_count} ont validé leur vote.</p>
                      <button className="btn btn-danger btn-sm" onClick={closeVotes}>Clôturer les votes</button>
                    </>
                  )}
                  {session?.session?.status === "closed" && (
                    <p className="subtle" style={{ margin: 0 }}>Votes clôturés — {session.submitted_count} / {session.present_count} avaient voté.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
