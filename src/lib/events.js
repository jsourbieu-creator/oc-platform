import { Flag, Activity, Balloon, Check, X, Bandaid } from "react-bootstrap-icons";

export const EVENT_TYPES = {
  match: { label: "Match", icon: Flag, color: "#3852D6" },
  training: { label: "Entraînement", icon: Activity, color: "var(--hero-sky)" },
  club_event: { label: "Événement club", icon: Balloon, color: "var(--hero-sky)" },
};

export const AVAIL_LABELS = {
  present: "Présent",
  absent: "Absent",
  injured: "Blessé",
};

export const AVAIL_ICONS = {
  present: Check,
  absent: X,
  injured: Bandaid,
};

/** Couleur de texte à l'état INACTIF — gris neutre pour tous les statuts (nouvelle charte calme) */
export const AVAIL_COLORS = {
  present: "var(--text-dim)",
  absent: "var(--text-dim)",
  injured: "var(--text-dim)",
};

/** Couleur de remplissage quand le statut est actif — blanc partout, jamais de collision avec le fond */
export const AVAIL_FILL = {
  present: "#fff",
  absent: "#fff",
  injured: "#fff",
};

/** Couleur de texte sur le remplissage blanc — encre marine, cohérente quel que soit le statut */
export const AVAIL_INK = {
  present: "#0A2340",
  absent: "#0A2340",
  injured: "#0A2340",
};

/** Couleur de l'icône quand le statut est ACTIF — c'est elle qui porte le code couleur, pas le fond */
export const AVAIL_ICON_COLORS = {
  present: "#3AA65C",
  absent: "#D9534F",
  injured: "#E8672E",
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

/** URL de la photo de profil d'un utilisateur (à n'utiliser que si avatar_url est renseigné) */
export function avatarSrc(userId) {
  return `api/files.php?action=avatar_get&user_id=${userId}`;
}

/** "il y a 1 jour", "il y a 4 h", "il y a 53 min" */
export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = parseDT(dateStr);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} j`;
}

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

const AVATAR_PALETTE = ["#2E93C4", "#E8603D", "#8B7CF6", "#1FA88A", "#D9A62E", "#D4587B"];

/** Couleur déterministe (même nom → même couleur) pour un avatar */
export function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name ?? "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
