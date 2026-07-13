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
            className={`bottom-nav-item ${active ? "active" : ""} ${!available ? "disabled" : ""}`}
            onClick={() => goto(available ? item.view : "plus")}
          >
            <span style={{ lineHeight: 1, position: "relative", display: "inline-flex" }}>
              <item.icon size={20} strokeWidth={2} />
              {badges[item.view] > 0 && (
                <span style={{ position: "absolute", top: -4, right: -10, background: "var(--danger-600)", color: "#fff", borderRadius: "var(--radius-full)", fontSize: "0.55rem", fontWeight: 800, padding: "1px 5px", lineHeight: 1.4 }}>
                  {badges[item.view] > 9 ? "9+" : badges[item.view]}
                </span>
              )}
            </span>
            {item.label}
          </div>
        );
      })}
    </nav>
  );
}
