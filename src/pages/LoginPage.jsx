import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import blason from "@/assets/blason.svg";

export function LoginPage({ goto }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const sendReset = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api("auth.php", "request_password_reset", { email });
      setForgotSent(true);
    } catch (e2) { setError(e2.message); } finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      goto("dashboard");
    } catch (e2) {
      setError(e2.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="hero-banner" style={{ marginBottom: 20 }}>
          <div className="hero-content">
            <img src={blason} alt="Blason OC" className="hero-blason" />
            <div className="hero-eyebrow">Olympique Castelblangeoise · Futsal</div>
            <div className="hero-title" style={{ fontSize: "1.6rem" }}>Ta plateforme de club</div>
            <div className="hero-sub">Connecte-toi pour continuer</div>
          </div>
        </div>
        <div className="card">
          {forgot ? (
            forgotSent ? (
              <div>
                <div className="info-box">Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé (valable 1 h). Pense à vérifier les spams.</div>
                <span style={{ color: "var(--oc-blue-600)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }} onClick={() => { setForgot(false); setForgotSent(false); }}>← Retour à la connexion</span>
              </div>
            ) : (
              <form onSubmit={sendReset}>
                {error && <div className="error-box">{error}</div>}
                <div className="field">
                  <label>E-mail du compte</label>
                  <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button className="btn btn-primary" disabled={loading}>{loading ? "Envoi…" : "M'envoyer un lien de réinitialisation"}</button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span style={{ color: "var(--text-dim)", cursor: "pointer", fontSize: "0.85rem" }} onClick={() => setForgot(false)}>← Retour à la connexion</span>
                </div>
              </form>
            )
          ) : (
          <form onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}
            <div className="field">
              <label>E-mail</label>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <span style={{ color: "var(--text-dim)", cursor: "pointer", fontSize: "0.85rem" }} onClick={() => { setForgot(true); setError(""); }}>Mot de passe oublié ?</span>
            </div>
          </form>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem", color: "var(--text-dim)" }}>
          Pas encore de compte ?{" "}
          <span style={{ color: "var(--oc-blue-600)", fontWeight: 700, cursor: "pointer" }} onClick={() => goto("signup")}>
            Créer un compte
          </span>
        </div>
      </div>
    </div>
  );
}
