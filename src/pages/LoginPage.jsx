import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage({ goto }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        <div className="auth-header">
          <div className="brand-badge" style={{ width: 52, height: 52, fontSize: "1.2rem", margin: "0 auto 12px" }}>OC</div>
          <h1 style={{ fontSize: "1.6rem" }}>Olympique Castelblangeoise</h1>
          <div style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 4 }}>Connexion à ta plateforme de club</div>
        </div>
        <div className="card">
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
          </form>
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
