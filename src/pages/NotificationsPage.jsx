import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const TYPE_ICONS = {
  new_post: "📰",
  new_comment: "💬",
  convocation: "📋",
  event_cancelled: "⚠️",
};

function fmtDateTime(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " +
         d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function NotificationsPage({ goto }) {
  const { token, activeClubId } = useAuth();
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("notifications.php", "list", { club_id: activeClubId }, token)
      .then((d) => setNotifications(d.notifications)).catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const markAllRead = async () => {
    setError("");
    try {
      await api("notifications.php", "mark_all_read", { club_id: activeClubId }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const unread = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: "1.9rem" }}>Notifications</h1>
        {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Tout marquer lu ({unread})</button>}
      </div>
      {error && <div className="error-box">{error}</div>}

      {notifications === null && <div className="spinner" />}
      {notifications?.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune notification. Tu seras prévenu ici des nouvelles annonces, convocations et annulations.</p></div>
      )}

      {notifications?.length > 0 && (
        <div className="card">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="list-row"
              style={{ cursor: n.view ? "pointer" : "default", opacity: n.read_at ? 0.55 : 1 }}
              onClick={() => n.view && goto?.(n.view)}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ marginRight: 8 }}>{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <span style={{ fontWeight: n.read_at ? 400 : 700 }}>{n.text}</span>
                <div className="subtle">{fmtDateTime(n.created_at)}</div>
              </div>
              {!n.read_at && <span className="badge badge-info" style={{ flexShrink: 0 }}>Nouveau</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
