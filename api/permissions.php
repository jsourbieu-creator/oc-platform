<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    case 'check':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        $code = trim($in['code'] ?? '');
        if (!$clubId || $code === '') json_error('club_id et code requis.');
        json_out(['granted' => has_permission((int) $me['id'], $clubId, $code)]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
