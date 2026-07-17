import { createPortal } from "react-dom";
import { Calendar3, CaretLeft, CaretRight, Star, Shield, ArrowCounterclockwise, X, ClipboardCheck, Clock, Flag, People, ThreeDots, ChatDots, Search, Check, Trophy, Activity, PlusLg, Bandaid } from "react-bootstrap-icons";
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  EVENT_TYPES, AVAIL_LABELS, AVAIL_COLORS, AVAIL_FILL, AVAIL_INK, AVAIL_ICONS, AVAIL_ICON_COLORS,
  fmtTime, fmtMonthKey, isPast, toLocalInput, fromLocalInput, canManageEvents, timeAgo,
} from "@/lib/events";
import { fmtScore } from "@/lib/ballondor";
import { DateBadge, AvatarStack, StatTile, CountChip, Avatar, ScoreSlider, ScoreBar } from "@/components/ui";
import towerSvg from "@/assets/tour-blason.svg?raw";

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
        <div className="eyebrow" style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
          {club?.club_name}{activeSeason ? ` · ${activeSeason.name}` : ""}
        </div>
        <h1 className="page-title" style={{ marginTop: 2 }}>{greeting(user?.first_name)}</h1>
      </div>

      <NextSessionCard
        event={nextEvent}
        loading={nextEvent === undefined}
        hasSeason={seasons !== null && seasons.length > 0}
        manage={manage}
        members={members}
        onCreate={() => setForm({ ...EMPTY_FORM })}
        onOpen={() => { if (nextEvent) { setScope("upcoming"); setSelectedDay(null); setOpenId(nextEvent.id); } }}
        onSetAvailability={async (eventId, status) => {
          setError("");
          try { await api("events.php", "availability_set", { club_id: activeClubId, event_id: eventId, status }, token); load(); }
          catch (e2) { setError(e2.message); }
        }}
      />

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <Trophy size={18} style={{ opacity: 0.7, marginBottom: 8, color: "var(--hero-sky)" }} />
          <b>{myScore === undefined ? "…" : myScore ? fmtScore(myScore.ballon_dor_score) : "—"}</b>
          <span>{myScore ? "Ballon d'Or" : "Pas classé"}</span>
        </div>
        <div className="kpi">
          <Activity size={18} style={{ opacity: 0.7, marginBottom: 8, color: "var(--hero-sky)" }} />
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
              boxShadow: "var(--shadow-xs)",
              transition: ".2s var(--ease-spring)",
            }}
          >{form ? <X size={18} /> : <PlusLg size={18} />}</button>
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

