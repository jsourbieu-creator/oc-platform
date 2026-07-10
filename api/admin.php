<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    // Journal d'audit — réservé au super_admin du club.
    // NB : audit_log est global (pas de club_id) ; acceptable tant que la
    // plateforme héberge un seul club. À scoper par club si multi-club un jour.
    case 'audit_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        if (member_role_in((int) $me['id'], $clubId) !== 'super_admin') {
            json_error('Réservé au super-admin.', 403);
        }

        $limit = min(200, max(1, (int) ($in['limit'] ?? 100)));
        $stmt = db()->prepare("
            SELECT a.id, a.action, a.details, a.created_at,
                   u.first_name, u.last_name
            FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
            ORDER BY a.id DESC LIMIT $limit
        ");
        $stmt->execute();
        json_out(['entries' => $stmt->fetchAll()]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
