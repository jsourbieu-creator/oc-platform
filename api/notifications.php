<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

function my_member_id_notif(int $userId, int $clubId): int {
    $stmt = db()->prepare("SELECT id FROM club_members WHERE user_id = ? AND club_id = ? AND status = 'active'");
    $stmt->execute([$userId, $clubId]);
    $id = $stmt->fetchColumn();
    if (!$id) json_error('Tu n\'es pas membre actif de ce club.', 403);
    return (int) $id;
}

switch ($action) {

    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_notif((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT id, type, text, view, created_at, read_at
            FROM notifications WHERE club_member_id = ?
            ORDER BY id DESC LIMIT 100
        ');
        $stmt->execute([$myMemberId]);
        json_out(['notifications' => $stmt->fetchAll()]);
        break;

    case 'unread_count':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_notif((int) $me['id'], $clubId);

        $stmt = db()->prepare('SELECT COUNT(*) FROM notifications WHERE club_member_id = ? AND read_at IS NULL');
        $stmt->execute([$myMemberId]);
        json_out(['count' => (int) $stmt->fetchColumn()]);
        break;

    case 'mark_all_read':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_notif((int) $me['id'], $clubId);

        $stmt = db()->prepare('UPDATE notifications SET read_at = NOW() WHERE club_member_id = ? AND read_at IS NULL');
        $stmt->execute([$myMemberId]);
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
