import { fmtDateBadge, initials, avatarColor, avatarSrc } from "@/lib/events";
import { useState } from "react";
import { CaretDownFill } from "react-bootstrap-icons";

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
        boxShadow: ring ? "0 2px 6px rgba(18,36,46,.16)" : "none", flexShrink: 0, overflow: "hidden",
      }}
    >
      {showPhoto
        ? <img src={avatarSrc(userId)} alt={name} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials((name ?? "?").split(" ")[0], (name ?? "").split(" ")[1])}
    </div>
  );
}

/** Date compacte : bloc coloré plein (jour/mois), identité forte par type d'événement.
 * Si la personne a répondu à sa disponibilité, le bloc prend la couleur de sa réponse. */
export function DateBadge({ date, color = "var(--hero-sky)", ink = "var(--hero-ink)" }) {
  const { day, month } = fmtDateBadge(date);
  return (
    <div
      className="num"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        width: 54, height: 54, borderRadius: "var(--radius-md)", background: color, color: ink,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: "1.3rem", lineHeight: 1, fontWeight: 700 }}>{day}</div>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", opacity: 0.85, marginTop: 2 }}>{month}</div>
    </div>
  );
}

/** Pastille de comptage colorée (présents/absents/sans réponse) — aplat plein */
export function CountChip({ value, tint }) {
  const styles = {
    green: { bg: "var(--status-present)", fg: "var(--status-present-ink)" },
    orange: { bg: "var(--status-absent)", fg: "var(--status-absent-ink)" },
    violet: { bg: "var(--status-injured)", fg: "var(--status-injured-ink)" },
    gray: { bg: "var(--surface-soft)", fg: "var(--text-dim)" },
  }[tint];
  return (
    <span className="num" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 38, height: 38,
      borderRadius: "var(--radius-md)", background: styles.bg, color: styles.fg, fontWeight: 700, fontSize: "1rem", padding: "0 10px",
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
          boxShadow: "0 2px 6px rgba(18,36,46,.16)", marginLeft: -8, flexShrink: 0,
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

/** Variantes "aplat plein" — cartes stats saturées façon refonte moderne */
const SOLID_TINTS = {
  blue: { bg: "var(--hero-sky)", fg: "var(--hero-ink)" },
  gold: { bg: "var(--oc-amber-500)", fg: "#402C05" },
  green: { bg: "var(--oc-green-500)", fg: "#0A2E1B" },
  red: { bg: "var(--oc-red-500)", fg: "#3C0E0E" },
  coral: { bg: "var(--oc-orange-500)", fg: "#3C1204" },
  lime: { bg: "var(--lime-500)", fg: "var(--lime-ink)" },
  pink: { bg: "#E85B9E", fg: "#3C0E28" },
  sage: { bg: "var(--oc-bluegray-500)", fg: "#fff" },
  neutral: { bg: "var(--surface-soft)", fg: "var(--text-muted)" },
};

/** Bloc "icône + gros chiffre + libellé" façon callout Alan/J&A.
 * `solid`: aplat de couleur saturé sur toute la tuile (mise en avant des stats clés). */
export function StatTile({ icon, value, label, tint = "blue", solid = false }) {
  const t = (solid ? SOLID_TINTS : TINTS)[tint] ?? (solid ? SOLID_TINTS.blue : TINTS.blue);
  return (
    <div style={{
      background: solid ? t.bg : "var(--surface)", border: "none", borderRadius: "var(--radius-lg)",
      padding: "16px", flex: 1, minWidth: 130, boxShadow: "var(--shadow-sm)",
    }}>
      {icon && (
        <div className="icon-chip" style={{
          background: solid ? "rgba(255,255,255,.28)" : t.bg, color: solid ? t.fg : t.fg, marginBottom: 10,
        }}>{icon}</div>
      )}
      <div className="num" style={{ fontSize: "2rem", letterSpacing: "-0.02em", lineHeight: 1.05, color: t.fg }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: solid ? t.fg : "var(--text-dim)", opacity: solid ? 0.75 : 1, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Slider de note 1-10 (pas de 0.5) avec dégradé sémantique rouge→ambre→lime et
 * gros chiffre coloré — remplace le menu déroulant, plus tactile et plus "vivant". */
export function ScoreSlider({ label, value, onChange, touched = true }) {
  const display = value === "" || value == null ? "5.5" : value;
  const v = Number(display);
  const tone = !touched ? "var(--text-dim)" : v < 4 ? "var(--oc-orange-500)" : v < 7.5 ? "var(--oc-amber-500)" : "var(--lime-600)";
  return (
    <div className="score-slider">
      <div className="score-slider-top">
        <span className="score-slider-label">{label}</span>
        <span className="score-slider-value" style={{ color: tone }}>{touched ? fmtScoreVal(v) : "?"}</span>
      </div>
      <input
        type="range" min="1" max="10" step="0.5" value={display}
        onChange={(e) => onChange(e.target.value)}
        className={`score-range${touched ? " touched" : ""}`}
      />
      {!touched && <div className="score-slider-hint">Glisse pour noter →</div>}
    </div>
  );
}

function fmtScoreVal(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Barre de score en lecture seule — même code couleur que ScoreSlider (résultats validés). */
export function ScoreBar({ label, value, highlight = false }) {
  const v = Number(value);
  const tone = v < 4 ? "var(--oc-orange-500)" : v < 7.5 ? "var(--oc-amber-500)" : "var(--lime-600)";
  const pct = ((v - 1) / 9) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", fontWeight: highlight ? 700 : 600 }}>{label}</span>
        <strong className="num" style={{ color: tone, fontSize: "1.1rem" }}>{fmtScoreVal(v)}/10</strong>
      </div>
      <div style={{ height: 8, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: tone, borderRadius: 999 }} />
      </div>
    </div>
  );
}

/** Sélecteur de saison sous forme de tuiles au lieu d'un menu déroulant. */
export function SeasonPicker({ seasons, value, onChange }) {
  if (!seasons?.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {seasons.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="season-tile"
            style={{
              flexShrink: 0, border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "10px 16px", borderRadius: "var(--radius-md)",
              background: active ? "var(--electric-blue)" : "var(--surface-soft)",
              color: active ? "#052430" : "var(--text)",
              fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 8,
              transition: "background .15s ease",
            }}
          >
            {s.name}
            {s.status === "active" && (
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: active ? "#052430" : "var(--lime-600)", flexShrink: 0,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pastille colorée + petit menu déroulant custom — remplace un <select> natif
 * pour changer une valeur (rôle, statut...) parmi une liste d'options. */
export function PillMenu({ value, options, colors, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const color = colors?.[value] ?? "var(--text-dim)";

  if (disabled) {
    return (
      <span className="badge badge-neutral" style={{ color }}>{options[value]}</span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 700,
          padding: "6px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6,
          background: `color-mix(in srgb, ${color} 16%, transparent)`, color,
        }}
      >
        {options[value]}
        <CaretDownFill size={9} style={{ opacity: 0.7 }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 4px)", background: "var(--surface)",
            borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)", zIndex: 10, minWidth: 150, overflow: "hidden",
          }}>
            {Object.entries(options).map(([v, l]) => (
              <div
                key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                style={{
                  padding: "10px 14px", fontSize: "0.85rem", fontWeight: v === value ? 700 : 500, cursor: "pointer",
                  color: v === value ? (colors?.[v] ?? "var(--text)") : "var(--text)",
                  background: v === value ? "var(--surface-soft)" : "transparent",
                }}
                onMouseEnter={(e) => { if (v !== value) e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { if (v !== value) e.currentTarget.style.background = "transparent"; }}
              >
                {l}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
