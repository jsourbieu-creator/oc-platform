<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    // Public : permet au frontend de savoir s'il doit proposer l'écran de
    // création du premier club, sans exposer d'autre information.
    case 'setup_status':
        $count = (int) db()->query('SELECT COUNT(*) FROM clubs')->fetchColumn();
        json_out(['needs_setup' => $count === 0]);
        break;

    // À utiliser UNE SEULE FOIS : crée le tout premier club et rend l'appelant
    // super_admin. Se désactive de lui-même dès qu'un club existe déjà.
    case 'bootstrap':
        $me = current_user();
        $count = (int) db()->query('SELECT COUNT(*) FROM clubs')->fetchColumn();
        if ($count > 0) {
            json_error('Un club existe déjà : le bootstrap est désactivé. Demande à un admin de t\'inviter.', 403);
        }
        $name = trim($in['name'] ?? '');
        $shortName = trim($in['short_name'] ?? '');
        if ($name === '' || $shortName === '') json_error('Nom et nom court requis.');

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO clubs (name, short_name) VALUES (?,?)');
            $stmt->execute([$name, $shortName]);
            $clubId = (int) $pdo->lastInsertId();

            $stmt = $pdo->prepare("INSERT INTO club_members (club_id, user_id, role, status) VALUES (?,?,'super_admin','active')");
            $stmt->execute([$clubId, $me['id']]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            json_error('Erreur lors de la création du club.', 500);
        }

        log_action((int) $me['id'], 'bootstrap_club', "$name (#$clubId)");
        json_out(['ok' => true, 'club_id' => $clubId]);
        break;

    // Rejoindre un club avec un code d'invitation (Phase 1)
    case 'join_with_code':
        $me = current_user();
        $code = strtoupper(trim($in['code'] ?? ''));
        if ($code === '') json_error('Code requis.');

        $stmt = db()->prepare("SELECT * FROM invitations WHERE code = ? AND status = 'pending'");
        $stmt->execute([$code]);
        $inv = $stmt->fetch();
        if (!$inv) json_error('Code invalide, déjà utilisé ou révoqué.', 404);
        if (strtotime($inv['expires_at']) < time()) json_error('Ce code a expiré. Demande une nouvelle invitation.', 410);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT id, status FROM club_members WHERE club_id = ? AND user_id = ?');
            $stmt->execute([(int) $inv['club_id'], (int) $me['id']]);
            $existing = $stmt->fetch();

            if ($existing && $existing['status'] === 'active') {
                $pdo->rollBack();
                json_error('Tu es déjà membre actif de ce club.');
            }
            if ($existing) {
                $stmt = $pdo->prepare("UPDATE club_members SET role = ?, status = 'active' WHERE id = ?");
                $stmt->execute([$inv['role'], (int) $existing['id']]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO club_members (club_id, user_id, role, status) VALUES (?,?,?,'active')");
                $stmt->execute([(int) $inv['club_id'], (int) $me['id'], $inv['role']]);
            }
            $stmt = $pdo->prepare("UPDATE invitations SET status = 'used', used_by = ? WHERE id = ?");
            $stmt->execute([(int) $me['id'], (int) $inv['id']]);
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        log_action((int) $me['id'], 'join_with_code', $code);
        json_out(['ok' => true, 'club_id' => (int) $inv['club_id']]);
        break;

    // Modifier les paramètres du club (Phase 1)
    case 'update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'manage_club_settings');

        $name = trim($in['name'] ?? '');
        $shortName = trim($in['short_name'] ?? '');
        $color = trim($in['primary_color'] ?? '');
        if ($name === '' || $shortName === '') json_error('Nom et nom court requis.');
        if ($color !== '' && !preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) json_error('Couleur invalide (format #RRGGBB).');

        $stmt = db()->prepare('UPDATE clubs SET name = ?, short_name = ?' . ($color !== '' ? ', primary_color = ?' : '') . ' WHERE id = ?');
        $params = $color !== '' ? [$name, $shortName, $color, $clubId] : [$name, $shortName, $clubId];
        $stmt->execute($params);
        log_action((int) $me['id'], 'club_update', "$name ($shortName)");
        json_out(['ok' => true]);
        break;

    // Demande d'adhésion sans code (plateforme mono-club) : crée une
    // adhésion "invited" que les admins valident dans Membres.
    case 'request_join':
        $me = current_user();
        $club = db()->query('SELECT id, name FROM clubs ORDER BY id LIMIT 1')->fetch();
        if (!$club) json_error('Aucun club n\'existe encore.', 404);
        $clubId = (int) $club['id'];

        $stmt = db()->prepare('SELECT id, status FROM club_members WHERE club_id = ? AND user_id = ?');
        $stmt->execute([$clubId, (int) $me['id']]);
        $existing = $stmt->fetch();
        if ($existing) {
            if ($existing['status'] === 'active') json_error('Tu es déjà membre du club.');
            if ($existing['status'] === 'invited') json_error('Ta demande est déjà en attente de validation.');
            json_error('Ton adhésion a été suspendue ou archivée : contacte un administrateur.', 403);
        }

        $stmt = db()->prepare("INSERT INTO club_members (club_id, user_id, role, status) VALUES (?,?,'player','invited')");
        $stmt->execute([$clubId, (int) $me['id']]);

        // Notifie les admins actifs
        $stmt = db()->prepare("SELECT id FROM club_members WHERE club_id = ? AND role IN ('super_admin','admin') AND status = 'active'");
        $stmt->execute([$clubId]);
        notify_members(
            array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN)),
            'join_request',
            "Demande d'adhésion : {$me['first_name']} {$me['last_name']}",
            'membres'
        );
        log_action((int) $me['id'], 'request_join', $club['name']);
        json_out(['ok' => true]);
        break;

    // Statut de ma relation au club unique (null = aucune demande)
    case 'my_join_status':
        $me = current_user();
        $club = db()->query('SELECT id, name FROM clubs ORDER BY id LIMIT 1')->fetch();
        if (!$club) json_out(['club_name' => null, 'status' => null]);

        $stmt = db()->prepare('SELECT status FROM club_members WHERE club_id = ? AND user_id = ?');
        $stmt->execute([(int) $club['id'], (int) $me['id']]);
        $status = $stmt->fetchColumn() ?: null;
        json_out(['club_name' => $club['name'], 'status' => $status]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
