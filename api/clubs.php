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

    default:
        json_error('Action inconnue.', 404);
}
