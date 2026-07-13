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

switch ($action) {

    // ═══════════════════════════════════════════════════════════════
    // PRÉSENCE RÉELLE (post-séance, validée par coach/admin)
    // ═══════════════════════════════════════════════════════════════

    // Liste des candidats à valider : union des dispos + convocations
    // déjà enregistrées pour la séance, avec leur statut réel actuel.
    case 'attendance_candidates':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_permission((int) $me['id'], $clubId, 'confirm_attendance');

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare('
            SELECT club_member_id FROM event_availabilities WHERE event_id = ?
            UNION
            SELECT club_member_id FROM convocations WHERE event_id = ?
            UNION
            SELECT club_member_id FROM event_attendances WHERE event_id = ?
        ');
        $stmt->execute([$eventId, $eventId, $eventId]);
        $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        $names = member_name_map($ids);

        $stmt = db()->prepare('SELECT club_member_id, real_status FROM event_attendances WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $current = array_column($stmt->fetchAll(), 'real_status', 'club_member_id');

        $candidates = [];
        foreach ($ids as $mid) {
            $candidates[] = [
                'club_member_id' => $mid,
                'name' => $names[$mid] ?? '?',
                'real_status' => $current[$mid] ?? null,
            ];
        }
        usort($candidates, fn($a, $b) => strcmp($a['name'], $b['name']));
        json_out(['candidates' => $candidates]);
        break;

    // Enregistre/écrase le statut réel d'une liste de membres pour la séance.
    case 'attendance_set':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'confirm_attendance');

        $eventId = (int) ($in['event_id'] ?? 0);
        event_in_club_or_404_eval($eventId, $clubId);

        $rows = (array) ($in['attendances'] ?? []);
        if (!$rows) json_error('Aucune présence à enregistrer.');

        $stmt = db()->prepare('
            INSERT INTO event_attendances (event_id, club_member_id, real_status, validated_by)
            VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE real_status = VALUES(real_status), validated_by = VALUES(validated_by)
        ');
        foreach ($rows as $r) {
            $mid = (int) ($r['club_member_id'] ?? 0);
            $status = $r['real_status'] ?? '';
            if (!$mid || !in_array($status, ['present', 'absent', 'injured'], true)) {
                json_error('Statut réel invalide.');
            }
            $stmt->execute([$eventId, $mid, $status, (int) $me['id']]);
        }
        log_action((int) $me['id'], 'attendance_set', "événement #$eventId : " . count($rows) . ' statut(s)');
        json_out(['ok' => true]);
        break;

    // ═══════════════════════════════════════════════════════════════
    // SESSIONS DE VOTE
    // ═══════════════════════════════════════════════════════════════

    case 'vote_session_open':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_votes');

        $eventId = (int) ($in['event_id'] ?? 0);
        event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare("SELECT COUNT(*) FROM event_attendances WHERE event_id = ? AND real_status = 'present'");
        $stmt->execute([$eventId]);
        if ((int) $stmt->fetchColumn() < 2) {
            json_error('Valide d\'abord la présence réelle d\'au moins 2 joueurs avant d\'ouvrir les votes.');
        }

        $stmt = db()->prepare('SELECT status FROM vote_sessions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $existing = $stmt->fetchColumn();
        if ($existing === 'closed') json_error('Les votes de cette séance ont déjà été clôturés.');

        $stmt = db()->prepare("
            INSERT INTO vote_sessions (event_id, status, opened_by) VALUES (?, 'open', ?)
            ON DUPLICATE KEY UPDATE status = 'open', opened_by = VALUES(opened_by), opened_at = NOW(), closed_at = NULL
        ");
        $stmt->execute([$eventId, (int) $me['id']]);

        $stmt = db()->prepare("SELECT club_member_id FROM event_attendances WHERE event_id = ? AND real_status = 'present'");
        $stmt->execute([$eventId]);
        $presents = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        notify_members($presents, 'vote_open', 'Les votes sont ouverts pour la séance', 'votes');

        log_action((int) $me['id'], 'vote_session_open', "événement #$eventId");
        json_out(['ok' => true]);
        break;

    case 'vote_session_close':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_votes');

        $eventId = (int) ($in['event_id'] ?? 0);
        event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare("UPDATE vote_sessions SET status = 'closed', closed_at = NOW() WHERE event_id = ?");
        $stmt->execute([$eventId]);
        if (!$stmt->rowCount()) json_error('Aucune session de vote ouverte pour cette séance.', 404);

        log_action((int) $me['id'], 'vote_session_close', "événement #$eventId");
        json_out(['ok' => true]);
        break;

    // Vue coach : statut de la session + qui a voté / qui reste
    case 'vote_session_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare('SELECT status, opened_at, closed_at FROM vote_sessions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $session = $stmt->fetch() ?: null;

        $stmt = db()->prepare("SELECT club_member_id FROM event_attendances WHERE event_id = ? AND real_status = 'present'");
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
            'session' => $session,
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

        $stmt = db()->prepare('SELECT real_status FROM event_attendances WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        $myStatus = $stmt->fetchColumn();
        $eligible = $myStatus === 'present';

        $stmt = db()->prepare('SELECT status FROM vote_sessions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $sessionStatus = $stmt->fetchColumn() ?: null;

        $stmt = db()->prepare('SELECT 1 FROM vote_submissions WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        $submitted = (bool) $stmt->fetchColumn();

        $ratees = [];
        if ($eligible) {
            $stmt = db()->prepare("SELECT club_member_id FROM event_attendances WHERE event_id = ? AND real_status = 'present' AND club_member_id != ?");
            $stmt->execute([$eventId, $myId]);
            $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
            $names = member_name_map($ids);
            $ratees = array_map(fn($mid) => ['club_member_id' => $mid, 'name' => $names[$mid] ?? '?'], $ids);
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
            'session_status' => $sessionStatus,
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
        event_in_club_or_404_eval($eventId, $clubId);

        $stmt = db()->prepare('SELECT status FROM vote_sessions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        if ($stmt->fetchColumn() !== 'open') json_error('Les votes ne sont pas ouverts pour cette séance.');

        $stmt = db()->prepare("SELECT real_status FROM event_attendances WHERE event_id = ? AND club_member_id = ?");
        $stmt->execute([$eventId, $myId]);
        if ($stmt->fetchColumn() !== 'present') json_error('Tu n\'étais pas présent à cette séance, tu ne peux pas voter.', 403);

        $stmt = db()->prepare('SELECT 1 FROM vote_submissions WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $myId]);
        if ($stmt->fetchColumn()) json_error('Ton vote a déjà été validé pour cette séance.');

        $stmt = db()->prepare("SELECT club_member_id FROM event_attendances WHERE event_id = ? AND real_status = 'present' AND club_member_id != ?");
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

        $stmt = db()->prepare('SELECT status FROM vote_sessions WHERE event_id = ?');
        $stmt->execute([$eventId]);
        if ($stmt->fetchColumn() !== 'closed') json_error('Les résultats ne sont visibles qu\'une fois les votes clôturés.');

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
        if ($threshold < 1 || $coefMin < 0 || $coefMin > 1 || $coefRange < 0 || $coefMin + $coefRange > 1) {
            json_error('Paramètres invalides.');
        }

        $stmt = db()->prepare('
            UPDATE seasons SET reliability_threshold = ?, attendance_coef_min = ?, attendance_coef_range = ?,
                eligibility_min_sessions = ?, eligibility_min_attendance_pct = ?
            WHERE id = ? AND club_id = ?
        ');
        $stmt->execute([$threshold, $coefMin, $coefRange, $minSessions, $minPct, $seasonId, $clubId]);
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
        $stmt = db()->prepare("SELECT event_id, club_member_id, real_status FROM event_attendances WHERE event_id IN ($ph)");
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
            if ($a['real_status'] === 'injured') continue; // exclu du dénominateur
            $eligibleCount[$mid] = ($eligibleCount[$mid] ?? 0) + 1;
            if ($a['real_status'] === 'present') $presentCount[$mid] = ($presentCount[$mid] ?? 0) + 1;
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

    default:
        json_error('Action inconnue.', 404);
}
