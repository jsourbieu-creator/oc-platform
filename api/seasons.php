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

    case 'update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_seasons');

        $id = (int) ($in['season_id'] ?? 0);
        $name = trim($in['name'] ?? '');
        $start = trim($in['start_date'] ?? '');
        $end = trim($in['end_date'] ?? '');
        if (!$id || $name === '' || $start === '' || $end === '') json_error('Saison, nom et dates requis.');

        $stmt = db()->prepare('UPDATE seasons SET name = ?, start_date = ?, end_date = ? WHERE id = ? AND club_id = ?');
        $stmt->execute([$name, $start, $end, $id, $clubId]);
        if (!$stmt->rowCount() && !season_belongs($id, $clubId)) json_error('Saison introuvable dans ce club.', 404);
        log_action((int) $me['id'], 'update_season', "#$id $name");
        json_out(['ok' => true]);
        break;

    case 'set_status':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_seasons');

        $id = (int) ($in['season_id'] ?? 0);
        $status = $in['status'] ?? '';
        if (!in_array($status, ['draft', 'active', 'closed'], true)) json_error('Statut invalide.');

        $pdo = db();
        $pdo->beginTransaction();
        try {
            if ($status === 'active') {
                // Une seule saison active à la fois : les autres actives passent en closed
                $stmt = $pdo->prepare("UPDATE seasons SET status = 'closed' WHERE club_id = ? AND status = 'active' AND id != ?");
                $stmt->execute([$clubId, $id]);
            }
            $stmt = $pdo->prepare('UPDATE seasons SET status = ? WHERE id = ? AND club_id = ?');
            $stmt->execute([$status, $id, $clubId]);
            if (!$stmt->rowCount() && !season_belongs($id, $clubId)) {
                $pdo->rollBack();
                json_error('Saison introuvable dans ce club.', 404);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        log_action((int) $me['id'], 'season_set_status', "#$id → $status");
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}

function season_belongs(int $seasonId, int $clubId): bool {
    $stmt = db()->prepare('SELECT 1 FROM seasons WHERE id = ? AND club_id = ?');
    $stmt->execute([$seasonId, $clubId]);
    return (bool) $stmt->fetchColumn();
}
