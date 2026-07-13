import { useState } from "react";
import { api } from "@/lib/api";

export function ResetPasswordPage({ token, done }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try {
      await api("auth.php", "reset_password", { token, new_password: pw });
      setOk(true);
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-header">
          <div className="brand-badge" style={{ width: 52, height: 52, fontSize: "1.2rem", margin: "0 auto 12px" }}>OC</div>
          <h1 style={{ fontSize: "1.5rem" }}>Nouveau mot de passe</h1>
        </div>
        <div className="card">
          {ok ? (
            <div>
              <div className="info-box">Mot de passe modifié ! Tu peux maintenant te connecter.</div>
              <button className="btn btn-primary" onClick={done}>Aller à la connexion</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && <div className="error-box">{error}</div>}
              <div className="field"><label>Nouveau mot de passe (8+ caractères)</label><input type="password" required minLength={8} autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></div>
              <div className="field"><label>Confirmation</label><input type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Modification…" : "Changer le mot de passe"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
