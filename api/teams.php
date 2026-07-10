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

    case 'update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $id = (int) ($in['team_id'] ?? 0);
        $name = trim($in['name'] ?? '');
        $category = trim($in['category'] ?? '');
        if (!$id || $name === '') json_error('Équipe et nom requis.');

        $stmt = db()->prepare('UPDATE teams SET name = ?, category = ? WHERE id = ? AND club_id = ?');
        $stmt->execute([$name, $category ?: null, $id, $clubId]);
        log_action((int) $me['id'], 'update_team', "#$id $name");
        json_out(['ok' => true]);
        break;

    case 'delete':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $id = (int) ($in['team_id'] ?? 0);
        $stmt = db()->prepare('DELETE FROM teams WHERE id = ? AND club_id = ?');
        $stmt->execute([$id, $clubId]);
        if (!$stmt->rowCount()) json_error('Équipe introuvable dans ce club.', 404);
        log_action((int) $me['id'], 'delete_team', "#$id");
        json_out(['ok' => true]);
        break;

    // Effectif d'une équipe
    case 'roster_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member($me['id'], $clubId);

        $teamId = (int) ($in['team_id'] ?? ($_GET['team_id'] ?? 0));
        team_in_club_or_404($teamId, $clubId);

        $stmt = db()->prepare('
            SELECT tm.id, tm.club_member_id, tm.is_captain, tm.is_goalkeeper,
                   u.first_name, u.last_name, cm.role
            FROM team_members tm
            JOIN club_members cm ON cm.id = tm.club_member_id
            JOIN users u ON u.id = cm.user_id
            WHERE tm.team_id = ?
            ORDER BY tm.is_captain DESC, u.last_name, u.first_name
        ');
        $stmt->execute([$teamId]);
        json_out(['roster' => $stmt->fetchAll()]);
        break;

    case 'roster_add':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $teamId = (int) ($in['team_id'] ?? 0);
        $clubMemberId = (int) ($in['club_member_id'] ?? 0);
        team_in_club_or_404($teamId, $clubId);

        // Le membre doit appartenir au même club (isolation stricte)
        $stmt = db()->prepare("SELECT 1 FROM club_members WHERE id = ? AND club_id = ? AND status = 'active'");
        $stmt->execute([$clubMemberId, $clubId]);
        if (!$stmt->fetchColumn()) json_error('Membre introuvable ou inactif dans ce club.', 404);

        try {
            $stmt = db()->prepare('INSERT INTO team_members (team_id, club_member_id) VALUES (?,?)');
            $stmt->execute([$teamId, $clubMemberId]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') json_error('Ce membre est déjà dans l\'équipe.');
            throw $e;
        }
        log_action((int) $me['id'], 'roster_add', "équipe #$teamId ← membre #$clubMemberId");
        json_out(['ok' => true]);
        break;

    case 'roster_remove':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $teamId = (int) ($in['team_id'] ?? 0);
        $rowId = (int) ($in['team_member_id'] ?? 0);
        team_in_club_or_404($teamId, $clubId);

        $stmt = db()->prepare('DELETE FROM team_members WHERE id = ? AND team_id = ?');
        $stmt->execute([$rowId, $teamId]);
        if (!$stmt->rowCount()) json_error('Joueur introuvable dans cette équipe.', 404);
        log_action((int) $me['id'], 'roster_remove', "équipe #$teamId → ligne #$rowId");
        json_out(['ok' => true]);
        break;

    case 'roster_set_flags':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission($me['id'], $clubId, 'manage_teams');

        $teamId = (int) ($in['team_id'] ?? 0);
        $rowId = (int) ($in['team_member_id'] ?? 0);
        team_in_club_or_404($teamId, $clubId);

        $isCaptain = (int) (bool) ($in['is_captain'] ?? 0);
        $isGoalkeeper = (int) (bool) ($in['is_goalkeeper'] ?? 0);
        $stmt = db()->prepare('UPDATE team_members SET is_captain = ?, is_goalkeeper = ? WHERE id = ? AND team_id = ?');
        $stmt->execute([$isCaptain, $isGoalkeeper, $rowId, $teamId]);
        log_action((int) $me['id'], 'roster_set_flags', "équipe #$teamId ligne #$rowId cap=$isCaptain gb=$isGoalkeeper");
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}

function team_in_club_or_404(int $teamId, int $clubId): void {
    $stmt = db()->prepare('SELECT 1 FROM teams WHERE id = ? AND club_id = ?');
    $stmt->execute([$teamId, $clubId]);
    if (!$stmt->fetchColumn()) json_error('Équipe introuvable dans ce club.', 404);
}
