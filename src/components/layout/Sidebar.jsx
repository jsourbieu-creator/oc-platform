import { NAV_ITEMS, CURRENT_PHASE } from "@/lib/navigation";

export function Sidebar({ view, goto }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-badge">OC</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.2 }}>Olympique</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", lineHeight: 1.2 }}>Castelblangeoise</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const available = item.phase <= CURRENT_PHASE;
          const active = view === item.view;
          return (
            <div
              key={item.view}
              className={`sidebar-item ${active ? "active" : ""} ${!available ? "disabled" : ""}`}
              onClick={() => available && goto(item.view)}
            >
              <span className="sidebar-item-label"><span>{item.icon}</span>{item.label}</span>
              {!available && <span className="badge badge-neutral">Phase {item.phase}</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
