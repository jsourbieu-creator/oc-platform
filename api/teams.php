<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member($me['id'], $clubId);

        $stmt = db()->prepare('SELECT * FROM teams WHERE club_id = ? ORDER BY name');
        $stmt->execute([$clubId]);
        json_out(['teams' => $stmt->fetchAll()]);
        break;

    case 'create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $seasonId = (int) ($in['season_id'] ?? 0);
        $name = trim($in['name'] ?? '');
        $category = trim($in['category'] ?? '');
        if (!$seasonId || $name === '') json_error('Saison et nom requis.');

        $stmt = db()->prepare('INSERT INTO teams (club_id, season_id, name, category) VALUES (?,?,?,?)');
        $stmt->execute([$clubId, $seasonId, $name, $category]);
        $id = (int) db()->lastInsertId();
        log_action((int) $me['id'], 'create_team', "#$id $name");
        json_out(['ok' => true, 'id' => $id]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
