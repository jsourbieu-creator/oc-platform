export const REAL_STATUS_LABELS = {
  present: "Présent",
  absent: "Absent",
  injured: "Blessé",
};

export const REGULARITY_BADGES = {
  "très régulier": "badge-info",
  "régulier": "badge-neutral",
  "irrégulier": "badge-neutral",
  "très irrégulier": "badge-neutral",
};

export const canManageVotes = (role) => ["super_admin", "admin", "coach"].includes(role);

/** Liste des notes possibles de 1 à 10 par demi-point : [1, 1.5, 2, ... 10] */
export const SCORE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

export function fmtScore(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(1).replace(".0", "");
}
