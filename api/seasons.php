<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member($me['id'], $clubId);

        $stmt = db()->prepare('SELECT * FROM seasons WHERE club_id = ? ORDER BY start_date DESC');
        $stmt->execute([$clubId]);
        json_out(['seasons' => $stmt->fetchAll()]);
        break;

    case 'create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_seasons');

        $name = trim($in['name'] ?? '');
        $start = trim($in['start_date'] ?? '');
        $end = trim($in['end_date'] ?? '');
        if ($name === '' || $start === '' || $end === '') json_error('Nom, date de début et date de fin requis.');

        $stmt = db()->prepare('INSERT INTO seasons (club_id, name, start_date, end_date) VALUES (?,?,?,?)');
        $stmt->execute([$clubId, $name, $start, $end]);
        $id = (int) db()->lastInsertId();
        log_action((int) $me['id'], 'create_season', "#$id $name");
        json_out(['ok' => true, 'id' => $id]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
