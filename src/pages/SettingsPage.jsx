import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { NAV_ITEMS, isAvailable } from "@/lib/navigation";

const canManage = (role) => role === "super_admin" || role === "admin";
const HUB_LABELS = ["Équipes", "Membres", "Messages", "Statistiques", "Classements", "Trophées", "Documents", "Médias", "Notifications", "Administration"];

export function SettingsPage({ goto }) {
  const { token, activeClubId, activeRole, memberships, refresh } = useAuth();
  const club = memberships.find((m) => m.club_id === activeClubId);
  const manage = canManage(activeRole);

  const [name, setName] = useState(club?.club_name ?? "");
  const [shortName, setShortName] = useState(club?.club_short_name ?? "");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      await api("clubs.php", "update", { club_id: activeClubId, name, short_name: shortName }, token);
      await refresh();
      setMsg({ type: "ok", text: "Paramètres du club enregistrés." });
    } catch (e2) { setMsg({ type: "err", text: e2.message }); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Paramètres</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Gérer le club</div>
        {NAV_ITEMS.filter((i) => HUB_LABELS.includes(i.label)).map((item) => {
          const available = isAvailable(item);
          return (
            <div
              key={item.view}
              onClick={() => available && goto?.(item.view)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 4px", borderRadius: "var(--radius-sm)",
                opacity: available ? 1 : 0.5, cursor: available ? "pointer" : "default",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", fontWeight: 600 }}>
                <item.icon size={17} strokeWidth={2} />{item.label}
              </span>
              {!available && <span className="badge badge-neutral">Phase {item.phase}</span>}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Apparence</div>
        <p className="subtle" style={{ margin: 0 }}>
          Le thème clair/sombre se règle avec le bouton en haut à droite — il est
          mémorisé sur cet appareil.
        </p>
      </div>

      <div className="card">
        <div className="label-title">Club</div>
        {manage ? (
          <form onSubmit={save}>
            {msg && <div className={msg.type === "ok" ? "info-box" : "error-box"}>{msg.text}</div>}
            <div className="field"><label>Nom complet</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Nom court</label><input type="text" required maxLength={10} value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase())} /></div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </form>
        ) : (
          <p className="subtle" style={{ margin: 0 }}>
            {club?.club_name} ({club?.club_short_name}). Seuls les administrateurs
            peuvent modifier ces informations.
          </p>
        )}
      </div>
    </div>
  );
}
