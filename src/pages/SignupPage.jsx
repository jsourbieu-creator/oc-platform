import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import blason from "@/assets/blason.svg";

export function SignupPage({ goto }) {
  const { login } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    setLoading(true);
    try {
      await api("auth.php", "signup", { email, password, first_name: firstName, last_name: lastName });
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
            <div className="hero-title" style={{ fontSize: "1.6rem" }}>Créer un compte</div>
          </div>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Prénom</label><input required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="field"><label>Nom</label><input required value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="field"><label>E-mail</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Mot de passe (8+ caractères)</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn btn-primary" disabled={loading}>{loading ? "Création…" : "Créer mon compte"}</button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem", color: "var(--text-dim)" }}>
          Déjà un compte ?{" "}
          <span style={{ color: "var(--oc-blue-600)", fontWeight: 700, cursor: "pointer" }} onClick={() => goto("login")}>
            Se connecter
          </span>
        </div>
      </div>
    </div>
  );
}
