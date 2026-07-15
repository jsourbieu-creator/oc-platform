<?php
/**
 * Olympique Castelblangeoise — evaluations.php (Phase 2 : Ballon d'Or)
 *
 * Règles actées avec le club :
 *  - Vote après chaque séance (entraînement + match), pas de module anti-fraude.
 *  - Seuls les joueurs au statut RÉEL "présent" votent et sont notés.
 *  - Les blessures sont retirées du dénominateur du taux de présence.
 *  - L'auto-évaluation ne compte jamais dans le classement officiel.
 *  - Un votant envoie toutes ses notes + son auto-éval en un seul appel
 *    atomique (vote_submit) : pas de modification possible ensuite.
 */
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

// ── Helpers locaux ──────────────────────────────────────────────────

function my_member_id_eval(int $userId, int $clubId): int {
    $stmt = db()->prepare("SELECT id FROM club_members WHERE user_id = ? AND club_id = ? AND status = 'active'");
    $stmt->execute([$userId, $clubId]);
    $id = $stmt->fetchColumn();
    if (!$id) json_error('Tu n\'es pas membre actif de ce club.', 403);
    return (int) $id;
}

function event_in_club_or_404_eval(int $eventId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM events WHERE id = ? AND club_id = ?');
    $stmt->execute([$eventId, $clubId]);
    $e = $stmt->fetch();
    if (!$e) json_error('Événement introuvable dans ce club.', 404);
    return $e;
}

function season_in_club_or_404(int $seasonId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM seasons WHERE id = ? AND club_id = ?');
    $stmt->execute([$seasonId, $clubId]);
    $s = $stmt->fetch();
    if (!$s) json_error('Saison introuvable dans ce club.', 404);
    return $s;
}

/** Une séance est "terminée" à ends_at si connu, sinon 2h après starts_at
 * (durée par défaut d'un entraînement/match) — c'est ce qui ouvre le vote. */
function event_has_ended(array $event): bool {
    $end = !empty($event['ends_at']) ? $event['ends_at'] : date('Y-m-d H:i:s', strtotime($event['starts_at']) + 2 * 3600);
    return strtotime($end) < time();
}

/** Note valide : 1 à 10, par demi-point. */
function valid_score($v): bool {
    if (!is_numeric($v)) return false;
    $f = (float) $v;
    if ($f < 1 || $f > 10) return false;
    return abs(($f * 2) - round($f * 2)) < 0.001;
}

