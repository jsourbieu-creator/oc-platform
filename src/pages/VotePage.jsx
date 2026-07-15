import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime } from "@/lib/events";
import { Avatar, ScoreSlider, ScoreBar } from "@/components/ui";

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

  const totalToFill = (status?.ratees.length ?? 0) + 1; // + auto-évaluation
  const filledCount = (status ? status.ratees.filter((r) => scores[r.club_member_id] != null).length : 0) + (selfScore ? 1 : 0);
  const allFilled = status?.ratees.length > 0 && status.ratees.every((r) => scores[r.club_member_id] != null) && selfScore;

  const selectedEvent = events?.find((e) => e.id === selectedEventId);

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

  const typeInfo = selectedEvent ? (EVENT_TYPES[selectedEvent.type] ?? EVENT_TYPES.match) : null;
  const TypeIcon = typeInfo?.icon;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Votes</h1>
      {error && <div className="error-box">{error}</div>}

      {events?.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune séance terminée pour le moment — reviens après le prochain entraînement !</p></div>
      )}

      {events?.length > 0 && (
        <div className="event-card-ds" style={{ marginBottom: 16 }}>
          <div className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {TypeIcon && <TypeIcon size={13} />}Séance à noter
          </div>
          <select
            value={selectedEventId ?? ""} onChange={(e) => setSelectedEventId(Number(e.target.value))}
            style={{
              background: "rgba(255,255,255,.16)", border: "none", color: "inherit", fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: 700, fontSize: "1.2rem", marginTop: 8, width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
            }}
          >
            {events?.map((e) => (
              <option key={e.id} value={e.id} style={{ color: "#000" }}>
                {e.title} — {fmtDate(e.starts_at)} {fmtTime(e.starts_at)}
              </option>
            ))}
          </select>
        </div>
      )}

      {status === null && events?.length > 0 && <div className="spinner" />}

      {status && !status.eligible && status.ended && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Tu n'étais pas présent à cette séance — rien à voter.</p></div>
      )}

      {status && !status.eligible && !status.ended && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Cette séance n'est pas encore terminée — le vote s'ouvrira automatiquement à la fin.</p></div>
      )}

      {status && status.eligible && status.submitted && (
        <div className="card">
          <div className="label-title">Ton vote (validé) 🎉</div>
          {status.my_scores?.map((s) => (
            <ScoreBar key={s.ratee_member_id} label={s.name} value={s.score} />
          ))}
          <ScoreBar label="Mon auto-évaluation" value={status.my_self_score} highlight />
          <p className="subtle" style={{ marginTop: 10 }}>Ton vote est définitif et ne peut plus être modifié.</p>
        </div>
      )}

      {status && status.eligible && !status.submitted && step === "vote" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="label-title" style={{ marginBottom: 0 }}>Note tes coéquipiers présents</div>
            <span className="subtle" style={{ fontWeight: 700 }}>{filledCount}/{totalToFill}</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ height: "100%", width: `${(filledCount / totalToFill) * 100}%`, background: "var(--lime-600)", transition: "width .2s ease", borderRadius: 999 }} />
          </div>

          {status.ratees.map((r) => (
            <ScoreSlider
              key={r.club_member_id}
              label={<><Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={26} />{r.name}</>}
              value={scores[r.club_member_id] ?? null}
              touched={scores[r.club_member_id] != null}
              onChange={(v) => setScores((s) => ({ ...s, [r.club_member_id]: v }))}
            />
          ))}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div className="label-title">Et toi, t'en penses quoi de ta séance ?</div>
            <ScoreSlider
              label="Mon auto-évaluation"
              value={selfScore || null}
              touched={!!selfScore}
              onChange={setSelfScore}
            />
          </div>

          <button className="btn btn-primary" disabled={!allFilled} onClick={() => setStep("confirm")} style={{ marginTop: 8 }}>Vérifier avant validation</button>
        </div>
      )}

      {status && status.eligible && !status.submitted && step === "confirm" && (
        <div className="card">
          <div className="label-title">Récapitulatif — vérifie avant de valider</div>
          {status.ratees.map((r) => (
            <ScoreBar key={r.club_member_id} label={<><Avatar name={r.name} userId={r.user_id} avatarUrl={r.avatar_url} size={22} />{r.name}</>} value={scores[r.club_member_id]} />
          ))}
          <ScoreBar label="Toi (auto-évaluation)" value={selfScore} highlight />
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
