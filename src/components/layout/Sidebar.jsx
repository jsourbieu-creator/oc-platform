import { NAV_ITEMS, isAvailable } from "@/lib/navigation";
import blason from "@/assets/blason.svg";

export function Sidebar({ view, goto, badges = {} }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={blason} alt="Blason OC" className="brand-badge" />
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.2 }}>Olympique</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", lineHeight: 1.2 }}>Castelblangeoise</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const available = isAvailable(item);
          const active = view === item.view;
          return (
            <div
              key={item.view}
              className={`sidebar-item ${active ? "active" : ""} ${!available ? "disabled" : ""}`}
              onClick={() => available && goto(item.view)}
            >
              <span className="sidebar-item-label"><item.icon size={17} />{item.label}</span>
              {available && badges[item.view] > 0 && (
                <span style={{ background: "var(--danger-600)", color: "#fff", borderRadius: "var(--radius-full)", fontSize: "0.65rem", fontWeight: 800, padding: "2px 7px" }}>
                  {badges[item.view] > 9 ? "9+" : badges[item.view]}
                </span>
              )}
              {!available && <span className="badge badge-neutral">Phase {item.phase}</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
