import { CalendarDays, MessageCircle, Star, UserCircle, Settings, Check, X } from "lucide-react";
import { AVAIL_LABELS, AVAIL_COLORS, AVAIL_FILL, AVAIL_INK } from "@/lib/events";
import { DateBadge, AvatarStack, StatTile, CountChip, Avatar } from "@/components/ui";
import blason from "@/assets/blason.svg";

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div className="label-title">{title}</div>
      {children}
    </div>
  );
}

export function DesignSystemPage() {
  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Charte graphique</h1>
      <p className="subtle" style={{ marginBottom: 24 }}>
        Vrais composants, vraies classes CSS — cette page ne peut pas diverger du reste de l'appli.
      </p>

      <Section title="Identité">
        <div className="hero-banner">
          <div className="hero-content">
            <img src={blason} alt="Blason OC" className="hero-blason" style={{ width: 56 }} />
            <div className="hero-eyebrow">Olympique Castelblangeoise</div>
            <div className="hero-title" style={{ fontSize: "1.6rem" }}>Salut Julien</div>
          </div>
        </div>
      </Section>

      <Section title="Typographie">
        <div className="card">
          <div style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Titre — Space Grotesk (h1, h2, .num)</div>
          <div style={{ fontSize: "0.95rem", marginBottom: 8 }}>Texte courant — Inter (contenu dense, tableaux, listes)</div>
          <div className="num" style={{ fontSize: "1.3rem" }}>7.95 · 18 août · 6/20 — DM Mono (tous les chiffres)</div>
        </div>
      </Section>

      <Section title="Couleurs de statut (présent / absent / blessé)">
        <div className="card">
          <div className="subtle" style={{ marginBottom: 8, fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase" }}>Inactif</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {Object.entries(AVAIL_LABELS).map(([v, l]) => (
              <button key={v} className="btn btn-sm" style={{ background: "transparent", color: AVAIL_COLORS[v], border: `1.5px solid ${AVAIL_COLORS[v]}` }}>{l}</button>
            ))}
          </div>
          <div className="subtle" style={{ marginBottom: 8, fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase" }}>Actif</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(AVAIL_LABELS).map(([v, l]) => (
              <button key={v} className="btn btn-sm" style={{ background: AVAIL_FILL[v], color: AVAIL_INK[v], border: `1.5px solid ${AVAIL_FILL[v]}` }}>{l}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Puces de comptage (mêmes teintes que les statuts)">
        <div className="card" style={{ display: "flex", gap: 8 }}>
          <CountChip value={5} tint="green" />
          <CountChip value={0} tint="orange" />
          <CountChip value={15} tint="gray" />
        </div>
      </Section>

      <Section title="Boutons">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-primary">+ Ajouter un événement</button>
          <button className="btn btn-secondary">Annuler</button>
          <button className="btn btn-ghost">Fermer</button>
        </div>
      </Section>

      <Section title="Tuiles de stats">
        <div className="stat-tiles">
          <StatTile icon={<CalendarDays size={20} />} value="18 août" label="Prochaine séance" tint="blue" />
          <StatTile icon={<Star size={20} />} value="7.95" label="Score Ballon d'Or" tint="gold" />
        </div>
      </Section>

      <Section title="Badge de date + avatars">
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DateBadge date="2026-08-18 20:00:00" color="var(--oc-blue-deep)" />
          <AvatarStack people={[{ name: "Julien Sourbieu", user_id: 1 }, { name: "Agathe Sourbieu", user_id: 2 }, { name: "Corentin Walliez", user_id: 3 }]} />
        </div>
      </Section>

      <Section title="Podium (or / argent / bronze)">
        <div className="card">
          <div className="podium-row">
            <div className="podium-step">
              <div className="podium-name">Bob</div>
              <div className="podium-score num">7.95</div>
              <div className="podium-bar" style={{ height: 70, background: "var(--silver-400)" }}><span className="rank">2</span></div>
            </div>
            <div className="podium-step">
              <div className="podium-name">Chris</div>
              <div className="podium-score num">8.34</div>
              <div className="podium-bar" style={{ height: 100, background: "var(--gold-500)" }}><span className="rank">1</span></div>
            </div>
            <div className="podium-step">
              <div className="podium-name">Marine</div>
              <div className="podium-score num">7.41</div>
              <div className="podium-bar" style={{ height: 45, background: "var(--bronze-500)" }}><span className="rank">3</span></div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Icônes — inactif / actif (glow bleu électrique)">
        <div className="card" style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div className="subtle" style={{ marginBottom: 8, fontSize: "0.68rem" }}>Inactif</div>
            <div className="sidebar-item" style={{ width: 44, justifyContent: "center", padding: 10 }}><CalendarDays size={18} /></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="subtle" style={{ marginBottom: 8, fontSize: "0.68rem" }}>Actif</div>
            <div className="sidebar-item active" style={{ width: 44, justifyContent: "center", padding: 10 }}><CalendarDays size={18} /></div>
          </div>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="card" style={{ display: "flex", gap: 10 }}>
          <Avatar name="Julien Sourbieu" userId={1} size={40} />
          <Avatar name="Agathe Sourbieu" userId={2} size={40} />
          <Avatar name="Corentin Walliez" userId={3} size={40} />
        </div>
      </Section>
    </div>
  );
}
