import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime } from "@/lib/events";
import { fmtScore } from "@/lib/ballondor";
import { Avatar, ScoreSlider, ScoreBar } from "@/components/ui";
import { Trophy, ArrowRight } from "react-bootstrap-icons";

/** Une séance est terminée à ends_at si connu, sinon 2h après starts_at — même règle que côté API. */
function hasEnded(e) {
  const end = e.ends_at ? new Date(e.ends_at.replace(" ", "T")) : new Date(new Date(e.starts_at.replace(" ", "T")).getTime() + 2 * 3600 * 1000);
  return end < new Date();
}

export function VotePage({ goto }) {
  const { user, token, activeClubId } = useAuth();
  const [tab, setTab] = useState("voter"); // voter | sessions | classement
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

  // Données des onglets Séances / Classement — chargées une fois, indépendamment de l'onglet Voter
  const [activeSeason, setActiveSeason] = useState(undefined); // undefined=chargement, null=aucune
  const [perception, setPerception] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [myMemberId, setMyMemberId] = useState(null);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => {
      const s = d.seasons.find((x) => x.status === "active") ?? null;
      setActiveSeason(s);
      if (!s) return;
      api("members.php", "list", { club_id: activeClubId }, token).then((m) => {
        setMyMemberId(m.members.find((x) => x.user_id === user?.id)?.id ?? null);
      }).catch(() => {});
      api("evaluations.php", "my_perception", { club_id: activeClubId, season_id: s.id }, token)
        .then(setPerception).catch(() => setPerception(null));
      api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: s.id }, token)
        .then(setRankings).catch(() => setRankings(null));
    }).catch(() => setActiveSeason(null));
  }, [activeClubId, token, user?.id]);

  const myRanking = myMemberId && rankings ? [...rankings.official, ...rankings.provisional].find((p) => p.club_member_id === myMemberId) : null;
  const myOfficialRank = myMemberId ? rankings?.official.find((p) => p.club_member_id === myMemberId)?.rank : null;

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

      <div className="segmented" style={{ marginBottom: 16 }}>
        {[["voter", "Voter"], ["sessions", "Séances"], ["classement", "Classement"]].map(([v, l]) => (
          <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {tab === "sessions" && (
        <SessionsTab activeSeason={activeSeason} perception={perception} />
      )}

      {tab === "classement" && (
        <ClassementTab activeSeason={activeSeason} rankings={rankings} myRanking={myRanking} myOfficialRank={myOfficialRank} goto={goto} />
      )}

      {tab === "voter" && (<>
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

          <div style={{ marginTop: 18 }}>
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
      </>)}
    </div>
  );
}

function SessionsTab({ activeSeason, perception }) {
  if (activeSeason === undefined || (activeSeason && perception === null)) return <div className="spinner" />;
  if (!activeSeason) {
    return <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune saison active pour le moment.</p></div>;
  }
  const sessions = perception?.sessions ?? [];
  if (sessions.length === 0) {
    return <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune séance notée pour l'instant sur "{activeSeason.name}".</p></div>;
  }
  return (
    <div>
      {perception?.summary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Ton ressenti sur la saison</div>
          <p style={{ margin: 0, fontSize: "0.92rem" }}>{perception.summary.perception_level}</p>
          <p className="subtle" style={{ marginTop: 4 }}>
            Moyenne de tes auto-évaluations : <strong style={{ color: "var(--text)" }}>{fmtScore(perception.summary.avg_self)}</strong> — moyenne reçue du groupe : <strong style={{ color: "var(--text)" }}>{fmtScore(perception.summary.avg_received)}</strong>
          </p>
        </div>
      )}
      <div className="card">
        <div className="label-title">Séance par séance</div>
        {[...sessions].reverse().map((s) => {
          const gapTone = Math.abs(s.gap) <= 0.25 ? "var(--lime-600)" : (s.gap > 0 ? "var(--oc-amber-500)" : "var(--oc-orange-500)");
          const gapLabel = Math.abs(s.gap) <= 0.25 ? "proche du groupe" : (s.gap > 0 ? `surestimation +${s.gap.toFixed(1)}` : `sous-estimation ${s.gap.toFixed(1)}`);
          return (
            <div key={s.event_id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{s.title}</strong>
                <div className="subtle">{fmtDate(s.starts_at)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div className="num" style={{ fontWeight: 700 }}>{fmtScore(s.self_score)}</div>
                  <div className="subtle" style={{ fontSize: "0.66rem" }}>toi</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="num" style={{ fontWeight: 700 }}>{fmtScore(s.received_avg)}</div>
                  <div className="subtle" style={{ fontSize: "0.66rem" }}>groupe</div>
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: gapTone, whiteSpace: "nowrap" }}>{gapLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassementTab({ activeSeason, rankings, myRanking, myOfficialRank, goto }) {
  if (activeSeason === undefined || (activeSeason && rankings === null)) return <div className="spinner" />;
  if (!activeSeason) {
    return <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune saison active pour le moment.</p></div>;
  }
  const podium = rankings?.official.slice(0, 3) ?? [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Ta position — {activeSeason.name}</div>
        {myRanking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div className="num" style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{fmtScore(myRanking.ballon_dor_score)}</div>
              <div className="subtle">score Ballon d'Or</div>
            </div>
            <div style={{ flex: 1 }}>
              {myOfficialRank ? (
                <p style={{ margin: 0, fontSize: "0.92rem" }}><strong>{myOfficialRank}{myOfficialRank === 1 ? "er" : "e"}</strong> au classement officiel</p>
              ) : (
                <p style={{ margin: 0, fontSize: "0.92rem" }}>Classement provisoire — encore <strong>{myRanking.sessions_until_eligible}</strong> séance{myRanking.sessions_until_eligible > 1 ? "s" : ""} avant d'être classé officiellement.</p>
              )}
              <p className="subtle" style={{ marginTop: 4 }}>{myRanking.sessions_played} séances jouées · {myRanking.attendance_rate}% de présence · {myRanking.regularity}</p>
            </div>
          </div>
        ) : (
          <p className="subtle" style={{ margin: 0 }}>Tu n'as pas encore de score sur cette saison — vote après une séance pour apparaître ici.</p>
        )}
      </div>

      {podium.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Top 3 du club</div>
          {podium.map((p) => (
            <div key={p.club_member_id} className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 24, textAlign: "center", fontWeight: 800, color: "var(--gold-500)" }}>{p.rank}</span>
                <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} size={26} />
                <strong>{p.name}</strong>
              </div>
              <strong className="num">{fmtScore(p.ballon_dor_score)}</strong>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" onClick={() => goto?.("classements")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Trophy size={15} /> Voir le classement complet <ArrowRight size={14} />
      </button>
    </div>
  );
}
