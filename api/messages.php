<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

function my_member_id_msg(int $userId, int $clubId): int {
    $stmt = db()->prepare("SELECT id FROM club_members WHERE user_id = ? AND club_id = ? AND status = 'active'");
    $stmt->execute([$userId, $clubId]);
    $id = $stmt->fetchColumn();
    if (!$id) json_error('Tu n\'es pas membre actif de ce club.', 403);
    return (int) $id;
}

/** La conversation doit appartenir au club ET inclure ce membre. */
function my_conversation_or_404(int $convId, int $clubId, int $myMemberId): array {
    $stmt = db()->prepare('
        SELECT c.* FROM conversations c
        JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE c.id = ? AND c.club_id = ? AND cp.club_member_id = ?
    ');
    $stmt->execute([$convId, $clubId, $myMemberId]);
    $c = $stmt->fetch();
    if (!$c) json_error('Conversation introuvable.', 404);
    return $c;
}

switch ($action) {

    case 'conversations_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_msg((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT c.id, c.title, cp.last_read_message_id,
                   (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                   (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
                   (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.id > cp.last_read_message_id AND (m.author_member_id IS NULL OR m.author_member_id != cp.club_member_id)) AS unread
            FROM conversations c
            JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.club_member_id = ?
            WHERE c.club_id = ?
            ORDER BY last_message_at IS NULL, last_message_at DESC, c.created_at DESC
        ');
        $stmt->execute([$myMemberId, $clubId]);
        $conversations = $stmt->fetchAll();

        if ($conversations) {
            $ids = array_column($conversations, 'id');
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $stmt = db()->prepare("
                SELECT cp.conversation_id, cp.club_member_id, u.id AS user_id, u.first_name, u.last_name, u.avatar_url
                FROM conversation_participants cp
                JOIN club_members cm ON cm.id = cp.club_member_id
                JOIN users u ON u.id = cm.user_id
                WHERE cp.conversation_id IN ($ph)
            ");
            $stmt->execute($ids);
            $byConv = [];
            foreach ($stmt->fetchAll() as $p) $byConv[$p['conversation_id']][] = $p;
            foreach ($conversations as &$c) $c['participants'] = $byConv[$c['id']] ?? [];
            unset($c);
        }
        json_out(['conversations' => $conversations, 'my_member_id' => $myMemberId]);
        break;

    case 'conversation_create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_msg((int) $me['id'], $clubId);

        $memberIds = array_values(array_unique(array_map('intval', (array) ($in['member_ids'] ?? []))));
        $memberIds = array_values(array_diff($memberIds, [$myMemberId]));
        if (!$memberIds) json_error('Choisis au moins un destinataire.');

        $ph = implode(',', array_fill(0, count($memberIds), '?'));
        $stmt = db()->prepare("SELECT COUNT(*) FROM club_members WHERE id IN ($ph) AND club_id = ? AND status = 'active'");
        $stmt->execute([...$memberIds, $clubId]);
        if ((int) $stmt->fetchColumn() !== count($memberIds)) {
            json_error('Certains destinataires sont introuvables ou inactifs dans ce club.');
        }

        $title = trim($in['title'] ?? '');
        if (count($memberIds) > 1 && $title === '') json_error('Un titre est requis pour une conversation de groupe.');

        // 1-à-1 : réutilise la conversation existante entre ces deux membres
        if (count($memberIds) === 1 && $title === '') {
            $stmt = db()->prepare('
                SELECT c.id FROM conversations c
                JOIN conversation_participants a ON a.conversation_id = c.id AND a.club_member_id = ?
                JOIN conversation_participants b ON b.conversation_id = c.id AND b.club_member_id = ?
                WHERE c.club_id = ? AND c.title IS NULL
                  AND (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) = 2
                LIMIT 1
            ');
            $stmt->execute([$myMemberId, $memberIds[0], $clubId]);
            $existing = $stmt->fetchColumn();
            if ($existing) json_out(['ok' => true, 'id' => (int) $existing, 'existing' => true]);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO conversations (club_id, title, created_by_member_id) VALUES (?,?,?)');
            $stmt->execute([$clubId, $title ?: null, $myMemberId]);
            $convId = (int) $pdo->lastInsertId();

            $stmt = $pdo->prepare('INSERT INTO conversation_participants (conversation_id, club_member_id) VALUES (?,?)');
            foreach ([$myMemberId, ...$memberIds] as $mid) $stmt->execute([$convId, $mid]);
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        json_out(['ok' => true, 'id' => $convId]);
        break;

    // Messages d'une conversation. after_id > 0 → uniquement les nouveaux (polling).
    // Marque automatiquement comme lu ce qui est renvoyé.
    case 'messages_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_msg((int) $me['id'], $clubId);

        $convId = (int) ($in['conversation_id'] ?? ($_GET['conversation_id'] ?? 0));
        my_conversation_or_404($convId, $clubId, $myMemberId);

        $afterId = (int) ($in['after_id'] ?? 0);
        $stmt = db()->prepare('
            SELECT m.id, m.author_member_id, m.content, m.created_at,
                   u.id AS user_id, u.first_name, u.last_name, u.avatar_url
            FROM messages m
            LEFT JOIN club_members cm ON cm.id = m.author_member_id
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE m.conversation_id = ? AND m.id > ?
            ORDER BY m.id ASC
            LIMIT 200
        ');
        $stmt->execute([$convId, $afterId]);
        $messages = $stmt->fetchAll();

        if ($messages) {
            $maxId = (int) end($messages)['id'];
            $stmt = db()->prepare('UPDATE conversation_participants SET last_read_message_id = GREATEST(last_read_message_id, ?) WHERE conversation_id = ? AND club_member_id = ?');
            $stmt->execute([$maxId, $convId, $myMemberId]);
        }
        json_out(['messages' => $messages, 'my_member_id' => $myMemberId]);
        break;

    case 'message_send':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_msg((int) $me['id'], $clubId);

        $convId = (int) ($in['conversation_id'] ?? 0);
        my_conversation_or_404($convId, $clubId, $myMemberId);

        $content = trim($in['content'] ?? '');
        if ($content === '') json_error('Message vide.');
        if (mb_strlen($content) > 4000) json_error('Message trop long (4000 caractères max).');

        $stmt = db()->prepare('INSERT INTO messages (conversation_id, author_member_id, content) VALUES (?,?,?)');
        $stmt->execute([$convId, $myMemberId, $content]);
        $id = (int) db()->lastInsertId();

        // L'expéditeur a évidemment lu son propre message
        $stmt = db()->prepare('UPDATE conversation_participants SET last_read_message_id = GREATEST(last_read_message_id, ?) WHERE conversation_id = ? AND club_member_id = ?');
        $stmt->execute([$id, $convId, $myMemberId]);

        json_out(['ok' => true, 'id' => $id]);
        break;

    case 'unread_total':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_msg((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT COUNT(*) FROM messages m
            JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.club_member_id = ?
            WHERE m.id > cp.last_read_message_id AND (m.author_member_id IS NULL OR m.author_member_id != ?)
        ');
        $stmt->execute([$myMemberId, $myMemberId]);
        json_out(['count' => (int) $stmt->fetchColumn()]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
