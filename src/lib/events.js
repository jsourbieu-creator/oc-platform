import { Goal, Dumbbell, PartyPopper } from "lucide-react";

export const EVENT_TYPES = {
  match: { label: "Match", icon: Goal, color: "var(--gold-500)" },
  training: { label: "Entraînement", icon: Dumbbell, color: "var(--oc-blue-deep)" },
  club_event: { label: "Événement club", icon: PartyPopper, color: "var(--oc-blue-bright)" },
};

export const AVAIL_LABELS = {
  present: "Présent",
  absent: "Absent",
  injured: "Blessé",
};

export const AVAIL_COLORS = {
  present: "var(--lime-600)",
  absent: "var(--danger-600)",
  injured: "var(--warning-600)",
};

export const CONV_LABELS = {
  pending: "En attente",
  confirmed: "Confirmée",
  declined: "Déclinée",
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function parseDT(s) {
  if (!s) return null;
  return new Date(s.replace(" ", "T"));
}

export function fmtDate(s) {
  const d = parseDT(s);
  if (!d) return "";
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtTime(s) {
  const d = parseDT(s);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtMonthKey(s) {
  const d = parseDT(s);
  if (!d) return "";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function isPast(s) {
  const d = parseDT(s);
  return d ? d.getTime() < Date.now() : false;
}

/** "2026-07-13 19:30:00" → "2026-07-13T19:30" (input datetime-local) */
export function toLocalInput(s) {
  return s ? s.replace(" ", "T").slice(0, 16) : "";
}

/** "2026-07-13T19:30" → "2026-07-13 19:30:00" (MySQL) */
export function fromLocalInput(s) {
  return s ? s.replace("T", " ") + ":00" : "";
}

export const canManageEvents = (role) => ["super_admin", "admin", "coach"].includes(role);

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "2026-07-13 19:30:00" → { day: "13", month: "juil." } pour le badge de date */
export function fmtDateBadge(s) {
  const d = parseDT(s);
  if (!d) return { day: "?", month: "" };
  return { day: String(d.getDate()), month: MONTHS_SHORT[d.getMonth()] };
}

/** Initiales pour un avatar (ex. "Julien Sourbieu" → "JS") */
export function initials(firstName, lastName) {
  return `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}` || "?";
}

const AVATAR_PALETTE = ["#196496", "#3D9ECD", "#54C4F0", "#D6A928", "#B87333", "#8FB0C9", "#15803D", "#B5482E"];

/** Couleur déterministe (même nom → même couleur) pour un avatar */
export function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name ?? "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
