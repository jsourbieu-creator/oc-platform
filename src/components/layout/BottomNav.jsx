import { MOBILE_NAV_ITEMS, CURRENT_PHASE } from "@/lib/navigation";

export function BottomNav({ view, goto }) {
  return (
    <nav className="bottom-nav">
      {MOBILE_NAV_ITEMS.map((item) => {
        const available = item.phase <= CURRENT_PHASE;
        const active = view === item.view;
        return (
          <div
            key={item.view}
            className={`bottom-nav-item ${active ? "active" : ""} ${!available ? "disabled" : ""}`}
            onClick={() => goto(available ? item.view : "plus")}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{item.icon}</span>
            {item.label}
          </div>
        );
      })}
    </nav>
  );
}
