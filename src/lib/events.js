export const EVENT_TYPES = {
  match: { label: "Match", icon: "⚽" },
  training: { label: "Entraînement", icon: "🏃" },
  club_event: { label: "Événement club", icon: "🎉" },
};

export const AVAIL_LABELS = {
  available: "Disponible",
  maybe: "Peut-être",
  unavailable: "Indisponible",
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