function NextSessionCard({ event: e, loading, hasSeason, manage, members, onCreate, onOpen, onSetAvailability }) {
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
  const isMatch = e.type === "match";
  const presentCount = e.avail_counts?.present ?? 0;
  const absentCount = e.avail_counts?.absent ?? 0;
  const injuredCount = e.avail_counts?.injured ?? 0;
  const totalMembers = members?.length ?? 0;
  const noResponseCount = Math.max(0, totalMembers - presentCount - absentCount - injuredCount);
  const days = Math.ceil((new Date(e.starts_at.replace(" ", "T")) - Date.now()) / 86400000);
  const daysLabel = days <= 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16, background: t.color, color: "#fff", position: "relative", overflow: "hidden" }}>
      <div className="tower-deco-list" style={{ opacity: 0.18 }} dangerouslySetInnerHTML={{ __html: towerSvg }} />
      <div style={{ cursor: "pointer", display: "flex", gap: 12, position: "relative", zIndex: 1 }} onClick={onOpen}>
        <DateBadge date={e.starts_at} color="rgba(255,255,255,0.35)" ink="#fff" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><t.icon size={15} />{e.title}</strong>
            <span className="badge" style={{ background: "rgba(255,255,255,0.22)", color: "#fff" }}>{daysLabel}</span>
          </div>
          <div style={{ opacity: 0.85 }}>
            {fmtTime(e.starts_at)}{e.location ? ` — ${e.location}` : ""}{e.opponent ? ` — vs ${e.opponent}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, position: "relative", zIndex: 1 }}>
        <CountChip value={presentCount} tint="green" icon={Check} />
        <CountChip value={absentCount} tint="orange" icon={X} />
        <CountChip value={injuredCount} tint="coral" icon={Bandaid} />
        <CountChip value={noResponseCount} tint="gray" icon={Clock} />
      </div>
      {(e.present_names?.length ?? 0) > 0 && <div style={{ marginTop: 8, position: "relative", zIndex: 1 }}><AvatarStack people={e.present_names} /></div>}

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        {Object.entries(AVAIL_LABELS).map(([v, l]) => {
          const active = e.my_availability === v;
          const Icon = AVAIL_ICONS[v];
          return (
            <button
              key={v} className="btn btn-sm" style={{
                flex: "1 1 80px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: active ? "#fff" : "rgba(255,255,255,0.16)",
                color: active ? "#0A2340" : "#fff",
                opacity: active ? 1 : 0.85,
                border: "none",
              }}
              onClick={() => onSetAvailability(e.id, v)}
            ><Icon size={13} color={active ? AVAIL_ICON_COLORS[v] : undefined} />{l}</button>
          );
        })}
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
    <div className="card" style={{ marginBottom: 10, padding: 16, opacity: cancelled ? 0.6 : 1, position: "relative", overflow: "hidden" }}>
      {!cancelled && <div className="tower-deco-list" dangerouslySetInnerHTML={{ __html: towerSvg }} />}
      <div style={{ cursor: "pointer", display: "flex", gap: 12, position: "relative", zIndex: 1 }}>
        <DateBadge
          date={e.starts_at}
          color={cancelled ? "var(--neutral-400)" : t.color}
          ink={!cancelled && e.type === "match" ? "#fff" : "var(--hero-ink)"}
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

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <CountChip value={presentCount} tint="green" icon={Check} />
        <CountChip value={absentCount} tint="orange" icon={X} />
        <CountChip value={injuredCount} tint="coral" icon={Bandaid} />
        <CountChip value={noResponseCount} tint="gray" icon={Clock} />
      </div>
      {confirmedPeople.length > 0 && <div style={{ marginTop: 8 }}><AvatarStack people={confirmedPeople} /></div>}

      {!cancelled && !isPast(e.starts_at) && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {Object.entries(AVAIL_LABELS).map(([v, l]) => {
            const active = e.my_availability === v;
            const Icon = AVAIL_ICONS[v];
            return (
              <button
                key={v} className="btn btn-sm" style={{
                  flex: "1 1 80px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: active ? "#fff" : "transparent",
                  color: active ? "#0A2340" : "var(--text-dim)",
                  opacity: active ? 1 : 0.8,
                  border: active ? "none" : "1.5px solid var(--line)",
                }}
                onClick={(ev) => { ev.stopPropagation(); quickRespond(v); }}
              ><Icon size={13} color={active ? AVAIL_ICON_COLORS[v] : undefined} />{l}</button>
            );
          })}
        </div>
      )}

      {!cancelled && e.my_availability === "present" && hasEndedClient(e) && !e.my_vote_submitted && (
        <div
          onClick={toggle}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer",
            marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--hero-sky) 16%, transparent)",
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--hero-sky)" }}>
            🗳️ Tu n'as pas encore voté pour cette séance
          </span>
          <span className="btn btn-primary btn-sm" style={{ width: "auto", padding: "6px 14px" }}>Voter</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto" }} onClick={openConversation} disabled={convBusy}>
          <ChatDots size={15} /> {e.conversation_id ? "Discussion de la séance" : "Créer la discussion"}
        </button>
      </div>

      {e.type === "match" && convokedTotal > 0 && (
        <div className="subtle" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <ClipboardCheck size={13} />{convokedTotal} joueur{convokedTotal > 1 ? "s" : ""} convoqué{convokedTotal > 1 ? "s" : ""}
          {e.my_convocation && <span className="badge badge-info">Tu es convoqué ✓</span>}
        </div>
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
  const [tab, setTab] = useState(() => (hasEndedClient(e) && e.my_availability === "present" ? "vote" : "participants"));
  const [menuOpen, setMenuOpen] = useState(false);
  const cancelled = e.status === "cancelled";
  const canRespond = !cancelled && !isPast(e.starts_at);
  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;

  const setMyAvailability = async (status) => {
    try { await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, status }, token); reload(); }
    catch (_) { /* affiché en détail si besoin */ }
  };

  const ended = hasEndedClient(e);

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
                const Icon = AVAIL_ICONS[v];
                return (
                  <button
                    key={v} className="btn btn-sm" style={{
                      flex: "1 1 80px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      background: active ? "#fff" : "transparent",
                      color: active ? "#0A2340" : "var(--text-dim)",
                      opacity: active ? 1 : 0.8,
                      border: active ? "none" : "1.5px solid var(--line)",
                    }}
                    onClick={() => setMyAvailability(v)}
                  ><Icon size={13} color={active ? AVAIL_ICON_COLORS[v] : undefined} />{l}</button>
                );
              })}
            </div>
          </div>
        )}

        <div className="tab-switch">
          <div className={`tab-switch-item ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}>Qui est là</div>
          {!cancelled && ended && <div className={`tab-switch-item ${tab === "vote" ? "active" : ""}`} onClick={() => setTab("vote")}>Voter</div>}
          <div className={`tab-switch-item ${tab === "infos" ? "active" : ""}`} onClick={() => setTab("infos")}>Détails</div>
        </div>

        {tab === "infos" && <InfosTab event={e} reload={reload} manage={manage} members={members} />}
        {tab === "participants" && <ParticipantsTab event={e} manage={manage} />}
        {tab === "vote" && !cancelled && ended && <VoteTab event={e} />}
      </div>
    </div>
  , document.body);
}

