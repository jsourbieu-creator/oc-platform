import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function ProfilePage() {
  const { user, token, refresh } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileMsg, setProfileMsg] = useState(null); // {type, text}
  const [busyProfile, setBusyProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [busyPw, setBusyPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null); setBusyProfile(true);
    try {
      await api("auth.php", "update_profile", { first_name: firstName, last_name: lastName, phone }, token);
      await refresh();
      setProfileMsg({ type: "ok", text: "Profil mis à jour." });
    } catch (e2) { setProfileMsg({ type: "err", text: e2.message }); }
    finally { setBusyProfile(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== newPw2) { setPwMsg({ type: "err", text: "Les deux nouveaux mots de passe ne correspondent pas." }); return; }
    setBusyPw(true);
    try {
      await api("auth.php", "change_password", { current_password: currentPw, new_password: newPw }, token);
      setCurrentPw(""); setNewPw(""); setNewPw2("");
      setPwMsg({ type: "ok", text: "Mot de passe modifié." });
    } catch (e2) { setPwMsg({ type: "err", text: e2.message }); }
    finally { setBusyPw(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>Profil</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Mes informations</div>
        <form onSubmit={saveProfile}>
          {profileMsg && <div className={profileMsg.type === "ok" ? "info-box" : "error-box"}>{profileMsg.text}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Prénom</label><input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="field"><label>Nom</label><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="field"><label>Téléphone (optionnel)</label><input type="text" placeholder="06…" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>E-mail</label><input type="email" value={user?.email ?? ""} disabled style={{ opacity: 0.6 }} /></div>
          <button className="btn btn-primary" disabled={busyProfile}>{busyProfile ? "Enregistrement…" : "Enregistrer"}</button>
        </form>
      </div>

      <div className="card">
        <div className="label-title">Changer mon mot de passe</div>
        <form onSubmit={savePassword}>
          {pwMsg && <div className={pwMsg.type === "ok" ? "info-box" : "error-box"}>{pwMsg.text}</div>}
          <div className="field"><label>Mot de passe actuel</label><input type="password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Nouveau (8+ caractères)</label><input type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
            <div className="field"><label>Confirmation</label><input type="password" required minLength={8} value={newPw2} onChange={(e) => setNewPw2(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" disabled={busyPw}>{busyPw ? "Modification…" : "Modifier le mot de passe"}</button>
        </form>
      </div>
    </div>
  );
}
