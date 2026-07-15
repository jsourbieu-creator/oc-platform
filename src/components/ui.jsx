import { fmtDateBadge, initials, avatarColor, avatarSrc } from "@/lib/events";
import { useState } from "react";

/** Avatar rond : photo réelle si dispo, sinon initiales colorées */
export function Avatar({ name, userId, avatarUrl, size = 26, ring = true }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = avatarUrl && userId && !broken;
  return (
    <div
      title={name}
      style={{
        width: size, height: size, borderRadius: "50%", background: avatarColor(name ?? "?"), color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
        border: ring ? "2px solid var(--surface)" : "none", flexShrink: 0, overflow: "hidden",
      }}
    >
      {showPhoto
        ? <img src={avatarSrc(userId)} alt={name} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials((name ?? "?").split(" ")[0], (name ?? "").split(" ")[1])}
    </div>
  );
}

/** Date compacte façon TeamPulse : barre colorée + jour/mois en texte simple */
export function DateBadge({ date, color = "var(--oc-blue-deep)" }) {
  const { day, month } = fmtDateBadge(date);
  return (
    <div style={{ display: "flex", gap: 10, flexShrink: 0, alignSelf: "stretch" }}>
      <div style={{ width: 4, borderRadius: 2, background: color }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", minWidth: 38 }}>
        <div className="num" style={{ fontSize: "1.4rem", lineHeight: 1.05, color: "var(--text)" }}>{day}</div>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-dim)" }}>{month}</div>
      </div>
    </div>
  );
}

/** Pastille de comptage colorée (présents/absents/sans réponse) — aplat plein */
export function CountChip({ value, tint }) {
  const styles = {
    green: { bg: "var(--status-present)", fg: "var(--status-present-ink)" },
    amber: { bg: "var(--status-maybe)", fg: "var(--status-maybe-ink)" },
    orange: { bg: "var(--status-absent)", fg: "var(--status-absent-ink)" },
    gray: { bg: "var(--status-injured)", fg: "var(--status-injured-ink)" },
  }[tint];
  return (
    <span className="num" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 26,
      borderRadius: "var(--radius-sm)", background: styles.bg, color: styles.fg, fontWeight: 700, fontSize: "0.85rem", padding: "0 8px",
    }}>{value}</span>
  );
}

/** Avatars empilés (photo ou initiales) avec débordement "+N" */
export function AvatarStack({ people, max = 4 }) {
  if (!people?.length) return null;
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: "var(--surface-alt)", color: "var(--text-dim)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 700,
          border: "2px solid var(--surface)", marginLeft: -8, flexShrink: 0,
        }}>+{overflow}</div>
      )}
    </div>
  );
}

/** Donut SVG léger (sans dépendance externe) */
export function Donut({ segments, size = 96, thickness = 12, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-alt)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const circle = (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {centerLabel && <div className="num" style={{ fontSize: "1.15rem" }}>{centerLabel}</div>}
          {centerSub && <div style={{ fontSize: "0.62rem", color: "var(--text-dim)" }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}

const TINTS = {
  blue: { bg: "var(--oc-blue-100)", fg: "var(--oc-blue-700)" },
  gold: { bg: "var(--oc-yellow-100)", fg: "var(--oc-yellow-700)" },
  green: { bg: "var(--success-100)", fg: "var(--success-700)" },
  red: { bg: "var(--danger-100)", fg: "var(--danger-700)" },
  coral: { bg: "var(--oc-coral-100)", fg: "var(--oc-coral-700)" },
  lime: { bg: "var(--oc-lime-100)", fg: "var(--oc-lime-700)" },
  pink: { bg: "var(--oc-pink-100)", fg: "var(--oc-pink-700)" },
  sage: { bg: "var(--oc-sage-100)", fg: "var(--oc-sage-700)" },
  neutral: { bg: "var(--surface-soft)", fg: "var(--text-muted)" },
};

/** Bloc "icône + gros chiffre + libellé" façon callout Alan/J&A */
export function StatTile({ icon, value, label, tint = "blue" }) {
  const t = TINTS[tint] ?? TINTS.blue;
  return (
    <div style={{ background: "var(--surface)", border: "none", borderRadius: "var(--radius-lg)", padding: "16px", flex: 1, minWidth: 130, boxShadow: "var(--shadow-sm)" }}>
      {icon && <div className="icon-chip" style={{ background: t.bg, color: t.fg, marginBottom: 10 }}>{icon}</div>}
      <div className="num" style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, color: t.fg }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