/** Même règle que côté API : terminé à ends_at, sinon 2h après starts_at. */
function hasEndedClient(e) {
  const end = e.ends_at ? new Date(e.ends_at.replace(" ", "T")) : new Date(new Date(e.starts_at.replace(" ", "T")).getTime() + 2 * 3600 * 1000);
  return end < new Date();
}

/** Vote pour cette séance précise, directement depuis la modale (même logique que la page Votes globale). */
function VoteTab({ event: e }) {
  const { token, activeClubId } = useAuth();
  const [status, setStatus] = useState(null);
  const [scores, setScores] = useState({});
  const [selfScore, setSelfScore] = useState("");
  const [step, setStep] = useState("vote");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(() => {
    setError(""); setStep("vote"); setScores({}); setSelfScore("");
    api("evaluations.php", "vote_my_status", { club_id: activeClubId, event_id: e.id }, token)
      .then(setStatus).catch((err) => setError(err.message));
  }, [activeClubId, e.id, token]);

  useEffect(loadStatus, [loadStatus]);

  const allFilled = status?.ratees.length > 0 && status.ratees.every((r) => scores[r.club_member_id] != null) && selfScore;
  const totalToFill = (status?.ratees.length ?? 0) + 1;
  const filledCount = (status ? status.ratees.filter((r) => scores[r.club_member_id] != null).length : 0) + (selfScore ? 1 : 0);

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      await api("evaluations.php", "vote_submit", {
        club_id: activeClubId,
        event_id: e.id,
        scores: Object.entries(scores).map(([ratee_member_id, score]) => ({ ratee_member_id: Number(ratee_member_id), score: Number(score) })),
        self_score: Number(selfScore),
      }, token);
      loadStatus();
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  if (status === null) return <div className="spinner" />;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}

      {!status.eligible && (
        <p className="subtle">Tu n'étais pas présent à cette séance — rien à voter.</p>
      )}

      {status.eligible && status.submitted && (
        <div>
          <div className="label-title">Ton vote (validé) 🎉</div>
          {status.my_scores?.map((s) => (
            <ScoreBar key={s.ratee_member_id} label={s.name} value={s.score} />
          ))}
          <ScoreBar label="Mon auto-évaluation" value={status.my_self_score} highlight />
          <p className="subtle" style={{ marginTop: 10 }}>Ton vote est définitif et ne peut plus être modifié.</p>
        </div>
      )}

      {status.eligible && !status.submitted && step === "vote" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="label-title" style={{ marginBottom: 0 }}>Note tes coéquipiers présents</div>
            <span className="subtle" style={{ fontWeight: 700 }}>{filledCount}/{totalToFill}</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${(filledCount / totalToFill) * 100}%`, background: "var(--lime-600)", transition: "width .2s ease", borderRadius: 999 }} />
          </div>
          {status.ratees.map((r) => (
            <ScoreSlider
              key={r.club_member_id}
              label={<><Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={26} />{r.name}</>}
              value={scores[r.club_member_id] ?? null}
              touched={scores[r.club_member_id] != null}
              onChange={(v) => setScores((s) => ({ ...s, [r.club_member_id]: v }))}
            />
          ))}
          <div style={{ marginTop: 18 }}>
            <div className="label-title">Et toi, t'en penses quoi de ta séance ?</div>
            <ScoreSlider label="Mon auto-évaluation" value={selfScore || null} touched={!!selfScore} onChange={setSelfScore} />
          </div>
          <button className="btn btn-primary" disabled={!allFilled} onClick={() => setStep("confirm")} style={{ marginTop: 8 }}>Vérifier avant validation</button>
        </div>
      )}

      {status.eligible && !status.submitted && step === "confirm" && (
        <div>
          <div className="label-title">Récapitulatif — vérifie avant de valider</div>
          {status.ratees.map((r) => (
            <ScoreBar key={r.club_member_id} label={<><Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={22} />{r.name}</>} value={scores[r.club_member_id]} />
          ))}
          <ScoreBar label="Toi (auto-évaluation)" value={selfScore} highlight />
          <p className="subtle" style={{ margin: "12px 0" }}>Une fois validé, tu ne pourras plus modifier ce vote.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep("vote")}>Revenir</button>
            <button className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? "Validation…" : "Valider définitivement"}</button>
          </div>
        </div>
      )}
    </div>
  );
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

      {manage && e.type === "match" && !cancelled && <ConvocationManager event={e} reload={reload} />}

      {manage && !cancelled && <PresenceCorrector event={e} reload={reload} />}
    </div>
  );
}

/** Un admin peut corriger un joueur qui a dit "présent" mais qui ne s'est pas
 * présenté (ou qui s'est blessé) — repasse simplement sa disponibilité
 * déclarée à absent/blessé, ce qui le retire aussi du vote automatiquement. */
function PresenceCorrector({ event: e, reload }) {
  const { token, activeClubId } = useAuth();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const present = e.present_names ?? [];

  const correct = async (member, status) => {
    setBusyId(member.club_member_id); setError("");
    try {
      await api("events.php", "availability_set", { club_id: activeClubId, event_id: e.id, target_member_id: member.club_member_id, status }, token);
      reload();
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  if (!present.length) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen((v) => !v)}>
        <People size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{open ? "Fermer" : "Corriger une présence"}
      </button>
      {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
      {open && (
        <div className="card" style={{ marginTop: 10, boxShadow: "none" }}>
          <p className="subtle" style={{ marginTop: 0 }}>
            Un joueur a dit présent mais n'est pas venu, ou s'est blessé ? Corrige ici — il sera retiré du vote de cette séance.
          </p>
          {present.map((m) => (
            <div key={m.club_member_id} className="list-row">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={m.name} userId={m.user_id} avatarUrl={m.avatar_url} size={26} />{m.name}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm" style={{ background: "color-mix(in srgb, var(--status-absent) 20%, transparent)", color: "var(--status-absent)" }} disabled={busyId === m.club_member_id} onClick={() => correct(m, "absent")}>Absent</button>
                <button className="btn btn-sm" style={{ background: "color-mix(in srgb, var(--oc-bluegray-500) 20%, transparent)", color: "var(--oc-bluegray-500)" }} disabled={busyId === m.club_member_id} onClick={() => correct(m, "injured")}>Blessé</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantsTab({ event: e, manage }) {
  const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
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
                          background: p.status === v ? "#fff" : "transparent",
                          color: p.status === v ? AVAIL_ICON_COLORS[v] : "var(--text-dim)",
                          border: p.status === v ? "none" : "1.5px solid var(--line)",
                        }}
                        onClick={() => setFor(p.club_member_id, v)}
                      >{l[0]}</button>
                    ))}
                  </div>
                ) : (
                  <div className="participant-status-icon" style={{ background: sec.key ? AVAIL_ICON_COLORS[sec.key] : "var(--status-noresponse-icon)" }}>
                    {sec.key === "present" && <Check size={14} />}
                    {sec.key === "absent" && <X size={14} />}
                    {sec.key === "injured" && <Bandaid size={12} />}
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
/** Convocation d'un match : parmi les joueurs ayant répondu "présent", on choisit
 * au maximum 1 gardien + 8 joueurs de champ (effectif limité en futsal). */
function ConvocationManager({ event: e, reload }) {
  const { token, activeClubId } = useAuth();
  const [open, setOpen] = useState(false);
  const [goalkeeperId, setGoalkeeperId] = useState(null);
  const [fieldIds, setFieldIds] = useState(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const candidates = e.present_names ?? [];

  const openManager = async () => {
    setOpen((v) => !v);
    if (open) return;
    setError("");
    try {
      const c = await api("events.php", "convocation_list", { club_id: activeClubId, event_id: e.id }, token);
      const gk = c.convocations.find((x) => x.role === "goalkeeper");
      setGoalkeeperId(gk ? gk.club_member_id : null);
      setFieldIds(new Set(c.convocations.filter((x) => x.role !== "goalkeeper").map((x) => x.club_member_id)));
    } catch (e2) { setError(e2.message); }
  };

  const pickGoalkeeper = (id) => {
    setGoalkeeperId((prev) => (prev === id ? null : id));
    setFieldIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const toggleField = (id) => {
    if (id === goalkeeperId) return;
    setFieldIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else { if (s.size >= 8) return prev; s.add(id); }
      return s;
    });
  };

  const save = async () => {
    setError(""); setBusy(true);
    try {
      await api("events.php", "convoke_set", { club_id: activeClubId, event_id: e.id, goalkeeper_id: goalkeeperId, field_ids: [...fieldIds] }, token);
      setOpen(false);
      reload();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const total = (goalkeeperId ? 1 : 0) + fieldIds.size;

  return (
    <div style={{ marginBottom: 14 }}>
      <button className="btn btn-secondary btn-sm" onClick={openManager}>
        <Flag size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{open ? "Fermer les convocations" : "Gérer les convocations (match)"}
      </button>
      {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
      {open && (
        <div style={{ width: "100%", marginTop: 10 }}>
          {candidates.length === 0 && (
            <p className="subtle" style={{ marginTop: 0 }}>Personne n'a encore répondu présent à ce match — la convocation ne peut se faire que parmi les présents.</p>
          )}
          {candidates.length > 0 && (
            <>
              <p className="subtle" style={{ marginTop: 0 }}>
                Parmi les présents : 1 gardien + 8 joueurs de champ maximum ({total}/9).
              </p>

              <div className="label-title" style={{ fontSize: "0.78rem", marginBottom: 4 }}>Gardien</div>
              {candidates.map((m) => (
                <label key={m.club_member_id} className="list-row" style={{ padding: "6px 0", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", fontWeight: 400, color: "var(--text)", display: "flex" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="radio" name={`gk-${e.id}`} checked={goalkeeperId === m.club_member_id} onChange={() => pickGoalkeeper(m.club_member_id)} style={{ width: "auto" }} />
                    <Avatar name={m.name} userId={m.user_id} avatarUrl={m.avatar_url} size={24} />{m.name}
                  </span>
                </label>
              ))}

              <div className="label-title" style={{ fontSize: "0.78rem", marginTop: 12, marginBottom: 4 }}>Joueurs de champ ({fieldIds.size}/8)</div>
              {candidates.filter((m) => m.club_member_id !== goalkeeperId).map((m) => (
                <label key={m.club_member_id} className="list-row" style={{ padding: "6px 0", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", fontWeight: 400, color: "var(--text)", display: "flex", opacity: !fieldIds.has(m.club_member_id) && fieldIds.size >= 8 ? 0.4 : 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox" checked={fieldIds.has(m.club_member_id)}
                      disabled={!fieldIds.has(m.club_member_id) && fieldIds.size >= 8}
                      onChange={() => toggleField(m.club_member_id)} style={{ width: "auto" }}
                    />
                    <Avatar name={m.name} userId={m.user_id} avatarUrl={m.avatar_url} size={24} />{m.name}
                  </span>
                </label>
              ))}

              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy || total === 0} onClick={save}>
                {busy ? "Enregistrement…" : `Convoquer ${total} joueur${total > 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

