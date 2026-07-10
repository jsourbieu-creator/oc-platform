<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

/** Nombre de super_admin actifs du club (garde-fou anti-lockout). */
function active_super_admin_count(int $clubId): int {
    $stmt = db()->prepare("SELECT COUNT(*) FROM club_members WHERE club_id = ? AND role = 'super_admin' AND status = 'active'");
    $stmt->execute([$clubId]);
    return (int) $stmt->fetchColumn();
}

function get_member(int $memberId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM club_members WHERE id = ? AND club_id = ?');
    $stmt->execute([$memberId, $clubId]);
    $m = $stmt->fetch();
    if (!$m) json_error('Membre introuvable dans ce club.', 404);
    return $m;
}

switch ($action) {

    // Tous les membres du club (visible par tout membre actif)
    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT cm.id, cm.user_id, cm.role, cm.status, cm.joined_at,
                   u.first_name, u.last_name, u.email, u.phone
            FROM club_members cm JOIN users u ON u.id = cm.user_id
            WHERE cm.club_id = ?
            ORDER BY FIELD(cm.status, "active", "invited", "suspended", "archived"),
                     FIELD(cm.role, "super_admin", "admin", "coach", "board_member", "player"),
                     u.last_name, u.first_name
        ');
        $stmt->execute([$clubId]);
        json_out(['members' => $stmt->fetchAll()]);
        break;

    // Génère un code d'invitation (8 caractères, 14 jours de validité)
    case 'invite_create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_members');

        $role = $in['role'] ?? 'player';
        if (!in_array($role, ['admin', 'coach', 'board_member', 'player'], true)) {
            json_error('Rôle d\'invitation invalide.');
        }
        // Seul un super_admin peut inviter directement en admin
        if ($role === 'admin' && member_role_in((int) $me['id'], $clubId) !== 'super_admin') {
            json_error('Seul un super-admin peut inviter un administrateur.', 403);
        }
        $email = strtolower(trim($in['email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('E-mail invalide.');

        // Code lisible : pas de 0/O/1/I pour éviter les confusions à l'oral
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            $stmt = db()->prepare('SELECT 1 FROM invitations WHERE code = ?');
            $stmt->execute([$code]);
        } while ($stmt->fetchColumn());

        $expires = date('Y-m-d H:i:s', time() + 14 * 86400);
        $stmt = db()->prepare('INSERT INTO invitations (club_id, code, role, email, invited_by, expires_at) VALUES (?,?,?,?,?,?)');
        $stmt->execute([$clubId, $code, $role, $email ?: null, (int) $me['id'], $expires]);
        log_action((int) $me['id'], 'invite_create', "$code ($role)" . ($email ? " pour $email" : ''));
        json_out(['ok' => true, 'code' => $code, 'expires_at' => $expires]);
        break;

    case 'invite_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_permission((int) $me['id'], $clubId, 'manage_members');

        $stmt = db()->prepare('
            SELECT i.id, i.code, i.role, i.email, i.status, i.created_at, i.expires_at,
                   ub.first_name AS invited_by_first_name, ub.last_name AS invited_by_last_name,
                   uu.first_name AS used_by_first_name, uu.last_name AS used_by_last_name
            FROM invitations i
            LEFT JOIN users ub ON ub.id = i.invited_by
            LEFT JOIN users uu ON uu.id = i.used_by
            WHERE i.club_id = ?
            ORDER BY i.created_at DESC
        ');
        $stmt->execute([$clubId]);
        json_out(['invitations' => $stmt->fetchAll()]);
        break;

    case 'invite_revoke':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_members');

        $id = (int) ($in['invitation_id'] ?? 0);
        $stmt = db()->prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND club_id = ? AND status = 'pending'");
        $stmt->execute([$id, $clubId]);
        if (!$stmt->rowCount()) json_error('Invitation introuvable ou déjà utilisée/révoquée.', 404);
        log_action((int) $me['id'], 'invite_revoke', "#$id");
        json_out(['ok' => true]);
        break;

    // Changer le rôle d'un membre
    case 'set_role':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_members');

        $memberId = (int) ($in['member_id'] ?? 0);
        $newRole = $in['role'] ?? '';
        if (!in_array($newRole, ['super_admin', 'admin', 'coach', 'board_member', 'player'], true)) {
            json_error('Rôle invalide.');
        }
        $myRole = member_role_in((int) $me['id'], $clubId);
        $target = get_member($memberId, $clubId);

        // Toucher aux rôles admin/super_admin (dans un sens ou dans l'autre) : réservé au super_admin
        if (($newRole === 'super_admin' || $newRole === 'admin'
             || $target['role'] === 'super_admin' || $target['role'] === 'admin')
            && $myRole !== 'super_admin') {
            json_error('Seul un super-admin peut modifier les rôles administrateurs.', 403);
        }
        // Jamais rétrograder le dernier super_admin actif (lockout)
        if ($target['role'] === 'super_admin' && $newRole !== 'super_admin'
            && $target['status'] === 'active' && active_super_admin_count($clubId) <= 1) {
            json_error('Impossible : c\'est le dernier super-admin actif du club.');
        }

        $stmt = db()->prepare('UPDATE club_members SET role = ? WHERE id = ?');
        $stmt->execute([$newRole, $memberId]);
        log_action((int) $me['id'], 'member_set_role', "membre #$memberId → $newRole");
        json_out(['ok' => true]);
        break;

    // Suspendre / réactiver / archiver
    case 'set_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_members');

        $memberId = (int) ($in['member_id'] ?? 0);
        $newStatus = $in['status'] ?? '';
        if (!in_array($newStatus, ['active', 'suspended', 'archived'], true)) json_error('Statut invalide.');

        $target = get_member($memberId, $clubId);
        if ((int) $target['user_id'] === (int) $me['id'] && $newStatus !== 'active') {
            json_error('Tu ne peux pas te suspendre toi-même.');
        }
        if ($target['role'] === 'super_admin' && $target['status'] === 'active'
            && $newStatus !== 'active' && active_super_admin_count($clubId) <= 1) {
            json_error('Impossible : c\'est le dernier super-admin actif du club.');
        }

        $stmt = db()->prepare('UPDATE club_members SET status = ? WHERE id = ?');
        $stmt->execute([$newStatus, $memberId]);
        log_action((int) $me['id'], 'member_set_status', "membre #$memberId → $newStatus");
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
