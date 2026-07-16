<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

/** ID de membre du user courant dans le club (403 si absent/inactif). */
function my_member_id(int $userId, int $clubId): int {
    $stmt = db()->prepare("SELECT id FROM club_members WHERE user_id = ? AND club_id = ? AND status = 'active'");
    $stmt->execute([$userId, $clubId]);
    $id = $stmt->fetchColumn();
    if (!$id) json_error('Tu n\'es pas membre actif de ce club.', 403);
    return (int) $id;
}

function event_in_club_or_404(int $eventId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM events WHERE id = ? AND club_id = ?');
    $stmt->execute([$eventId, $clubId]);
    $e = $stmt->fetch();
    if (!$e) json_error('Événement introuvable dans ce club.', 404);
    return $e;
}

switch ($action) {

    // Liste des événements + ma dispo / ma convocation / compteurs
    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT e.*, t.name AS team_name
            FROM events e LEFT JOIN teams t ON t.id = e.team_id
            WHERE e.club_id = ?
            ORDER BY e.starts_at ASC
        ');
        $stmt->execute([$clubId]);
        $events = $stmt->fetchAll();

        if ($events) {
            $ids = array_column($events, 'id');
            $ph = implode(',', array_fill(0, count($ids), '?'));

            $stmt = db()->prepare("SELECT event_id, status, COUNT(*) c FROM event_availabilities WHERE event_id IN ($ph) GROUP BY event_id, status");
            $stmt->execute($ids);
            $availCounts = [];
            foreach ($stmt->fetchAll() as $r) $availCounts[$r['event_id']][$r['status']] = (int) $r['c'];

            $stmt = db()->prepare("SELECT event_id, status, COUNT(*) c FROM convocations WHERE event_id IN ($ph) GROUP BY event_id, status");
            $stmt->execute($ids);
            $convCounts = [];
            foreach ($stmt->fetchAll() as $r) $convCounts[$r['event_id']][$r['status']] = (int) $r['c'];

            $stmt = db()->prepare("SELECT event_id, status, comment FROM event_availabilities WHERE event_id IN ($ph) AND club_member_id = ?");
            $stmt->execute([...$ids, $myMemberId]);
            $myAvailRows = $stmt->fetchAll();
            $myAvail = array_column($myAvailRows, 'status', 'event_id');
            $myComment = array_column($myAvailRows, 'comment', 'event_id');

            $stmt = db()->prepare("SELECT event_id, status FROM convocations WHERE event_id IN ($ph) AND club_member_id = ?");
            $stmt->execute([...$ids, $myMemberId]);
            $myConv = array_column($stmt->fetchAll(), 'status', 'event_id');

            $stmt = db()->prepare("
                SELECT c.event_id, u.id AS user_id, u.first_name, u.last_name, u.avatar_url
                FROM convocations c
                JOIN club_members cm ON cm.id = c.club_member_id
                JOIN users u ON u.id = cm.user_id
                WHERE c.event_id IN ($ph) AND c.status = 'confirmed'
            ");
            $stmt->execute($ids);
            $confirmedNames = [];
            foreach ($stmt->fetchAll() as $r) {
                $confirmedNames[$r['event_id']][] = ['name' => trim("{$r['first_name']} {$r['last_name']}"), 'user_id' => $r['user_id'], 'avatar_url' => $r['avatar_url']];
            }

            $stmt = db()->prepare("
                SELECT ea.event_id, cm.id AS club_member_id, u.id AS user_id, u.first_name, u.last_name, u.avatar_url
                FROM event_availabilities ea
                JOIN club_members cm ON cm.id = ea.club_member_id
                JOIN users u ON u.id = cm.user_id
                WHERE ea.event_id IN ($ph) AND ea.status = 'present'
            ");
            $stmt->execute($ids);
            $presentNames = [];
            foreach ($stmt->fetchAll() as $r) {
                $presentNames[$r['event_id']][] = ['name' => trim("{$r['first_name']} {$r['last_name']}"), 'club_member_id' => (int) $r['club_member_id'], 'user_id' => $r['user_id'], 'avatar_url' => $r['avatar_url']];
            }

            $stmt = db()->prepare("SELECT event_id FROM vote_submissions WHERE event_id IN ($ph) AND club_member_id = ?");
            $stmt->execute([...$ids, $myMemberId]);
            $myVoted = array_fill_keys(array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)), true);

            foreach ($events as &$e) {
                $e['avail_counts'] = $availCounts[$e['id']] ?? new stdClass();
                $e['conv_counts'] = $convCounts[$e['id']] ?? new stdClass();
                $e['my_availability'] = $myAvail[$e['id']] ?? null;
                $e['my_comment'] = $myComment[$e['id']] ?? '';
                $e['my_convocation'] = $myConv[$e['id']] ?? null;
                $e['confirmed_names'] = $confirmedNames[$e['id']] ?? [];
                $e['present_names'] = $presentNames[$e['id']] ?? [];
                $e['my_vote_submitted'] = isset($myVoted[$e['id']]);
            }
            unset($e);
        }
        json_out(['events' => $events, 'my_member_id' => $myMemberId]);
        break;

    case 'create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_events');

        $type = $in['type'] ?? 'match';
        if (!in_array($type, ['match', 'training', 'club_event'], true)) json_error('Type invalide.');
        $title = trim($in['title'] ?? '');
        $startsAt = trim($in['starts_at'] ?? '');
        if ($title === '' || $startsAt === '') json_error('Titre et date de début requis.');

        $teamId = (int) ($in['team_id'] ?? 0) ?: null;
        if ($teamId) {
            $stmt = db()->prepare('SELECT 1 FROM teams WHERE id = ? AND club_id = ?');
            $stmt->execute([$teamId, $clubId]);
            if (!$stmt->fetchColumn()) json_error('Équipe introuvable dans ce club.', 404);
        }

        $repeatWeekly = (bool) ($in['repeat_weekly'] ?? false);
        $repeatUntil = trim($in['repeat_until'] ?? '');
        if ($repeatWeekly && $repeatUntil === '') json_error('Date de fin de récurrence requise.');

        // Construit la liste des dates de début (1 seule, ou hebdo jusqu'à repeat_until)
        $startTs = strtotime($startsAt);
        if ($startTs === false) json_error('Date de début invalide.');
        $starts = [$startTs];
        if ($repeatWeekly) {
            $untilTs = strtotime($repeatUntil . ' 23:59:59');
            if ($untilTs === false || $untilTs < $startTs) json_error('La fin de récurrence doit être après le début.');
            $t = $startTs;
            while (count($starts) < 60) { // garde-fou : 60 occurrences max (~14 mois)
                $t = strtotime('+7 days', $t);
                if ($t > $untilTs) break;
                $starts[] = $t;
            }
        }

        $endsAt = trim($in['ends_at'] ?? '');
        $endsOffset = null;
        if ($endsAt !== '') {
            $endsTs = strtotime($endsAt);
            if ($endsTs === false || $endsTs <= $startTs) json_error('L\'heure de fin doit être après le début.');
            $endsOffset = $endsTs - $startTs;
        }
        $meetAt = trim($in['meet_at'] ?? '');
        $meetOffset = null;
        if ($meetAt !== '') {
            $meetTs = strtotime($meetAt);
            if ($meetTs === false) json_error('Heure de rendez-vous invalide.');
            $meetOffset = $meetTs - $startTs; // généralement négatif (RDV avant le début)
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO events (club_id, team_id, type, title, opponent, location, starts_at, ends_at, meet_at, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $ids = [];
            foreach ($starts as $ts) {
                $stmt->execute([
                    $clubId, $teamId, $type, $title,
                    trim($in['opponent'] ?? '') ?: null,
                    trim($in['location'] ?? '') ?: null,
                    date('Y-m-d H:i:s', $ts),
                    $endsOffset !== null ? date('Y-m-d H:i:s', $ts + $endsOffset) : null,
                    $meetOffset !== null ? date('Y-m-d H:i:s', $ts + $meetOffset) : null,
                    trim($in['notes'] ?? '') ?: null,
                    (int) $me['id'],
                ]);
                $ids[] = (int) $pdo->lastInsertId();
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        log_action((int) $me['id'], 'create_event', count($ids) > 1 ? count($ids) . " occurrences « $title »" : "#{$ids[0]} $title");
        json_out(['ok' => true, 'ids' => $ids, 'count' => count($ids)]);
        break;

    case 'update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_events');

        $id = (int) ($in['event_id'] ?? 0);
        event_in_club_or_404($id, $clubId);

        $type = $in['type'] ?? 'match';
        if (!in_array($type, ['match', 'training', 'club_event'], true)) json_error('Type invalide.');
        $title = trim($in['title'] ?? '');
        $startsAt = trim($in['starts_at'] ?? '');
        if ($title === '' || $startsAt === '') json_error('Titre et date de début requis.');

        $teamId = (int) ($in['team_id'] ?? 0) ?: null;
        if ($teamId) {
            $stmt = db()->prepare('SELECT 1 FROM teams WHERE id = ? AND club_id = ?');
            $stmt->execute([$teamId, $clubId]);
            if (!$stmt->fetchColumn()) json_error('Équipe introuvable dans ce club.', 404);
        }

        $stmt = db()->prepare('UPDATE events SET team_id = ?, type = ?, title = ?, opponent = ?, location = ?, starts_at = ?, ends_at = ?, meet_at = ?, notes = ? WHERE id = ? AND club_id = ?');
        $stmt->execute([
            $teamId, $type, $title,
            trim($in['opponent'] ?? '') ?: null,
            trim($in['location'] ?? '') ?: null,
            $startsAt,
            trim($in['ends_at'] ?? '') ?: null,
            trim($in['meet_at'] ?? '') ?: null,
            trim($in['notes'] ?? '') ?: null,
            $id, $clubId,
        ]);
        log_action((int) $me['id'], 'update_event', "#$id $title");
        json_out(['ok' => true]);
        break;

    case 'set_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_events');

        $id = (int) ($in['event_id'] ?? 0);
        $status = $in['status'] ?? '';
        if (!in_array($status, ['scheduled', 'cancelled'], true)) json_error('Statut invalide.');
        $event = event_in_club_or_404($id, $clubId);
        $stmt = db()->prepare('UPDATE events SET status = ? WHERE id = ? AND club_id = ?');
        $stmt->execute([$status, $id, $clubId]);

        if ($status === 'cancelled') {
            $stmt = db()->prepare('
                SELECT club_member_id FROM convocations WHERE event_id = ?
                UNION SELECT club_member_id FROM event_availabilities WHERE event_id = ?
            ');
            $stmt->execute([$id, $id]);
            $concerned = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
            notify_members($concerned, 'event_cancelled', "Annulé : {$event['title']}", 'calendrier');
        }
        log_action((int) $me['id'], 'event_set_status', "#$id → $status");
        json_out(['ok' => true]);
        break;

    case 'delete':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_events');

        $id = (int) ($in['event_id'] ?? 0);
        $stmt = db()->prepare('DELETE FROM events WHERE id = ? AND club_id = ?');
        $stmt->execute([$id, $clubId]);
        if (!$stmt->rowCount()) json_error('Événement introuvable dans ce club.', 404);
        log_action((int) $me['id'], 'delete_event', "#$id");
        json_out(['ok' => true]);
        break;

    // ── Disponibilités ────────────────────────────────────────────────

    case 'availability_set':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? 0);
        $event = event_in_club_or_404($eventId, $clubId);
        if ($event['status'] === 'cancelled') json_error('Cet événement est annulé.');

        // Un admin/coach peut renseigner la dispo à la place d'un membre
        // (ex. joueur qui a oublié de répondre) — sinon, on répond pour soi.
        $targetMemberId = $myMemberId;
        if (!empty($in['target_member_id']) && (int) $in['target_member_id'] !== $myMemberId) {
            require_permission((int) $me['id'], $clubId, 'manage_events');
            $targetMemberId = (int) $in['target_member_id'];
        }

        $status = $in['status'] ?? '';
        if (!in_array($status, ['present', 'absent', 'injured'], true)) json_error('Réponse invalide.');
        $comment = trim($in['comment'] ?? '');

        $stmt = db()->prepare('SELECT status FROM event_availabilities WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$eventId, $targetMemberId]);
        $previousStatus = $stmt->fetchColumn(); // false si jamais répondu

        $stmt = db()->prepare('
            INSERT INTO event_availabilities (event_id, club_member_id, status, comment)
            VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), comment = VALUES(comment)
        ');
        $stmt->execute([$eventId, $targetMemberId, $status, $comment ?: null]);

        // Si la présence est corrigée à absent/blessé, les votes déjà enregistrés pour
        // cette séance et ce membre (donnés ou reçus) n'ont plus lieu d'être : ils
        // fausseraient les statistiques (moyenne de groupe, classement...).
        if ($status !== 'present') {
            $stmt = db()->prepare('DELETE FROM evaluations WHERE event_id = ? AND (rater_member_id = ? OR ratee_member_id = ?)');
            $stmt->execute([$eventId, $targetMemberId, $targetMemberId]);
            $stmt = db()->prepare('DELETE FROM self_evaluations WHERE event_id = ? AND club_member_id = ?');
            $stmt->execute([$eventId, $targetMemberId]);
            $stmt = db()->prepare('DELETE FROM vote_submissions WHERE event_id = ? AND club_member_id = ?');
            $stmt->execute([$eventId, $targetMemberId]);
        }

        // Notifie les admins/coachs de la réponse — alerte spécifique si c'est un
        // changement de dernière minute (moins de 2h avant le début de la séance).
        if ($previousStatus !== $status) {
            $stmt = db()->prepare("
                SELECT id FROM club_members
                WHERE club_id = ? AND status = 'active' AND role IN ('super_admin', 'admin', 'coach') AND id != ?
            ");
            $stmt->execute([$clubId, $targetMemberId]);
            $adminIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

            if ($adminIds) {
                $stmt = db()->prepare('SELECT u.first_name, u.last_name FROM club_members cm JOIN users u ON u.id = cm.user_id WHERE cm.id = ?');
                $stmt->execute([$targetMemberId]);
                $person = $stmt->fetch();
                $name = $person ? trim("{$person['first_name']} {$person['last_name']}") : 'Un membre';

                $labels = ['present' => 'présent', 'absent' => 'absent', 'injured' => 'blessé'];
                $label = $labels[$status] ?? $status;

                $secondsUntilStart = strtotime($event['starts_at']) - time();
                $isLastMinuteChange = $previousStatus !== false && $secondsUntilStart > 0 && $secondsUntilStart <= 2 * 3600;

                $text = $isLastMinuteChange
                    ? "⚠️ $name change sa présence en $label pour « {$event['title']} » à moins de 2h du début !"
                    : "$name a répondu $label pour « {$event['title']} ».";

                notify_members($adminIds, 'availability_change', $text, 'home');
            }
        }

        json_out(['ok' => true]);
        break;

    case 'availability_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        event_in_club_or_404($eventId, $clubId);

        $stmt = db()->prepare('
            SELECT cm.id AS club_member_id, u.id AS user_id, u.first_name, u.last_name, u.avatar_url,
                   ea.status, ea.comment, ea.updated_at
            FROM club_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN event_availabilities ea ON ea.club_member_id = cm.id AND ea.event_id = ?
            WHERE cm.club_id = ? AND cm.status = "active"
            ORDER BY FIELD(ea.status, "present", "injured", "absent"), u.last_name
        ');
        $stmt->execute([$eventId, $clubId]);
        json_out(['availabilities' => $stmt->fetchAll()]);
        break;

    // ── Convocations ──────────────────────────────────────────────────

    // Synchronise la liste des convoqués d'un événement
    case 'convoke_set':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_convocations');

        $eventId = (int) ($in['event_id'] ?? 0);
        $event = event_in_club_or_404($eventId, $clubId);
        if ($event['type'] !== 'match') {
            json_error('Les convocations ne concernent que les matchs (effectif limité). Pour un entraînement, la disponibilité déclarée suffit.');
        }

        $goalkeeperId = !empty($in['goalkeeper_id']) ? (int) $in['goalkeeper_id'] : null;
        $fieldIds = array_values(array_unique(array_map('intval', (array) ($in['field_ids'] ?? []))));
        $fieldIds = array_values(array_diff($fieldIds, $goalkeeperId ? [$goalkeeperId] : []));

        if (count($fieldIds) > 8) json_error('Maximum 8 joueurs de champ pour une convocation.');

        $memberIds = $goalkeeperId ? array_merge([$goalkeeperId], $fieldIds) : $fieldIds;

        // Tous les IDs doivent être des membres actifs du club ET avoir déclaré
        // "présent" à cette séance (la convocation se fait parmi les présents).
        if ($memberIds) {
            $ph = implode(',', array_fill(0, count($memberIds), '?'));
            $stmt = db()->prepare("
                SELECT COUNT(*) FROM club_members cm
                JOIN event_availabilities ea ON ea.club_member_id = cm.id AND ea.event_id = ? AND ea.status = 'present'
                WHERE cm.id IN ($ph) AND cm.club_id = ? AND cm.status = 'active'
            ");
            $stmt->execute([$eventId, ...$memberIds, $clubId]);
            if ((int) $stmt->fetchColumn() !== count($memberIds)) {
                json_error('Seuls les membres ayant répondu "présent" à cette séance peuvent être convoqués.');
            }
        }

        // Convoqués déjà en place (pour ne notifier que les nouveaux)
        $stmt = db()->prepare('SELECT club_member_id FROM convocations WHERE event_id = ?');
        $stmt->execute([$eventId]);
        $already = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        $pdo = db();
        $pdo->beginTransaction();
        try {
            if ($memberIds) {
                $ph = implode(',', array_fill(0, count($memberIds), '?'));
                $stmt = $pdo->prepare("DELETE FROM convocations WHERE event_id = ? AND club_member_id NOT IN ($ph)");
                $stmt->execute([$eventId, ...$memberIds]);
                $stmt = $pdo->prepare('INSERT INTO convocations (event_id, club_member_id, role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role = VALUES(role)');
                if ($goalkeeperId) $stmt->execute([$eventId, $goalkeeperId, 'goalkeeper']);
                foreach ($fieldIds as $mid) $stmt->execute([$eventId, $mid, 'field']);
            } else {
                $stmt = $pdo->prepare('DELETE FROM convocations WHERE event_id = ?');
                $stmt->execute([$eventId]);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $newlyConvoked = array_values(array_diff($memberIds, $already));
        if ($newlyConvoked) {
            notify_members($newlyConvoked, 'convocation', "Tu es convoqué : {$event['title']}", 'convocations');
        }
        log_action((int) $me['id'], 'convoke_set', "événement #$eventId : " . count($memberIds) . ' convoqué(s)');
        json_out(['ok' => true]);
        break;

    case 'convocation_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? ($_GET['event_id'] ?? 0));
        event_in_club_or_404($eventId, $clubId);

        $stmt = db()->prepare('
            SELECT c.club_member_id, c.role, c.status, c.responded_at, u.first_name, u.last_name
            FROM convocations c
            JOIN club_members cm ON cm.id = c.club_member_id
            JOIN users u ON u.id = cm.user_id
            WHERE c.event_id = ?
            ORDER BY FIELD(c.role, "goalkeeper", "field"), FIELD(c.status, "confirmed", "pending", "declined"), u.last_name
        ');
        $stmt->execute([$eventId]);
        json_out(['convocations' => $stmt->fetchAll()]);
        break;

    // Répondre à sa propre convocation
    case 'convocation_respond':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? 0);
        event_in_club_or_404($eventId, $clubId);

        $status = $in['status'] ?? '';
        if (!in_array($status, ['confirmed', 'declined'], true)) json_error('Réponse invalide.');

        $stmt = db()->prepare('UPDATE convocations SET status = ?, responded_at = NOW() WHERE event_id = ? AND club_member_id = ?');
        $stmt->execute([$status, $eventId, $myMemberId]);
        if (!$stmt->rowCount()) {
            // Soit pas convoqué, soit même statut déjà enregistré : distinguer
            $stmt = db()->prepare('SELECT 1 FROM convocations WHERE event_id = ? AND club_member_id = ?');
            $stmt->execute([$eventId, $myMemberId]);
            if (!$stmt->fetchColumn()) json_error('Tu n\'es pas convoqué à cet événement.', 404);
        }
        json_out(['ok' => true]);
        break;

    // Récupère la conversation de la séance si elle existe déjà, sinon la
    // crée (tous les membres actifs du club) avec le titre de la séance.
    case 'conversation_get_or_create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id((int) $me['id'], $clubId);

        $eventId = (int) ($in['event_id'] ?? 0);
        $event = event_in_club_or_404($eventId, $clubId);

        if (!empty($event['conversation_id'])) {
            $stmt = db()->prepare('SELECT title FROM conversations WHERE id = ?');
            $stmt->execute([(int) $event['conversation_id']]);
            json_out(['id' => (int) $event['conversation_id'], 'title' => $stmt->fetchColumn()]);
        }

        $title = $event['title'] . ' — ' . date('d/m', strtotime($event['starts_at']));

        $stmt = db()->prepare("SELECT id FROM club_members WHERE club_id = ? AND status = 'active' AND id != ?");
        $stmt->execute([$clubId, $myMemberId]);
        $memberIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        if (!$memberIds) json_error('Aucun autre membre actif à ajouter à la discussion.');

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO conversations (club_id, title, created_by_member_id) VALUES (?,?,?)');
            $stmt->execute([$clubId, $title, $myMemberId]);
            $convId = (int) $pdo->lastInsertId();

            $stmt = $pdo->prepare('INSERT INTO conversation_participants (conversation_id, club_member_id) VALUES (?,?)');
            foreach ([$myMemberId, ...$memberIds] as $mid) $stmt->execute([$convId, $mid]);

            $stmt = $pdo->prepare('UPDATE events SET conversation_id = ? WHERE id = ?');
            $stmt->execute([$convId, $eventId]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        json_out(['id' => $convId, 'title' => $title]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
