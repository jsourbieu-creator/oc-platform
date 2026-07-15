import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { EVENT_TYPES, fmtDate, fmtTime } from "@/lib/events";
import { fmtScore } from "@/lib/ballondor";
import { Avatar, ScoreSlider, ScoreBar, StatTile, SeasonPicker } from "@/components/ui";
import {
  Trophy, People, Star, Activity, ClipboardCheck, GraphUpArrow, Bullseye,
  Fire, Rulers, EmojiFrown, EmojiSmile, Award, InfoCircle, ChevronLeft,
  GraphDown,
} from "react-bootstrap-icons";

const PODIUM_COLORS = ["var(--gold-500)", "var(--silver-400)", "var(--bronze-500)"];
const TROPHY_ICONS = {
  ballon_dor: Trophy, most_regular: Rulers, most_assiduous: Fire,
  best_progression: GraphUpArrow, closest_perception: Bullseye,
  most_severe_self: EmojiFrown, most_overrated_self: EmojiSmile,
  best_raw_average: Star, most_irregular: GraphDown,
};
/** Liste canonique de tous les trophées possibles — affichés en tuile même
 * quand ils n'ont pas encore été décernés (grisée + condition manquante). */
const TROPHY_DEFS = [
  { code: "ballon_dor", label: "Ballon d'Or", icon: Trophy, requirement: "Le meilleur score, une fois classé officiellement." },
  { code: "most_regular", label: "Joueur le plus régulier", icon: Rulers, requirement: "Il faut au moins 5 séances jouées et notées par un même joueur." },
  { code: "most_assiduous", label: "Joueur le plus assidu", icon: Fire, requirement: "Au moins une présence enregistrée cette saison." },
  { code: "best_progression", label: "Meilleure progression", icon: GraphUpArrow, requirement: "Il faut au moins 4 séances notées pour un même joueur." },
  { code: "closest_perception", label: "Ressenti le plus proche du groupe", icon: Bullseye, requirement: "Il faut avoir fait au moins une auto-évaluation." },
  { code: "best_raw_average", label: "Meilleure moyenne brute", icon: Star, requirement: "La moyenne des notes reçues, avant ajustement présence/régularité." },
  { code: "most_severe_self", label: "Le plus sévère avec lui-même", icon: EmojiFrown, requirement: "Trophée humoristique désactivé pour cette saison.", humorous: true },
  { code: "most_overrated_self", label: "Celui qui se voit un peu trop beau", icon: EmojiSmile, requirement: "Trophée humoristique désactivé pour cette saison.", humorous: true },
  { code: "most_irregular", label: "Montagnes russes", icon: GraphDown, requirement: "Trophée humoristique désactivé pour cette saison.", humorous: true },
];

/** Une séance est terminée à ends_at si connu, sinon 2h après starts_at — même règle que côté API. */
function hasEnded(e) {
  const end = e.ends_at ? new Date(e.ends_at.replace(" ", "T")) : new Date(new Date(e.starts_at.replace(" ", "T")).getTime() + 2 * 3600 * 1000);
  return end < new Date();
}

