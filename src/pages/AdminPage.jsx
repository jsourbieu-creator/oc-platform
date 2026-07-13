import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const ACTION_LABELS = {
  signup: "Inscription",
  login: "Connexion",
  bootstrap_club: "Création du club",
  create_season: "Création de saison",
  update_season: "Modification de saison",
  season_set_status: "Statut de saison",
  create_team: "Création d'équipe",
  update_team: "Modification d'équipe",
  delete_team: "Suppression d'équipe",
  roster_add: "Ajout à l'effectif",
  roster_remove: "Retrait de l'effectif",
  roster_set_flags: "Capitaine/gardien",
  invite_create: "Invitation créée",
  invite_revoke: "Invitation révoquée",
  join_with_code: "Arrivée via code",
  member_set_role: "Changement de rôle",
  member_set_status: "Changement de statut",
  update_profile: "Profil modifié",
  change_password: "Mot de passe modifié",
  club_update: "Paramètres du club",
};

export function AdminPage() {
  const { token, activeClubId, activeRole } = useAuth();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeClubId || activeRole !== "super_admin") return;
    api("admin.php", "audit_list", { club_id: activeClubId, limit: 100 }, token)
      .then((d) => setEntries(d.entries)).catch((e) => setError(e.message));
  }, [activeClubId, activeRole, token]);

  if (activeRole !== "super_admin") {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: 18 }}>Administration</h1>
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Section réservée au super-administrateur.</p></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Administration</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="label-title">Journal d'activité (100 dernières actions)</div>
        {entries === null && <div className="spinner" />}
        {entries?.length === 0 && <div className="subtle">Aucune action enregistrée.</div>}
        {entries?.map((e) => (
          <div key={e.id} className="list-row" style={{ padding: "7px 0" }}>
            <div style={{ minWidth: 0 }}>
              <strong>{ACTION_LABELS[e.action] ?? e.action}</strong>
              {e.details && <span className="subtle"> — {e.details}</span>}
              <div className="subtle">{e.first_name ? `${e.first_name} ${e.last_name}` : "Système"}</div>
            </div>
            <span className="subtle" style={{ flexShrink: 0 }}>{e.created_at?.slice(0, 16).replace("T", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
