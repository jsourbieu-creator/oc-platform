import { UsersRound, CircleCheck } from "lucide-react";
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
    return <JoinScreen signOut={signOut} />;
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

function JoinScreen({ signOut }) {
  const { token, refresh } = useAuth();
  const [status, setStatus] = useState(undefined); // undefined = chargement
  const [clubName, setClubName] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = () => {
    api("clubs.php", "my_join_status", {}, token)
      .then((d) => { setStatus(d.status); setClubName(d.club_name ?? "le club"); })
      .catch((e) => { setError(e.message); setStatus(null); });
  };
  useEffect(loadStatus, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestJoin = async () => {
    setError(""); setBusy(true);
    try {
      await api("clubs.php", "request_join", {}, token);
      setStatus("invited");
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-box" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--oc-blue-mid)" }}><UsersRound size={36} strokeWidth={1.6} /></div>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Rejoindre {clubName || "le club"}</h2>
        {error && <div className="error-box" style={{ textAlign: "left" }}>{error}</div>}

        {status === undefined && <div className="spinner" />}

        {status === "invited" && (
          <div>
            <div className="info-box" style={{ textAlign: "left" }}>
              Ta demande d'adhésion est envoyée. Un administrateur du club doit
              la valider — tu recevras l'accès dès que c'est fait.
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => refresh()}>Vérifier à nouveau</button>
          </div>
        )}

        {(status === "suspended" || status === "archived") && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Ton adhésion a été suspendue ou archivée. Contacte un administrateur du club.
          </p>
        )}

        {status === null && (
          <div>
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
              Ton compte est créé — il ne reste qu'à demander l'accès au club.
              Un administrateur validera ta demande.
            </p>
            <button className="btn btn-primary" style={{ margin: "8px 0 14px" }} disabled={busy} onClick={requestJoin}>
              {busy ? "Envoi…" : "Demander à rejoindre le club"}
            </button>
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: "var(--text-dim)", cursor: "pointer", fontSize: "0.82rem" }} onClick={() => setShowCode((v) => !v)}>
                {showCode ? "Masquer" : "J'ai un code d'invitation"}
              </span>
              {showCode && <JoinWithCode />}
            </div>
          </div>
        )}

        <span onClick={signOut} style={{ color: "var(--oc-blue-600)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
          Se déconnecter
        </span>
      </div>
    </div>
  );
}

function JoinWithCode() {
  const { token, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("clubs.php", "join_with_code", { code }, token);
      await refresh();
    } catch (e2) { setError(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ margin: "16px 0 20px" }}>
      {error && <div className="error-box">{error}</div>}
      <div className="field" style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="CODE (8 caractères)"
          value={code}
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ textAlign: "center", fontFamily: "monospace", letterSpacing: "0.15em", fontWeight: 700 }}
        />
      </div>
      <button className="btn btn-primary" disabled={busy || code.length !== 8}>
        {busy ? "Vérification…" : "Rejoindre le club"}
      </button>
    </form>
  );
}