function member_name_map(array $memberIds): array {
    if (!$memberIds) return [];
    $ph = implode(',', array_fill(0, count($memberIds), '?'));
    $stmt = db()->prepare("
        SELECT cm.id, u.first_name, u.last_name
        FROM club_members cm JOIN users u ON u.id = cm.user_id
        WHERE cm.id IN ($ph)
    ");
    $stmt->execute($memberIds);
    $map = [];
    foreach ($stmt->fetchAll() as $r) $map[$r['id']] = trim("{$r['first_name']} {$r['last_name']}");
    return $map;
}

/** user_id + avatar_url par club_member_id (pour afficher de vraies photos) */
function member_avatar_map(array $memberIds): array {
    if (!$memberIds) return [];
    $ph = implode(',', array_fill(0, count($memberIds), '?'));
    $stmt = db()->prepare("
        SELECT cm.id, u.id AS user_id, u.avatar_url
        FROM club_members cm JOIN users u ON u.id = cm.user_id
        WHERE cm.id IN ($ph)
    ");
    $stmt->execute($memberIds);
    $map = [];
    foreach ($stmt->fetchAll() as $r) $map[$r['id']] = ['user_id' => (int) $r['user_id'], 'avatar_url' => $r['avatar_url']];
    return $map;
}

/**
 * Calcule, pour chaque membre ayant joué au moins une séance de la saison,
 * l'ensemble des métriques Ballon d'Or (réutilisé par season_rankings,
 * season_trophies et season_team_stats pour ne pas dupliquer la formule).
 * Retourne aussi l'historique chronologique des moyennes de séance (pour
 * la progression) et les écarts de perception (auto-éval vs reçu).
 */
function compute_season_player_stats(int $clubId, array $season): array {
    $stmt = db()->prepare("
        SELECT id, starts_at FROM events
        WHERE club_id = ? AND status != 'cancelled' AND starts_at >= ? AND starts_at <= ?
        ORDER BY starts_at ASC
    ");
    $stmt->execute([$clubId, $season['start_date'] . ' 00:00:00', $season['end_date'] . ' 23:59:59']);
    $events = $stmt->fetchAll();
    $eventIds = array_map(fn($e) => (int) $e['id'], $events);
    $eventOrder = array_flip($eventIds); // event_id => position chronologique

    if (!$eventIds) return ['players' => [], 'group_average' => null];
    $ph = implode(',', array_fill(0, count($eventIds), '?'));

    $stmt = db()->prepare("SELECT event_id, club_member_id, status FROM event_availabilities WHERE event_id IN ($ph)");
    $stmt->execute($eventIds);
    $attendances = $stmt->fetchAll();

    $stmt = db()->prepare("SELECT event_id, ratee_member_id, AVG(score) avg_score FROM evaluations WHERE event_id IN ($ph) GROUP BY event_id, ratee_member_id");
    $stmt->execute($eventIds);
    $sessionAverages = [];
    foreach ($stmt->fetchAll() as $r) {
        $sessionAverages[(int) $r['ratee_member_id']][(int) $r['event_id']] = (float) $r['avg_score'];
    }

    $stmt = db()->prepare("SELECT event_id, club_member_id, score AS self_score FROM self_evaluations WHERE event_id IN ($ph)");
    $stmt->execute($eventIds);
    $selfScores = [];
    foreach ($stmt->fetchAll() as $r) $selfScores[(int) $r['club_member_id']][(int) $r['event_id']] = (float) $r['self_score'];

    $eligibleCount = []; $presentCount = [];
    foreach ($attendances as $a) {
        $mid = (int) $a['club_member_id'];
        if ($a['status'] === 'injured') continue;
        $eligibleCount[$mid] = ($eligibleCount[$mid] ?? 0) + 1;
        if ($a['status'] === 'present') $presentCount[$mid] = ($presentCount[$mid] ?? 0) + 1;
    }

    $rawAverages = [];
    foreach ($sessionAverages as $mid => $byEvent) $rawAverages[$mid] = array_sum($byEvent) / count($byEvent);
    $groupAverage = $rawAverages ? array_sum($rawAverages) / count($rawAverages) : null;

    $k = (int) $season['reliability_threshold'];
    $coefMin = (float) $season['attendance_coef_min'];
    $coefRange = (float) $season['attendance_coef_range'];
    $minSessions = (int) $season['eligibility_min_sessions'];
    $minPct = (float) $season['eligibility_min_attendance_pct'];

    $memberIds = array_unique(array_merge(array_keys($rawAverages), array_keys($eligibleCount)));
    $names = member_name_map($memberIds);
    $avatars = member_avatar_map($memberIds);

    $players = [];
    foreach ($memberIds as $mid) {
        $sessionsPlayed = $presentCount[$mid] ?? 0;
        if ($sessionsPlayed === 0 || !isset($rawAverages[$mid])) continue;

        $raw = $rawAverages[$mid];
        $adjusted = $groupAverage !== null
            ? (($sessionsPlayed / ($sessionsPlayed + $k)) * $raw) + (($k / ($sessionsPlayed + $k)) * $groupAverage)
            : $raw;

        $eligible = $eligibleCount[$mid] ?? 0;
        $attendanceRate = $eligible > 0 ? $sessionsPlayed / $eligible : 0;
        $coef = $coefMin + ($coefRange * $attendanceRate);
        $score = $adjusted * $coef;

        // Historique chronologique des moyennes de séance (pour régularité + progression)
        $history = $sessionAverages[$mid] ?? [];
        uksort($history, fn($a, $b) => ($eventOrder[$a] ?? 0) <=> ($eventOrder[$b] ?? 0));
        $vals = array_values($history);
        $mean = array_sum($vals) / max(count($vals), 1);
        $variance = count($vals) > 1 ? array_sum(array_map(fn($v) => ($v - $mean) ** 2, $vals)) / count($vals) : 0;
        $stddev = sqrt($variance);
        $regularity = $stddev < 0.5 ? 'très régulier' : ($stddev < 1 ? 'régulier' : ($stddev < 1.5 ? 'irrégulier' : 'très irrégulier'));

        // Progression : moyenne 2e moitié de la saison - moyenne 1ère moitié
        $progression = null;
        if (count($vals) >= 4) {
            $mid_i = (int) floor(count($vals) / 2);
            $firstHalf = array_slice($vals, 0, $mid_i);
            $secondHalf = array_slice($vals, $mid_i);
            $progression = (array_sum($secondHalf) / count($secondHalf)) - (array_sum($firstHalf) / count($firstHalf));
        }

        // Écart de perception (auto-éval vs reçu), séance par séance
        $gaps = [];
        foreach ($selfScores[$mid] ?? [] as $eid => $self) {
            if (isset($sessionAverages[$mid][$eid])) $gaps[] = $self - $sessionAverages[$mid][$eid];
        }
        $avgGap = $gaps ? array_sum($gaps) / count($gaps) : null;
        $avgAbsGap = $gaps ? array_sum(array_map('abs', $gaps)) / count($gaps) : null;

        $players[$mid] = [
            'club_member_id' => $mid,
            'name' => $names[$mid] ?? '?',
            'user_id' => $avatars[$mid]['user_id'] ?? null,
            'avatar_url' => $avatars[$mid]['avatar_url'] ?? null,
            'sessions_played' => $sessionsPlayed,
            'attendance_rate' => round($attendanceRate * 100, 1),
            'raw_average' => round($raw, 2),
            'adjusted_average' => round($adjusted, 2),
            'attendance_coef' => round($coef, 3),
            'ballon_dor_score' => round($score, 2),
            'regularity' => $regularity,
            'regularity_stddev' => round($stddev, 3),
            'progression' => $progression !== null ? round($progression, 2) : null,
            'avg_gap' => $avgGap !== null ? round($avgGap, 2) : null,
            'avg_abs_gap' => $avgAbsGap !== null ? round($avgAbsGap, 2) : null,
            'sessions_until_eligible' => max(0, $minSessions - $sessionsPlayed),
            'is_eligible' => $sessionsPlayed >= $minSessions && ($attendanceRate * 100) >= $minPct,
        ];
    }

    return ['players' => $players, 'group_average' => $groupAverage, 'event_ids' => $eventIds];
}

switch ($action) {

    // ═══════════════════════════════════════════════════════════════
    // PRÉSENCE RÉELLE (post-séance, validée par coach/admin)
    // ═══════════════════════════════════════════════════════════════

    // Vue coach : qui était présent (déclaré), qui a déjà voté / qui reste.
    // Plus de validation manuelle ni d'ouverture/fermeture : dès que la
    // séance est terminée, les présents déclarés peuvent voter.
    case 'vote_session_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        $event = event_in_club_or_404_eval($eventId, $clubId);

        $ended = event_has_ended($event);

        $stmt = db()->prepare("SELECT club_member_id FROM event_availabilities WHERE event_id = ? AND status = 'present'");
        $stmt->execute([$eventId]);
        $presentIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        $names = member_name_map($presentIds);

        $stmt = db()->prepare('SELECT club_member_id FROM vote_submissions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $submitted = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        $participants = array_map(fn($mid) => [
            'club_member_id' => $mid,
            'name' => $names[$mid] ?? '?',
            'submitted' => in_array($mid, $submitted, true),
        ], $presentIds);
        usort($participants, fn($a, $b) => strcmp($a['name'], $b['name']));

        json_out([
            'ended' => $ended,
            'participants' => $participants,
            'submitted_count' => count($submitted),
            'present_count' => count($presentIds),
        ]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // VOTE JOUEUR
    // ═══════════════════════════════════════════════════════════════

    // Ce que voit un joueur avant de voter : suis-je éligible, qui je note,
    // ai-je déjà validé (et si oui, mon récap en lecture seule).
    case 'vote_my_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myId = my_member_id_eval((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        $event = event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare('SELECT status FROM event_availabilities WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        $myStatus = $stmt->fetchColumn();
        $ended = event_has_ended($event);
        $eligible = $myStatus === 'present' && $ended;

        $stmt = db()->prepare('SELECT 1 FROM vote_submissions WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        $submitted = (bool) $stmt->fetchColumn();

        $ratees = [];
        if ($eligible) {
            $stmt = db()->prepare("SELECT club_member_id FROM event_availabilities WHERE event_id = ? AND status = 'present' AND club_member_id != ?");
            $stmt->execute([$eventId, $myId]);
            $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
            $names = member_name_map($ids);
            $avatars = member_avatar_map($ids);
            $ratees = array_map(fn($mid) => [
                'club_member_id' => $mid, 'name' => $names[$mid] ?? '?',
                'user_id' => $avatars[$mid]['user_id'] ?? null, 'avatar_url' => $avatars[$mid]['avatar_url'] ?? null,
            ], $ids);
            usort($ratees, fn($a, $b) => strcmp($a['name'], $b['name']));
        }

        $myScores = null;
        if ($submitted) {
            $stmt = db()->prepare('SELECT ratee_member_id, score FROM evaluations WHERE event_id = ? AND rater_member_id = ?');
            $stmt->execute([$eventId, $myId]);
            $myScores = $stmt->fetchAll();
            $stmt = db()->prepare('SELECT score FROM self_evaluations WHERE event_id = ? AND club_member_id = ?');
            $stmt->execute([$eventId, $myId]);
            $mySelf = $stmt->fetchColumn();
        }

        json_out([
            'event' => ['id' => $event['id'], 'title' => $event['title']],
            'eligible' => $eligible,
            'ended' => $ended,
            'my_status' => $myStatus ?: null,
            'submitted' => $submitted,
            'ratees' => $ratees,
            'my_scores' => $myScores,
            'my_self_score' => $mySelf ?? null,
        ]);
        break;

    // Envoi atomique : notes de tous les présents (sauf moi) + auto-éval.
    // Une fois validé, plus aucune modification possible.
    case 'vote_submit':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myId = my_member_id_eval((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? 0);
        $event = event_in_club_or_404_eval($eventId, $clubId);

        if (!event_has_ended($event)) json_error('La séance n\'est pas encore terminée, les votes ne sont pas encore ouverts.');

        $stmt = db()->prepare("SELECT status FROM event_availabilities WHERE event_id = ? AND club_member_id = ?");
        $stmt->execute([$eventId, $myId]);
        if ($stmt->fetchColumn() !== 'present') json_error('Tu n\'étais pas présent à cette séance, tu ne peux pas voter.', 403);

        $stmt = db()->prepare('SELECT 1 FROM vote_submissions WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        if ($stmt->fetchColumn()) json_error('Ton vote a déjà été validé pour cette séance.');

        $stmt = db()->prepare("SELECT club_member_id FROM event_availabilities WHERE event_id = ? AND status = 'present' AND club_member_id != ?");
        $stmt->execute([$eventId, $myId]);
        $expectedRatees = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        $scores = (array) ($in['scores'] ?? []);
        $given = [];
        foreach ($scores as $s) {
            $mid = (int) ($s['ratee_member_id'] ?? 0);
            if (!valid_score($s['score'] ?? null)) json_error('Note invalide (1 à 10, par demi-point).');
            $given[$mid] = (float) $s['score'];
        }
        sort($expectedRatees);
        $givenIds = array_keys($given);
        sort($givenIds);
        if ($expectedRatees !== $givenIds) {
            json_error('Il faut noter tous les joueurs présents, ni plus ni moins.');
        }

        $selfScore = $in['self_score'] ?? null;
        if (!valid_score($selfScore)) json_error('Auto-évaluation invalide (1 à 10, par demi-point).');

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO evaluations (event_id, rater_member_id, ratee_member_id, score) VALUES (?,?,?,?)');
            foreach ($given as $mid => $score) $stmt->execute([$eventId, $myId, $mid, $score]);

            $stmt = $pdo->prepare('INSERT INTO self_evaluations (event_id, club_member_id, score) VALUES (?,?,?)');
            $stmt->execute([$eventId, $myId, (float) $selfScore]);

            $stmt = $pdo->prepare('INSERT INTO vote_submissions (event_id, club_member_id) VALUES (?,?)');
            $stmt->execute([$eventId, $myId]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        json_out(['ok' => true]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // RÉSULTATS D'UNE SÉANCE (une fois les votes clôturés)
    // ═══════════════════════════════════════════════════════════════

    case 'event_results':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myId = my_member_id_eval((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        $event = event_in_club_or_404_eval($eventId, $clubId);

        if (!event_has_ended($event)) json_error('Les résultats ne sont visibles qu\'une fois la séance terminée.');

        // Moyenne reçue par joueur — jamais l'identité des votants.
        $stmt = db()->prepare('
            SELECT ratee_member_id, AVG(score) avg_score, COUNT(*) nb_votes
            FROM evaluations WHERE event_id = ? GROUP BY ratee_member_id
        ');
        $stmt->execute([$eventId]);
        $rows = $stmt->fetchAll();
        $names = member_name_map(array_column($rows, 'ratee_member_id'));

        $ranking = array_map(fn($r) => [
            'club_member_id' => (int) $r['ratee_member_id'],
            'name' => $names[$r['ratee_member_id']] ?? '?',
            'average' => round((float) $r['avg_score'], 2),
            'nb_votes' => (int) $r['nb_votes'],
        ], $rows);
        usort($ranking, fn($a, $b) => $b['average'] <=> $a['average']);

        // Ma comparaison personnelle (auto-éval vs moyenne reçue) — privée.
        $myComparison = null;
        $stmt = db()->prepare('SELECT score FROM self_evaluations WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        $mySelf = $stmt->fetchColumn();
        $myReceived = null;
        foreach ($ranking as $r) if ($r['club_member_id'] === $myId) $myReceived = $r['average'];
        if ($mySelf !== false && $myReceived !== null) {
            $myComparison = [
                'self_score' => (float) $mySelf,
                'received_avg' => $myReceived,
                'gap' => round((float) $mySelf - $myReceived, 2),
            ];
        }

        json_out(['event' => ['id' => $event['id'], 'title' => $event['title']], 'ranking' => $ranking, 'my_comparison' => $myComparison]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // PARAMÈTRES DE SAISON (formules de calcul)
    // ═══════════════════════════════════════════════════════════════

    case 'season_settings_get':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $seasonId = (int) ($in['season_id'] ?? ($_GET['season_id'] ?? 0));
        $s = season_in_club_or_404($seasonId, $clubId);
        json_out(['settings' => [
            'reliability_threshold' => (int) $s['reliability_threshold'],
            'attendance_coef_min' => (float) $s['attendance_coef_min'],
            'attendance_coef_range' => (float) $s['attendance_coef_range'],
            'eligibility_min_sessions' => (int) $s['eligibility_min_sessions'],
            'eligibility_min_attendance_pct' => (float) $s['eligibility_min_attendance_pct'],
            'humorous_trophies_enabled' => (bool) $s['humorous_trophies_enabled'],
        ]]);
        break;

    case 'season_settings_update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_seasons');

        $seasonId = (int) ($in['season_id'] ?? 0);
        season_in_club_or_404($seasonId, $clubId);

        $threshold = (int) ($in['reliability_threshold'] ?? 10);
        $coefMin = (float) ($in['attendance_coef_min'] ?? 0.70);
        $coefRange = (float) ($in['attendance_coef_range'] ?? 0.30);
        $minSessions = (int) ($in['eligibility_min_sessions'] ?? 10);
        $minPct = (float) ($in['eligibility_min_attendance_pct'] ?? 40);
        $humorous = (int) (bool) ($in['humorous_trophies_enabled'] ?? false);
        if ($threshold < 1 || $coefMin < 0 || $coefMin > 1 || $coefRange < 0 || $coefMin + $coefRange > 1) {
            json_error('Paramètres invalides.');
        }

        $stmt = db()->prepare('
            UPDATE seasons SET reliability_threshold = ?, attendance_coef_min = ?, attendance_coef_range = ?,
                eligibility_min_sessions = ?, eligibility_min_attendance_pct = ?, humorous_trophies_enabled = ?
            WHERE id = ? AND club_id = ?
        ');
        $stmt->execute([$threshold, $coefMin, $coefRange, $minSessions, $minPct, $humorous, $seasonId, $clubId]);
        log_action((int) $me['id'], 'season_settings_update', "saison #$seasonId");
        json_out(['ok' => true]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // CLASSEMENT ANNUEL — Score Ballon d'Or
    // ═══════════════════════════════════════════════════════════════

    case 'season_rankings':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $seasonId = (int) ($in['season_id'] ?? ($_GET['season_id'] ?? 0));
        $season = season_in_club_or_404($seasonId, $clubId);

        // Toutes les séances de la saison, non annulées
        $stmt = db()->prepare("
            SELECT id FROM events
            WHERE club_id = ? AND status != 'cancelled'
              AND starts_at >= ? AND starts_at <= ?
        ");
        $stmt->execute([$clubId, $season['start_date'] . ' 00:00:00', $season['end_date'] . ' 23:59:59']);
        $eventIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        if (!$eventIds) json_out(['official' => [], 'provisional' => [], 'group_average' => null]);

        $ph = implode(',', array_fill(0, count($eventIds), '?'));

        // Présence réelle (hors "cancelled", déjà filtré) par membre/séance
        $stmt = db()->prepare("SELECT event_id, club_member_id, status FROM event_availabilities WHERE event_id IN ($ph)");
        $stmt->execute($eventIds);
        $attendances = $stmt->fetchAll();

        // Moyenne officielle par (séance, joueur noté) — moyenne de toutes les notes reçues
        $stmt = db()->prepare("SELECT event_id, ratee_member_id, AVG(score) avg_score FROM evaluations WHERE event_id IN ($ph) GROUP BY event_id, ratee_member_id");
        $stmt->execute($eventIds);
        $sessionAverages = []; // [member_id][event_id] = avg
        foreach ($stmt->fetchAll() as $r) {
            $sessionAverages[(int) $r['ratee_member_id']][(int) $r['event_id']] = (float) $r['avg_score'];
        }

        // Construit, par membre : nb éligible (hors blessures), nb présent, nb séances notées
        $eligibleCount = [];   // dénominateur du taux de présence (présent + absent, hors blessure)
        $presentCount = [];    // séances réellement jouées
        foreach ($attendances as $a) {
            $mid = (int) $a['club_member_id'];
            if ($a['status'] === 'injured') continue; // exclu du dénominateur
            $eligibleCount[$mid] = ($eligibleCount[$mid] ?? 0) + 1;
            if ($a['status'] === 'present') $presentCount[$mid] = ($presentCount[$mid] ?? 0) + 1;
        }

        // Moyenne brute annuelle = moyenne des moyennes de séance (poids égal par séance)
        $rawAverages = [];
        foreach ($sessionAverages as $mid => $byEvent) {
            $rawAverages[$mid] = array_sum($byEvent) / count($byEvent);
        }

        $groupAverage = $rawAverages ? array_sum($rawAverages) / count($rawAverages) : null;

        $k = (int) $season['reliability_threshold'];
        $coefMin = (float) $season['attendance_coef_min'];
        $coefRange = (float) $season['attendance_coef_range'];
        $minSessions = (int) $season['eligibility_min_sessions'];
        $minPct = (float) $season['eligibility_min_attendance_pct'];

        $memberIds = array_unique(array_merge(array_keys($rawAverages), array_keys($eligibleCount)));
        $names = member_name_map($memberIds);

        $players = [];
        foreach ($memberIds as $mid) {
            $sessionsPlayed = $presentCount[$mid] ?? 0;
            if ($sessionsPlayed === 0 || !isset($rawAverages[$mid])) continue; // jamais noté : pas classable

            $raw = $rawAverages[$mid];
            $adjusted = $groupAverage !== null
                ? (($sessionsPlayed / ($sessionsPlayed + $k)) * $raw) + (($k / ($sessionsPlayed + $k)) * $groupAverage)
                : $raw;

            $eligible = $eligibleCount[$mid] ?? 0;
            $attendanceRate = $eligible > 0 ? $sessionsPlayed / $eligible : 0;
            $coef = $coefMin + ($coefRange * $attendanceRate);
            $score = $adjusted * $coef;

            // Régularité : écart-type des moyennes de séance
            $vals = array_values($sessionAverages[$mid] ?? []);
            $mean = array_sum($vals) / max(count($vals), 1);
            $variance = count($vals) > 1 ? array_sum(array_map(fn($v) => ($v - $mean) ** 2, $vals)) / count($vals) : 0;
            $stddev = sqrt($variance);
            $regularity = $stddev < 0.5 ? 'très régulier' : ($stddev < 1 ? 'régulier' : ($stddev < 1.5 ? 'irrégulier' : 'très irrégulier'));

            $isEligible = $sessionsPlayed >= $minSessions && ($attendanceRate * 100) >= $minPct;

            $players[] = [
                'club_member_id' => $mid,
                'name' => $names[$mid] ?? '?',
                'sessions_played' => $sessionsPlayed,
                'attendance_rate' => round($attendanceRate * 100, 1),
                'raw_average' => round($raw, 2),
                'adjusted_average' => round($adjusted, 2),
                'attendance_coef' => round($coef, 3),
                'ballon_dor_score' => round($score, 2),
                'regularity' => $regularity,
                'sessions_until_eligible' => max(0, $minSessions - $sessionsPlayed),
            ];
        }

        $official = array_values(array_filter($players, fn($p) => $p['sessions_played'] >= $minSessions && $p['attendance_rate'] >= $minPct));
        $provisional = array_values(array_filter($players, fn($p) => !($p['sessions_played'] >= $minSessions && $p['attendance_rate'] >= $minPct)));
        usort($official, fn($a, $b) => $b['ballon_dor_score'] <=> $a['ballon_dor_score']);
        usort($provisional, fn($a, $b) => $b['ballon_dor_score'] <=> $a['ballon_dor_score']);
        foreach ($official as $i => &$p) $p['rank'] = $i + 1;
        unset($p);

        json_out(['official' => $official, 'provisional' => $provisional, 'group_average' => $groupAverage !== null ? round($groupAverage, 2) : null]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // MON RESSENTI — comparaison auto-évaluation / perception du groupe
    // ═══════════════════════════════════════════════════════════════

    case 'my_perception':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myId = my_member_id_eval((int) $me['id'], $clubId);

        $seasonId = (int) ($in['season_id'] ?? ($_GET['season_id'] ?? 0));
        $season = season_in_club_or_404($seasonId, $clubId);

        $stmt = db()->prepare("
            SELECT se.event_id, se.score AS self_score, e.title, e.starts_at,
                   (SELECT AVG(ev.score) FROM evaluations ev WHERE ev.event_id = se.event_id AND ev.ratee_member_id = se.club_member_id) AS received_avg
            FROM self_evaluations se
            JOIN events e ON e.id = se.event_id
            WHERE se.club_member_id = ? AND e.club_id = ?
              AND e.starts_at >= ? AND e.starts_at <= ?
            ORDER BY e.starts_at ASC
        ");
        $stmt->execute([$myId, $clubId, $season['start_date'] . ' 00:00:00', $season['end_date'] . ' 23:59:59']);
        $rows = array_filter($stmt->fetchAll(), fn($r) => $r['received_avg'] !== null);

        if (!$rows) json_out(['sessions' => [], 'summary' => null]);

        $gaps = [];
        $sessions = [];
        foreach ($rows as $r) {
            $gap = (float) $r['self_score'] - (float) $r['received_avg'];
            $gaps[] = $gap;
            $sessions[] = [
                'event_id' => (int) $r['event_id'],
                'title' => $r['title'],
                'starts_at' => $r['starts_at'],
                'self_score' => round((float) $r['self_score'], 1),
                'received_avg' => round((float) $r['received_avg'], 2),
                'gap' => round($gap, 2),
            ];
        }

        $avgSelf = array_sum(array_column($sessions, 'self_score')) / count($sessions);
        $avgReceived = array_sum(array_column($sessions, 'received_avg')) / count($sessions);
        $avgGap = array_sum($gaps) / count($gaps);
        $avgAbsGap = array_sum(array_map('abs', $gaps)) / count($gaps);
        $perceptionLevel = $avgAbsGap < 0.5 ? 'perception très proche du groupe'
            : ($avgAbsGap < 1 ? 'perception globalement cohérente'
            : ($avgAbsGap < 1.5 ? 'perception régulièrement différente' : 'perception très différente du groupe'));

        json_out(['sessions' => $sessions, 'summary' => [
            'avg_self' => round($avgSelf, 2),
            'avg_received' => round($avgReceived, 2),
            'avg_gap' => round($avgGap, 2),
            'avg_abs_gap' => round($avgAbsGap, 2),
            'higher_count' => count(array_filter($gaps, fn($g) => $g > 0.25)),
            'lower_count' => count(array_filter($gaps, fn($g) => $g < -0.25)),
            'close_count' => count(array_filter($gaps, fn($g) => abs($g) <= 0.25)),
            'perception_level' => $perceptionLevel,
        ]]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // TROPHÉES DE FIN DE SAISON
    // ═══════════════════════════════════════════════════════════════

    case 'season_trophies':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $seasonId = (int) ($in['season_id'] ?? ($_GET['season_id'] ?? 0));
        $season = season_in_club_or_404($seasonId, $clubId);
        $stats = compute_season_player_stats($clubId, $season);
        $players = array_values($stats['players']);

        if (!$players) json_out(['trophies' => [], 'humorous_enabled' => (bool) $season['humorous_trophies_enabled']]);

        $pick = function (array $items, string $field, bool $max = true) {
            $items = array_filter($items, fn($p) => $p[$field] !== null);
            if (!$items) return null;
            usort($items, fn($a, $b) => $max ? $b[$field] <=> $a[$field] : $a[$field] <=> $b[$field]);
            return $items[0];
        };

        $trophies = [];

        $official = array_values(array_filter($players, fn($p) => $p['is_eligible']));
        $ballonDor = $pick($official ?: $players, 'ballon_dor_score', true);
        if ($ballonDor) $trophies[] = ['code' => 'ballon_dor', 'label' => "Ballon d'Or", 'player' => $ballonDor['name'], 'user_id' => $ballonDor['user_id'], 'avatar_url' => $ballonDor['avatar_url'], 'value' => $ballonDor['ballon_dor_score']];

        $regularEligible = array_filter($players, fn($p) => $p['sessions_played'] >= 5);
        $mostRegular = $pick($regularEligible, 'regularity_stddev', false);
        if ($mostRegular) $trophies[] = ['code' => 'most_regular', 'label' => 'Joueur le plus régulier', 'player' => $mostRegular['name'], 'user_id' => $mostRegular['user_id'], 'avatar_url' => $mostRegular['avatar_url'], 'value' => $mostRegular['regularity']];

        $mostAssiduous = $pick($players, 'attendance_rate', true);
        if ($mostAssiduous) $trophies[] = ['code' => 'most_assiduous', 'label' => 'Joueur le plus assidu', 'player' => $mostAssiduous['name'], 'user_id' => $mostAssiduous['user_id'], 'avatar_url' => $mostAssiduous['avatar_url'], 'value' => $mostAssiduous['attendance_rate'] . '%'];

        $bestProgression = $pick($players, 'progression', true);
        if ($bestProgression) $trophies[] = ['code' => 'best_progression', 'label' => 'Meilleure progression', 'player' => $bestProgression['name'], 'user_id' => $bestProgression['user_id'], 'avatar_url' => $bestProgression['avatar_url'], 'value' => ($bestProgression['progression'] > 0 ? '+' : '') . $bestProgression['progression']];

        $closestPerception = $pick($players, 'avg_abs_gap', false);
        if ($closestPerception) $trophies[] = ['code' => 'closest_perception', 'label' => 'Ressenti le plus proche du groupe', 'player' => $closestPerception['name'], 'user_id' => $closestPerception['user_id'], 'avatar_url' => $closestPerception['avatar_url'], 'value' => $closestPerception['avg_abs_gap']];

        if ($season['humorous_trophies_enabled']) {
            $mostSevere = $pick($players, 'avg_gap', false);
            if ($mostSevere) $trophies[] = ['code' => 'most_severe_self', 'label' => 'Le plus sévère avec lui-même', 'player' => $mostSevere['name'], 'user_id' => $mostSevere['user_id'], 'avatar_url' => $mostSevere['avatar_url'], 'value' => $mostSevere['avg_gap']];

            $mostOverrated = $pick($players, 'avg_gap', true);
            if ($mostOverrated) $trophies[] = ['code' => 'most_overrated_self', 'label' => 'Celui qui se voit un peu trop beau', 'player' => $mostOverrated['name'], 'user_id' => $mostOverrated['user_id'], 'avatar_url' => $mostOverrated['avatar_url'], 'value' => '+' . $mostOverrated['avg_gap']];
        }

        json_out(['trophies' => $trophies, 'humorous_enabled' => (bool) $season['humorous_trophies_enabled']]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // STATISTIQUES COLLECTIVES (Phase 7)
    // ═══════════════════════════════════════════════════════════════

    case 'season_team_stats':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $seasonId = (int) ($in['season_id'] ?? ($_GET['season_id'] ?? 0));
        $season = season_in_club_or_404($seasonId, $clubId);
        $stats = compute_season_player_stats($clubId, $season);
        $players = array_values($stats['players']);
        $eventIds = $stats['event_ids'];

        $totalSessions = count($eventIds);
        $convocationRespRate = null;
        $voteParticipationRate = null;

        if ($eventIds) {
            $ph = implode(',', array_fill(0, count($eventIds), '?'));
            $stmt = db()->prepare("SELECT COUNT(*) total, SUM(status != 'pending') responded FROM convocations WHERE event_id IN ($ph)");
            $stmt->execute($eventIds);
            $r = $stmt->fetch();
            if ($r && (int) $r['total'] > 0) $convocationRespRate = round(100 * (int) $r['responded'] / (int) $r['total'], 1);

            $stmt = db()->prepare("SELECT COUNT(*) present_count FROM event_availabilities WHERE event_id IN ($ph) AND status = 'present'");
            $stmt->execute($eventIds);
            $presentTotal = (int) $stmt->fetchColumn();
            $stmt = db()->prepare("SELECT COUNT(*) FROM vote_submissions WHERE event_id IN ($ph)");
            $stmt->execute($eventIds);
            $submittedTotal = (int) $stmt->fetchColumn();
            if ($presentTotal > 0) $voteParticipationRate = round(100 * $submittedTotal / $presentTotal, 1);
        }

        $pick = function (array $items, string $field, bool $max = true) {
            $items = array_filter($items, fn($p) => $p[$field] !== null);
            if (!$items) return null;
            usort($items, fn($a, $b) => $max ? $b[$field] <=> $a[$field] : $a[$field] <=> $b[$field]);
            return ['name' => $items[0]['name'], 'value' => $items[0][$field]];
        };

        json_out([
            'total_sessions' => $totalSessions,
            'group_average' => $stats['group_average'] !== null ? round($stats['group_average'], 2) : null,
            'convocation_response_rate' => $convocationRespRate,
            'vote_participation_rate' => $voteParticipationRate,
            'most_regular' => $pick(array_filter($players, fn($p) => $p['sessions_played'] >= 5), 'regularity_stddev', false),
            'most_assiduous' => $pick($players, 'attendance_rate', true),
            'best_progression' => $pick($players, 'progression', true),
            'nb_ranked_players' => count($players),
        ]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