export function VotePage() {
  const { user, token, activeClubId } = useAuth();
  const [tab, setTab] = useState("seances"); // seances | profil | groupe

  // ── Saison choisie, partagée par "Mon profil" et "Le groupe" ──
  const [seasons, setSeasons] = useState(null);
  const [seasonId, setSeasonId] = useState(null);
  const season = seasons?.find((s) => s.id === seasonId);

  useEffect(() => {
    if (!activeClubId) return;
    api("seasons.php", "list", { club_id: activeClubId }, token).then((d) => {
      setSeasons(d.seasons);
      const active = d.seasons.find((s) => s.status === "active") ?? d.seasons[0];
      if (active && !seasonId) setSeasonId(active.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, token]);

  // ── Données de la saison choisie ──
  const [myMemberId, setMyMemberId] = useState(null);
  const [perception, setPerception] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [settings, setSettings] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [trophies, setTrophies] = useState(null);

  useEffect(() => {
    if (!activeClubId || !seasonId) return;
    api("members.php", "list", { club_id: activeClubId }, token).then((m) => {
      setMyMemberId(m.members.find((x) => x.user_id === user?.id)?.id ?? null);
    }).catch(() => {});
    api("evaluations.php", "my_perception", { club_id: activeClubId, season_id: seasonId }, token).then(setPerception).catch(() => setPerception(null));
    api("evaluations.php", "season_rankings", { club_id: activeClubId, season_id: seasonId }, token).then(setRankings).catch(() => setRankings(null));
    api("evaluations.php", "season_settings_get", { club_id: activeClubId, season_id: seasonId }, token).then((d) => setSettings(d.settings)).catch(() => setSettings(null));
    api("evaluations.php", "season_team_stats", { club_id: activeClubId, season_id: seasonId }, token).then(setTeamStats).catch(() => setTeamStats(null));
    api("evaluations.php", "season_trophies", { club_id: activeClubId, season_id: seasonId }, token).then(setTrophies).catch(() => setTrophies(null));
  }, [activeClubId, seasonId, token, user?.id]);

  const myRanking = rankings === null ? undefined
    : (myMemberId ? [...rankings.official, ...rankings.provisional].find((p) => p.club_member_id === myMemberId) : null) ?? null;
  const myFullName = user ? `${user.first_name} ${user.last_name}`.trim() : null;
  const myTrophies = trophies?.trophies?.filter((t) => t.player === myFullName) ?? [];

  // ── Tous les événements (utilisés par l'onglet Séances) ──
  const [events, setEvents] = useState(null);
  const reloadEvents = useCallback(() => {
    if (!activeClubId) return;
    api("events.php", "list", { club_id: activeClubId }, token).then((d) => setEvents(d.events)).catch(() => {});
  }, [activeClubId, token]);
  useEffect(reloadEvents, [reloadEvents]);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 18 }}>Ballon d'Or</h1>

      <div className="segmented" style={{ marginBottom: 16 }}>
        {[["seances", "Séances"], ["profil", "Mon profil"], ["groupe", "Le groupe"]].map(([v, l]) => (
          <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {tab === "seances" && <SeancesTab events={events} reloadEvents={reloadEvents} season={season} perception={perception} />}

      {tab !== "seances" && (
        <>
          {seasons?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <label className="label-title" style={{ marginBottom: 8, display: "block" }}>Saison</label>
              <SeasonPicker seasons={seasons} value={seasonId} onChange={setSeasonId} />
            </div>
          )}
          {tab === "profil" && (
            <ProfilTab season={season} myRanking={myRanking} settings={settings} perception={perception} myTrophies={myTrophies} />
          )}
          {tab === "groupe" && (
            <GroupeTab season={season} rankings={rankings} teamStats={teamStats} trophies={trophies} />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SÉANCES — l'onglet "action" : voter, séances à venir, historique.
// ═══════════════════════════════════════════════════════════════

function SeancesTab({ events, reloadEvents, season, perception }) {
  const [votingEventId, setVotingEventId] = useState(null);

  if (events === null) return <div className="spinner" />;

  const ended = events.filter((e) => e.status !== "cancelled" && hasEnded(e));
  const pending = ended.filter((e) => e.my_availability === "present" && !e.my_vote_submitted)
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  const upcoming = events.filter((e) => e.status !== "cancelled" && !hasEnded(e))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (votingEventId) {
    const event = events.find((e) => e.id === votingEventId);
    return (
      <VotingFlow
        event={event}
        onDone={() => { setVotingEventId(null); reloadEvents(); }}
        onBack={() => setVotingEventId(null)}
      />
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {pending.map((e) => {
            const t = EVENT_TYPES[e.type] ?? EVENT_TYPES.match;
            const Icon = t.icon;
            return (
              <div key={e.id} className="event-card-ds" style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => setVotingEventId(e.id)}>
                <div className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} />Tu as une séance à noter</div>
                <h3>{e.title}</h3>
                <div style={{ opacity: 0.85, fontSize: "0.9rem", marginBottom: 12 }}>{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}</div>
                <button className="btn" style={{ background: "#fff", color: "var(--hero-ink)", width: "auto", padding: "9px 18px" }}>Noter cette séance</button>
              </div>
            );
          })}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Séances à venir</div>
          {upcoming.map((e) => (
            <div key={e.id} className="list-row">
              <div>
                <strong>{e.title}</strong>
                <div className="subtle">{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}</div>
              </div>
              <span className="badge badge-neutral" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <InfoCircle size={12} /> Vote après la séance
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="label-title">Historique {season ? `— ${season.name}` : ""}</div>
        {perception === null && <div className="spinner" />}
        {perception && perception.sessions.length === 0 && (
          <p className="subtle" style={{ margin: 0 }}>Aucune séance notée pour l'instant.</p>
        )}
        {perception && [...perception.sessions].reverse().map((s) => {
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

// ── Flux de vote pour une séance donnée (repris tel quel, juste recentré sur un event fixe) ──
function VotingFlow({ event, onDone, onBack }) {
  const { token, activeClubId } = useAuth();
  const [status, setStatus] = useState(null);
  const [scores, setScores] = useState({});
  const [selfScore, setSelfScore] = useState("");
  const [step, setStep] = useState("vote");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeClubId || !event) return;
    api("evaluations.php", "vote_my_status", { club_id: activeClubId, event_id: event.id }, token)
      .then(setStatus).catch((e) => setError(e.message));
  }, [activeClubId, event, token]);

  const totalToFill = (status?.ratees.length ?? 0) + 1;
  const filledCount = (status ? status.ratees.filter((r) => scores[r.club_member_id] != null).length : 0) + (selfScore ? 1 : 0);
  const allFilled = status?.ratees.length > 0 && status.ratees.every((r) => scores[r.club_member_id] != null) && selfScore;

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      await api("evaluations.php", "vote_submit", {
        club_id: activeClubId,
        event_id: event.id,
        scores: Object.entries(scores).map(([ratee_member_id, score]) => ({ ratee_member_id: Number(ratee_member_id), score: Number(score) })),
        self_score: Number(selfScore),
      }, token);
      onDone();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  if (!event) return null;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ width: "auto", marginBottom: 12 }} onClick={onBack}>
        <ChevronLeft size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} />Retour
      </button>
      {error && <div className="error-box">{error}</div>}
      {status === null && <div className="spinner" />}

      {status && step === "vote" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="label-title" style={{ marginBottom: 0 }}>{event.title} — note tes coéquipiers présents</div>
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
            <ScoreSlider label="Mon auto-évaluation" value={selfScore || null} touched={!!selfScore} onChange={setSelfScore} />
          </div>
          <button className="btn btn-primary" disabled={!allFilled} onClick={() => setStep("confirm")} style={{ marginTop: 8 }}>Vérifier avant validation</button>
        </div>
      )}

      {status && step === "confirm" && (
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

// ═══════════════════════════════════════════════════════════════
// MON PROFIL — où j'en suis : score, jauge, explication, ressenti, mes trophées.
// ═══════════════════════════════════════════════════════════════

function ProfilTab({ season, myRanking, settings, perception, myTrophies }) {
  const [showHow, setShowHow] = useState(false);
  if (!season) return <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune saison pour le moment.</p></div>;
  if (myRanking === undefined) return <div className="spinner" />;

  const minSessions = settings?.eligibility_min_sessions ?? 10;
  const seasonEndLabel = season.end_date ? new Date(season.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Ta position — {season.name}</div>
        {myRanking ? (
          <>
            <div className="stat-tiles" style={{ marginBottom: 8 }}>
              <StatTile icon={<Trophy size={18} />} value={fmtScore(myRanking.ballon_dor_score)} label="Score Ballon d'Or" tint="gold" solid />
              <StatTile icon={<Activity size={18} />} value={`${myRanking.sessions_played}`} label="Séances jouées" tint="coral" solid />
              <StatTile icon={<ClipboardCheck size={18} />} value={`${myRanking.attendance_rate}%`} label="Taux de présence" tint="lime" solid />
            </div>
            <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
              <strong>Score</strong> = moyenne des notes reçues, ajustée par ta régularité et ta présence (détails ci-dessous).{" "}
              <strong>Séances jouées</strong> = nombre de séances où tu as répondu "présent".{" "}
              <strong>Taux de présence</strong> = séances jouées ÷ séances où tu étais attendu (hors blessures).
            </p>

            {myRanking.rank ? (
              <div>
                <p style={{ margin: 0, fontSize: "0.92rem" }}>
                  Tu es <strong style={{ color: "var(--gold-500)" }}>{myRanking.rank}{myRanking.rank === 1 ? "er" : "e"}</strong> au classement officiel — régularité : <strong>{myRanking.regularity}</strong>.
                </p>
                <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>
                  Le classement officiel trie tous les joueurs éligibles par score Ballon d'Or décroissant.
                  La <strong>régularité</strong> ({myRanking.regularity}) mesure si tes notes de séance varient beaucoup ou peu d'une fois sur l'autre.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Classement provisoire</span>
                  <span className="subtle">{myRanking.sessions_played}/{minSessions} séances</span>
                </div>
                <div style={{ height: 8, background: "var(--surface-soft)", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (myRanking.sessions_played / minSessions) * 100)}%`, background: "var(--oc-amber-500)", borderRadius: 999 }} />
                </div>
                <p style={{ margin: 0, fontSize: "0.92rem" }}>
                  Actuellement, ta note est de <strong>{fmtScore(myRanking.ballon_dor_score)}</strong>.
                  Si tu fais <strong>{myRanking.sessions_until_eligible}</strong> entraînement{myRanking.sessions_until_eligible > 1 ? "s" : ""} supplémentaire{myRanking.sessions_until_eligible > 1 ? "s" : ""},
                  tu seras éligible au classement officiel et à la remise des trophées{seasonEndLabel ? `, avant la fin de la saison le ${seasonEndLabel}` : ""}.
                </p>
                <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>
                  "Provisoire" veut dire que ton score est bien calculé et visible, mais pas encore assez de séances jouées pour être comparé équitablement aux autres — la barre ci-dessus montre ta progression vers le seuil.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="subtle" style={{ margin: 0 }}>Tu n'as pas encore de score sur cette saison — va dans "Séances" pour voter après ta prochaine présence.</p>
        )}

        {settings && (
          <div style={{ marginTop: 14 }}>
            <span onClick={() => setShowHow((v) => !v)} style={{ cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: "var(--oc-sky-700)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <InfoCircle size={14} /> {showHow ? "Masquer" : "Comment le score est calculé ?"}
            </span>
            {showHow && (
              <div style={{ marginTop: 10, fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-dim)" }}>
                <p style={{ margin: "0 0 6px" }}>
                  Ta note de séance vient de la moyenne des notes reçues de tes coéquipiers. Sur toute la saison,
                  cette moyenne est légèrement tirée vers la moyenne du groupe tant que tu n'as pas encore joué
                  beaucoup de séances (seuil de fiabilité : <strong>{settings.reliability_threshold}</strong> séances) —
                  ça évite qu'une seule très bonne ou très mauvaise séance fausse tout ton score au début.
                </p>
                <p style={{ margin: "0 0 6px" }}>
                  Ce score est ensuite multiplié par un <strong>coefficient de présence</strong>, qui va de{" "}
                  <strong>{settings.attendance_coef_min}</strong> (peu présent) à{" "}
                  <strong>{(settings.attendance_coef_min + settings.attendance_coef_range).toFixed(2)}</strong> (toujours présent) —
                  un joueur excellent mais peu assidu ne peut donc pas devancer un joueur très régulier.
                </p>
                <p style={{ margin: 0 }}>
                  Pour entrer dans le classement <strong>officiel</strong>, il faut avoir joué au moins{" "}
                  <strong>{settings.eligibility_min_sessions}</strong> séances avec un taux de présence d'au moins{" "}
                  <strong>{settings.eligibility_min_attendance_pct}%</strong>. En dessous, ton score reste affiché en
                  classement provisoire, à titre indicatif.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {perception?.summary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Ton ressenti</div>
          <p style={{ margin: 0, fontSize: "0.92rem" }}>{perception.summary.perception_level}</p>
          <p className="subtle" style={{ marginTop: 4 }}>
            Moyenne de tes auto-évaluations : <strong style={{ color: "var(--text)" }}>{fmtScore(perception.summary.avg_self)}</strong> — moyenne reçue du groupe : <strong style={{ color: "var(--text)" }}>{fmtScore(perception.summary.avg_received)}</strong>
          </p>
          <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>
            À chaque séance, en plus de noter tes coéquipiers tu te notes aussi toi-même — cette auto-évaluation
            ne compte jamais dans ton score officiel, elle sert uniquement à comparer ce que tu penses de toi
            à ce que le groupe pense réellement de toi. Un grand écart (dans un sens ou l'autre) veut juste dire
            que ta perception diffère de celle des autres, ni bien ni mal.
          </p>
        </div>
      )}

      <div className="card">
        <div className="label-title">Mes trophées</div>
        <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 10 }}>
          Les trophées sont décernés au meilleur de chaque catégorie sur la saison, recalculés à chaque nouveau vote.
        </p>
        {myTrophies.length === 0 && <p className="subtle" style={{ margin: 0 }}>Aucun trophée pour l'instant sur cette saison — continue à jouer et voter !</p>}
        {myTrophies.map((t) => {
          const Icon = TROPHY_ICONS[t.code] ?? Award;
          const def = TROPHY_DEFS.find((d) => d.code === t.code);
          return (
            <div key={t.code} className="list-row" style={{ alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="icon-chip" style={{ background: "var(--oc-yellow-100)", color: "var(--gold-500)", flexShrink: 0 }}><Icon size={18} /></div>
                <div>
                  <strong>{t.label}</strong>
                  {def && <div className="subtle" style={{ fontSize: "0.76rem", marginTop: 2 }}>{def.requirement}</div>}
                </div>
              </div>
              <strong className="num">{typeof t.value === "number" ? fmtScore(t.value) : t.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LE GROUPE — classement complet, stats collectives, trophées du club.
// ═══════════════════════════════════════════════════════════════

function GroupeTab({ season, rankings, teamStats, trophies }) {
  if (!season) return <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune saison pour le moment.</p></div>;
  if (rankings === null || teamStats === null || trophies === null) return <div className="spinner" />;

  const list = trophies?.trophies ?? [];

  return (
    <div>
      {teamStats && (
        <>
          <div className="stat-tiles" style={{ marginBottom: 8 }}>
            <StatTile icon={<Activity size={18} />} value={`${teamStats.sessions_with_votes}/${teamStats.total_sessions}`} label="Séances notées" tint="coral" solid />
            <StatTile icon={<Star size={18} />} value={teamStats.group_average !== null ? `${fmtScore(teamStats.group_average)}/10` : "—/10"} label="Moyenne du groupe" tint="lime" solid />
            <StatTile icon={<People size={18} />} value={`${teamStats.nb_ranked_players}/${teamStats.total_members}`} label="Joueurs classés" tint="blue" solid />
          </div>
          <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 16 }}>
            <strong>Séances notées</strong> = séances de la saison qui ont déjà au moins un vote, sur le total programmé.{" "}
            <strong>Moyenne du groupe</strong> = moyenne de toutes les notes reçues par tout le monde.{" "}
            <strong>Joueurs classés</strong> = joueurs ayant au moins une note, sur l'effectif actif total.
          </p>
        </>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Classement officiel</div>
        <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 10 }}>
          Trie les joueurs ayant atteint le seuil d'éligibilité (nombre de séances + taux de présence minimum), du meilleur score au moins bon.
        </p>
        {rankings.official.length === 0 && <p className="subtle" style={{ margin: 0 }}>Personne ne remplit encore les conditions d'éligibilité.</p>}
        {rankings.official.map((p) => (
          <div key={p.club_member_id} className="list-row" style={{ flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: p.rank <= 3 ? PODIUM_COLORS[p.rank - 1] : "var(--surface-alt)",
                color: p.rank <= 3 ? "#fff" : "var(--text-dim)",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.8rem",
              }}>{p.rank}</span>
              <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} size={28} />
              <strong>{p.name}</strong>
              <span className="subtle">({p.sessions_played} séances, {p.attendance_rate}%)</span>
            </div>
            <strong className="num" style={{ color: "var(--oc-blue-600)", fontSize: "1.1rem" }}>{fmtScore(p.ballon_dor_score)}</strong>
          </div>
        ))}
      </div>

      {rankings.provisional.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">Classement provisoire (encore inéligibles)</div>
          <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 10 }}>
            Ces joueurs ont déjà un score calculé, mais pas encore assez de séances jouées pour être comparés équitablement aux autres et entrer dans le classement officiel.
          </p>
          {rankings.provisional.map((p) => (
            <div key={p.club_member_id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={p.name} userId={p.user_id} avatarUrl={p.avatar_url} size={28} />
                <strong>{p.name}</strong>
                <span className="subtle">encore {p.sessions_until_eligible} séance{p.sessions_until_eligible > 1 ? "s" : ""}</span>
              </div>
              <strong className="num" style={{ color: "var(--text-dim)", fontSize: "1.05rem" }}>{fmtScore(p.ballon_dor_score)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="label-title">Records du groupe</div>
        <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 10 }}>
          Recalculés à chaque nouveau vote, sur toute la saison.
        </p>
        <StatRow
          icon={<Rulers size={14} />} label="Joueur le plus régulier"
          value={teamStats?.most_regular?.name}
          empty="Il faut qu'au moins un joueur ait joué 5 séances notées."
          description="Celui dont les notes de séance varient le moins d'une fois sur l'autre (écart-type le plus faible)."
        />
        <StatRow
          icon={<Fire size={14} />} label="Joueur le plus assidu"
          value={teamStats?.most_assiduous && `${teamStats.most_assiduous.name} (${teamStats.most_assiduous.value}%)`}
          empty="Aucune présence enregistrée pour le moment."
          description="Le meilleur taux de présence (séances jouées ÷ séances attendues, hors blessures)."
        />
        <StatRow
          icon={<GraphUpArrow size={14} />} label="Meilleure progression"
          value={teamStats?.best_progression?.name}
          empty="Il faut au moins 4 séances notées pour un même joueur."
          description="La plus grosse hausse entre la moyenne de la 1ère moitié de saison et celle de la 2e moitié."
        />
      </div>

      <div className="label-title" style={{ marginBottom: 4 }}>Trophées de la saison</div>
      <p className="subtle" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginTop: 0, marginBottom: 10 }}>
        Décernés au meilleur de chaque catégorie, recalculés à chaque nouveau vote — grisés tant que personne ne remplit la condition.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
        {TROPHY_DEFS.map((def) => {
          const awarded = list.find((t) => t.code === def.code);
          const Icon = def.icon;
          return (
            <div
              key={def.code} className="card"
              style={{ opacity: awarded ? 1 : 0.5, background: awarded ? "var(--surface)" : "var(--surface-soft)", display: "flex", flexDirection: "column", gap: 8, minHeight: 150 }}
            >
              <div className="icon-chip" style={{ background: awarded ? "var(--oc-yellow-100)" : "var(--surface-alt)", color: awarded ? "var(--gold-500)" : "var(--text-dim)" }}>
                <Icon size={18} />
              </div>
              <strong style={{ fontSize: "0.88rem" }}>{def.label}</strong>
              <p className="subtle" style={{ margin: 0, fontSize: "0.74rem", lineHeight: 1.4 }}>{def.requirement}</p>
              {awarded && (
                <div style={{ marginTop: "auto" }}><div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{awarded.player}</div><div className="subtle num" style={{ fontSize: "0.78rem" }}>{typeof awarded.value === "number" ? fmtScore(awarded.value) : awarded.value}</div></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ligne de stat toujours visible : valeur normale, ou grisée + explication si pas encore de donnée. */
function StatRow({ icon, label, value, empty, description }) {
  return (
    <div className="list-row" style={{ alignItems: "flex-start" }}>
      <div>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>{icon}{label}</span>
        {description && <div className="subtle" style={{ fontSize: "0.76rem", marginTop: 2, maxWidth: 260 }}>{description}</div>}
      </div>
      {value
        ? <strong style={{ flexShrink: 0 }}>{value}</strong>
        : <span className="subtle" style={{ textAlign: "right", maxWidth: 180, opacity: 0.75, flexShrink: 0 }}>{empty}</span>}
    </div>
  );
}
