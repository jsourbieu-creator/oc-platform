import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function NoClubScreen() {
  const { token, refresh, signOut } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [name, setName] = useState("Olympique Castelblangeoise");
  const [shortName, setShortName] = useState("OC");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("clubs.php", "setup_status").then((d) => setNeedsSetup(d.needs_setup)).catch(() => setNeedsSetup(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api("clubs.php", "bootstrap", { name, short_name: shortName }, token);
      await refresh();
    } catch (e2) {
      setError(e2.message);
    } finally { setLoading(false); }
  };

  if (needsSetup === null) return <div className="spinner" />;

  if (!needsSetup) {
    return (
      <div className="auth-screen">
        <div className="auth-box" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>👋</div>
          <h2 style={{ fontSize: "1.4rem", marginBottom: 8 }}>En attente de rattachement</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Ton compte existe mais n'est encore rattaché à aucun club. Un
            administrateur doit t'ajouter à l'Olympique Castelblangeoise.
          </p>
          <span onClick={signOut} style={{ color: "var(--oc-blue-600)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
            Se déconnecter
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-header">
          <h1 style={{ fontSize: "1.5rem" }}>Créer le club</h1>
          <div style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginTop: 4 }}>
            Tu es le premier compte : tu vas devenir super-administrateur.
          </div>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}
            <div className="field"><label>Nom complet du club</label><input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Nom court</label><input required value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase())} maxLength={10} /></div>
            <button className="btn btn-primary" disabled={loading}>{loading ? "Création…" : "Créer le club"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
