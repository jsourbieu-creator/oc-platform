import { MOBILE_NAV_ITEMS, isAvailable } from "@/lib/navigation";

export function BottomNav({ view, goto, badges = {} }) {
  const mid = Math.floor(MOBILE_NAV_ITEMS.length / 2);
  return (
    <nav className="bottom-nav">
      {MOBILE_NAV_ITEMS.map((item, i) => {
        const available = isAvailable(item);
        const active = view === item.view;
        const raised = i === mid;
        return (
          <div
            key={item.view}
            className={`bottom-nav-item ${active ? "active" : ""} ${!available ? "disabled" : ""} ${raised ? "raised" : ""}`}
            onClick={() => goto(available ? item.view : "plus")}
          >
            <span className="bottom-nav-icon">
              <item.icon size={raised ? 22 : 20} strokeWidth={2} />
              {badges[item.view] > 0 && (
                <span style={{ position: "absolute", top: -4, right: -10, background: "var(--status-absent)", color: "var(--status-absent-ink)", borderRadius: "var(--radius-full)", fontSize: "0.55rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>
                  {badges[item.view] > 9 ? "9+" : badges[item.view]}
                </span>
              )}
            </span>
            {!raised && item.label}
          </div>
        );
      })}
    </nav>
  );
}
