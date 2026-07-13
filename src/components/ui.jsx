import { fmtDateBadge, initials, avatarColor } from "@/lib/events";

/** Date compacte façon TeamPulse : barre colorée + jour/mois en texte simple */
export function DateBadge({ date, color = "var(--oc-blue-deep)" }) {
  const { day, month } = fmtDateBadge(date);
  return (
    <div style={{ display: "flex", gap: 10, flexShrink: 0, alignSelf: "stretch" }}>
      <div style={{ width: 4, borderRadius: 2, background: color }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", minWidth: 38 }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: "1.4rem", lineHeight: 1.05, color: "var(--text)" }}>{day}</div>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-dim)" }}>{month}</div>
      </div>
    </div>
  );
}

/** Pastille de comptage colorée (présents/absents/sans réponse) */
export function CountChip({ value, tint }) {
  const bg = { green: "var(--success-600)", orange: "var(--warning-600)", gray: "var(--neutral-400)" }[tint];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 26,
      borderRadius: "var(--radius-sm)", background: bg, color: "#fff", fontWeight: 800, fontSize: "0.85rem", padding: "0 8px",
    }}>{value}</span>
  );
}

/** Avatars empilés (initiales) avec débordement "+N" */
export function AvatarStack({ people, max = 4 }) {
  if (!people?.length) return null;
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <div
          key={i}
          title={p.name}
          style={{
            width: 26, height: 26, borderRadius: "50%", background: avatarColor(p.name), color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 700,
            border: "2px solid var(--surface)", marginLeft: i === 0 ? 0 : -8, flexShrink: 0,
          }}
        >
          {initials(p.name.split(" ")[0], p.name.split(" ")[1])}
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
          {centerLabel && <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: "1.15rem" }}>{centerLabel}</div>}
          {centerSub && <div style={{ fontSize: "0.62rem", color: "var(--text-dim)" }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}

const TINTS = {
  blue: { bg: "rgba(84,196,240,0.14)", fg: "var(--oc-blue-deep)" },
  gold: { bg: "rgba(214,169,40,0.16)", fg: "#8A6B18" },
  green: { bg: "var(--success-100)", fg: "var(--success-600)" },
  red: { bg: "var(--danger-100)", fg: "var(--danger-600)" },
  neutral: { bg: "var(--surface-alt)", fg: "var(--text-dim)" },
};

/** Bloc "icône + gros chiffre + libellé" façon callout Alan */
export function StatTile({ icon, value, label, tint = "blue" }) {
  const t = TINTS[tint] ?? TINTS.blue;
  return (
    <div style={{ background: t.bg, borderRadius: "var(--radius-lg)", padding: "16px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{icon}</div>
      <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: "1.5rem", color: t.fg }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}
