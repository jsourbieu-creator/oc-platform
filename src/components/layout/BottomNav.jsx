import { MOBILE_NAV_ITEMS, isAvailable } from "@/lib/navigation";

export function BottomNav({ view, goto, badges = {} }) {
  return (
    <nav className="bottom-nav">
      {MOBILE_NAV_ITEMS.map((item) => {
        const available = isAvailable(item);
        const active = view === item.view;
        return (
          <div
            key={item.view}
            title={item.label}
            aria-label={item.label}
            className={`bottom-nav-item ${active ? "active" : ""} ${!available ? "disabled" : ""}`}
            onClick={() => goto(available ? item.view : "parametres")}
          >
            <span className="bottom-nav-icon">
              <item.icon size={20} />
              {badges[item.view] > 0 && (
                <span style={{ position: "absolute", top: -4, right: -6, background: "var(--status-absent)", color: "var(--status-absent-ink)", borderRadius: "var(--radius-full)", fontSize: "0.55rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>
                  {badges[item.view] > 9 ? "9+" : badges[item.view]}
                </span>
              )}
            </span>
            <span className="nav-label">{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
