import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const err = this.state.error;
    const stack = (this.state.info?.componentStack || err.stack || "").trim();

    return (
      <div style={{ minHeight: "100vh", background: "#101214", color: "#F5F7F8", padding: "24px 18px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, fontFamily: "system-ui, sans-serif" }}>Une erreur est survenue</div>
          <div style={{ color: "#A8B0B6", marginBottom: 16, fontFamily: "system-ui, sans-serif" }}>
            Fais une capture de cet écran et envoie-la — ça indique le fichier fautif.
          </div>
          <div style={{ background: "#181B1E", border: "1px solid #E85D5D", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ color: "#F0787D", fontWeight: 700, marginBottom: 6 }}>{err.name}: {err.message}</div>
          </div>
          <div style={{ background: "#181B1E", border: "1px solid #2C3135", borderRadius: 12, padding: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#A8B0B6", maxHeight: 320, overflow: "auto" }}>
            {stack}
          </div>
          <button
            onClick={() => { this.setState({ error: null, info: null }); location.reload(); }}
            style={{ marginTop: 16, background: "#4EB9E2", color: "#08131a", border: "none", borderRadius: 999, padding: "11px 20px", fontWeight: 700, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
