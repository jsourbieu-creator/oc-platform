import { NAV_ITEMS, CURRENT_PHASE } from "@/lib/navigation";

export function PlusPage({ goto }) {
  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 4 }}>Toutes les sections</h1>
      <p className="subtle" style={{ marginBottom: 20 }}>
        Roadmap complète de la plateforme — les sections grisées arrivent dans une phase à venir.
      </p>
      <div className="card">
        {NAV_ITEMS.filter((i) => i.label !== "Accueil").map((item) => {
          const available = item.phase <= CURRENT_PHASE;
          return (
            <div
              key={item.view}
              onClick={() => available && goto(item.view)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 10px", borderRadius: "var(--radius-sm)",
                opacity: available ? 1 : 0.5, cursor: available ? "pointer" : "default",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", fontWeight: 600 }}>
                <span>{item.icon}</span>{item.label}
              </span>
              <span className="badge badge-neutral">{available ? "Disponible" : `Phase ${item.phase}`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
