import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, StatTile } from "@/components/ui";
import { fmtScore } from "@/lib/ballondor";
import { Star, Activity, CheckCircle, ClipboardCheck, HeartPulse, Receipt } from "react-bootstrap-icons";

export function ProfilePage() {
  const { user, token, activeClubId, refresh } = useAuth();

  const [myStats, setMyStats] = useState(undefined); // undefined=chargement, null=pas classé
  const [myMember, setMyMember] = useState(undefined); // undefined=chargement

  useEffect(() => {
    if (!activeClubId) return;
    api("members.php", "list", { club_id: activeClubId }, token).then((d) => {
      setMyMember(d.members.find((x) => x.user_id === user?.id) ?? null);
    }).catch(() => setMyMember(null));
  }, [activeClubId, token, user?.id]);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then(async (d) => {
      const active = d.seasons.find((s) => s.status === "active");
      if (!active) { setMyStats(null); return; }
      const [m, r] = await Promise.all([
        api("members.php", "list", { club_id: activeClubId }, token),
        api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: active.id }, token),
      ]);
      const me = m.members.find((x) => x.user_id === user?.id);
      const mine = [...r.official, ...r.provisional].find((p) => p.club_member_id === me?.id);
      setMyStats(mine ?? null);
    }).catch(() => setMyStats(null));
  }, [activeClubId, token, user?.id]);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef(null);

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true); setAvatarError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`api/files.php?action=avatar_upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      await refresh();
    } catch (e2) { setAvatarError(e2.message); } finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [heightCm, setHeightCm] = useState(user?.height_cm ?? "");
  const [weightKg, setWeightKg] = useState(user?.weight_kg ?? "");
  const [strongFoot, setStrongFoot] = useState(user?.strong_foot ?? "");
  const [favoritePlayer, setFavoritePlayer] = useState(user?.favorite_player ?? "");
  const [favoriteTeam, setFavoriteTeam] = useState(user?.favorite_team ?? "");
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
      await api("auth.php", "update_profile", {
        first_name: firstName, last_name: lastName, phone,
        height_cm: heightCm, weight_kg: weightKg, strong_foot: strongFoot,
        favorite_player: favoritePlayer, favorite_team: favoriteTeam,
      }, token);
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
      <h1 className="page-title" style={{ marginBottom: 18 }}>Profil</h1>

      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <Avatar name={`${user?.first_name} ${user?.last_name}`} userId={user?.id} avatarUrl={user?.avatar_url} size={64} ring={false} />
        <div style={{ flex: 1 }}>
          <div className="label-title" style={{ marginBottom: 6 }}>Photo de profil</div>
          {avatarError && <div className="error-box" style={{ marginBottom: 8 }}>{avatarError}</div>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} />
          {avatarBusy && <span className="subtle"> Envoi…</span>}
        </div>
      </div>

      {myMember && (
        <div className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="badge" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: myMember.has_medical_certificate ? "var(--lime-100)" : "var(--surface-soft)",
            color: myMember.has_medical_certificate ? "var(--lime-600)" : "var(--text-dim)",
          }}>
            <HeartPulse size={14} /> {myMember.has_medical_certificate ? "Certificat médical à jour" : "Certificat médical manquant"}
          </span>
          <span className="badge" style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: myMember.has_paid ? "var(--lime-100)" : "var(--surface-soft)",
            color: myMember.has_paid ? "var(--lime-600)" : "var(--text-dim)",
          }}>
            <Receipt size={14} /> {myMember.has_paid ? "Cotisation payée" : "Cotisation non payée"}
          </span>
        </div>
      )}

      {myStats === undefined && <div className="card" style={{ marginBottom: 16 }}><div className="spinner" /></div>}

      {myStats !== undefined && myStats !== null && (
        <div className="stat-tiles" style={{ marginBottom: 16 }}>
          <StatTile icon={<Star size={20} />} value={fmtScore(myStats.ballon_dor_score)} label="Score Ballon d'Or" tint="gold" solid />
          <StatTile icon={<Activity size={20} />} value={myStats.sessions_played} label="Séances jouées" tint="blue" />
          <StatTile icon={<CheckCircle size={20} />} value={`${myStats.attendance_rate}%`} label="Taux de présence" tint="green" />
        </div>
      )}

      {myStats && myStats.sessions_until_eligible > 0 && (
        <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div className="icon-chip" style={{ background: "var(--oc-amber-100)", color: "var(--oc-amber-700)", flexShrink: 0 }}>
            <ClipboardCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Classement provisoire</div>
            <p className="subtle" style={{ margin: "2px 0 0" }}>
              Encore <strong>{myStats.sessions_until_eligible}</strong> séance{myStats.sessions_until_eligible > 1 ? "s" : ""} avant que ton score soit validé et intègre le classement officiel.
              Il reste affiché en direct entre-temps, mais uniquement à titre indicatif.
            </p>
          </div>
        </div>
      )}

      {myStats && myStats.sessions_until_eligible === 0 && (
        <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div className="icon-chip" style={{ background: "var(--oc-green-100)", color: "var(--oc-green-700)", flexShrink: 0 }}>
            <CheckCircle size={20} />
          </div>
          <div style={{ fontWeight: 700 }}>Ton score est officiel et compte dans le classement de la saison ✓</div>
        </div>
      )}

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Taille (cm)</label><input type="number" min="100" max="230" placeholder="178" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /></div>
            <div className="field"><label>Poids (kg)</label><input type="number" min="30" max="200" placeholder="75" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></div>
          </div>

          <div className="field">
            <label>Pied fort</label>
            <div className="segmented" style={{ display: "flex", width: "100%" }}>
              {[["left", "Gauche"], ["right", "Droit"], ["both", "Ambidextre"]].map(([v, l]) => (
                <button key={v} type="button" className={strongFoot === v ? "active" : ""} style={{ flex: 1 }} onClick={() => setStrongFoot(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Joueur préféré</label><input type="text" placeholder="Mbappé…" value={favoritePlayer} onChange={(e) => setFavoritePlayer(e.target.value)} /></div>
            <div className="field"><label>Équipe préférée</label><input type="text" placeholder="PSG…" value={favoriteTeam} onChange={(e) => setFavoriteTeam(e.target.value)} /></div>
          </div>

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
