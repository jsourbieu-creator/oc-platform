import { MOBILE_NAV_ITEMS, isAvailable } from "@/lib/navigation";

export function BottomNav({ view, goto }) {
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
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{item.icon}</span>
            {item.label}
          </div>
        );
      })}
    </nav>
  );
}
