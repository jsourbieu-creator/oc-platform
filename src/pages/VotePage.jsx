import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime } from "@/lib/events";
import { SCORE_OPTIONS, fmtScore } from "@/lib/ballondor";
import { Avatar } from "@/components/ui";

/** Une séance est terminée à ends_at si connu, sinon 2h après starts_at — même règle que côté API. */
function hasEnded(e) {
  const end = e.ends_at ? new Date(e.ends_at.replace(" ", "T")) : new Date(new Date(e.starts_at.replace(" ", "T")).getTime() + 2 * 3600 * 1000);
  return end < new Date();
}

export function VotePage() {
  const { token, activeClubId } = useAuth();
  const [events, setEvents] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [status, setStatus] = useState(null);
  const [scores, setScores] = useState({});
  const [selfScore, setSelfScore] = useState("");
  const [step, setStep] = useState("vote"); // vote | confirm
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => {
      const sorted = [...d.events].filter((e) => e.status !== "cancelled" && hasEnded(e))
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      setEvents(sorted);
      if (sorted.length && !selectedEventId) {
        // Par défaut : la plus récente séance où je suis éligible et n'ai pas encore voté.
        const pending = sorted.find((e) => e.my_availability === "present");
        setSelectedEventId((pending ?? sorted[0]).id);
      }
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  const loadStatus = useCallback(() => {
    if (!activeClubId || !selectedEventId) return;
    setError(""); setStep("vote"); setScores({}); setSelfScore("");
    api("evaluations.php", "vote_my_status", { club_id: activeClubId, event_id: selectedEventId }, token)
      .then(setStatus).catch((e) => setError(e.message));
  }, [activeClubId, selectedEventId, token]);

  useEffect(loadStatus, [loadStatus]);

  const allFilled = status?.ratees.length > 0 && status.ratees.every((r) => scores[r.club_member_id]) && selfScore;

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      await api("evaluations.php", "vote_submit", {
        club_id: activeClubId,
        event_id: selectedEventId,
        scores: Object.entries(scores).map(([ratee_member_id, score]) => ({ ratee_member_id: Number(ratee_member_id), score: Number(score) })),
        self_score: Number(selfScore),
      }, token);
      loadStatus();
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Votes</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Séance</label>
          <select value={selectedEventId ?? ""} onChange={(e) => setSelectedEventId(Number(e.target.value))}>
            {events?.map((e) => (
              <option key={e.id} value={e.id}>
                {(() => { const I = (EVENT_TYPES[e.type] ?? EVENT_TYPES.match).icon; return <I size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />; })()}{e.title} — {fmtDate(e.starts_at)} {fmtTime(e.starts_at)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === null && <div className="spinner" />}

      {status && !status.eligible && status.ended && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Tu n'étais pas présent à cette séance — rien à voter.</p></div>
      )}

      {status && !status.eligible && !status.ended && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Cette séance n'est pas encore terminée — le vote s'ouvrira automatiquement à la fin.</p></div>
      )}

      {status && status.eligible && status.submitted && (
        <div className="card">
          <div className="label-title">Ton vote (validé)</div>
          {status.my_scores?.map((s) => (
            <div key={s.ratee_member_id} className="list-row">
              <span>Joueur #{s.ratee_member_id}</span>
              <strong className="num">{fmtScore(s.score)}/10</strong>
            </div>
          ))}
          <div className="list-row">
            <span>Mon auto-évaluation</span>
            <strong className="num">{fmtScore(status.my_self_score)}/10</strong>
          </div>
          <p className="subtle" style={{ marginTop: 10 }}>Ton vote est définitif et ne peut plus être modifié.</p>
        </div>
      )}

      {status && status.eligible && !status.submitted && step === "vote" && (
        <div className="card">
          <div className="label-title">Note tes coéquipiers présents (1 à 10)</div>
          {status.ratees.map((r) => (
            <div key={r.club_member_id} className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>
                <Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={26} />{r.name}
              </label>
              <select value={scores[r.club_member_id] ?? ""} onChange={(e) => setScores((s) => ({ ...s, [r.club_member_id]: e.target.value }))}>
                <option value="">— note —</option>
                {SCORE_OPTIONS.map((v) => <option key={v} value={v}>{fmtScore(v)}/10</option>)}
              </select>
            </div>
          ))}
          <div className="field">
            <label>Et toi ? Ton auto-évaluation</label>
            <select value={selfScore} onChange={(e) => setSelfScore(e.target.value)}>
              <option value="">— note —</option>
              {SCORE_OPTIONS.map((v) => <option key={v} value={v}>{fmtScore(v)}/10</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!allFilled} onClick={() => setStep("confirm")}>Vérifier avant validation</button>
        </div>
      )}

      {status && status.eligible && !status.submitted && step === "confirm" && (
        <div className="card">
          <div className="label-title">Récapitulatif — vérifie avant de valider</div>
          {status.ratees.map((r) => (
            <div key={r.club_member_id} className="list-row">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={24} />{r.name}</span>
              <strong className="num">{fmtScore(scores[r.club_member_id])}/10</strong>
            </div>
          ))}
          <div className="list-row">
            <span>Toi (auto-évaluation)</span>
            <strong className="num">{fmtScore(selfScore)}/10</strong>
          </div>
          <p className="subtle" style={{ margin: "12px 0" }}>Une fois validé, tu ne pourras plus modifier ce vote.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep("vote")}>Revenir</button>
            <button className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? "Validation…" : "Valider définitivement"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
