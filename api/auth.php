<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

switch ($action) {

    case 'signup':
        $email = strtolower(trim($in['email'] ?? ''));
        $password = (string) ($in['password'] ?? '');
        $firstName = trim($in['first_name'] ?? '');
        $lastName = trim($in['last_name'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('E-mail invalide.');
        if (strlen($password) < 8) json_error('Le mot de passe doit faire au moins 8 caractères.');
        if ($firstName === '' || $lastName === '') json_error('Prénom et nom requis.');

        try {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = db()->prepare('INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?,?,?,?)');
            $stmt->execute([$email, $hash, $firstName, $lastName]);
        } catch (PDOException $e) {
            json_error('Un compte existe déjà avec cet e-mail.');
        }
        $userId = (int) db()->lastInsertId();
        log_action($userId, 'signup', $email);

        json_out(['ok' => true, 'user_id' => $userId]);
        break;

    case 'login':
        $email = strtolower(trim($in['email'] ?? ''));
        $password = (string) ($in['password'] ?? '');

        $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_error('Identifiants incorrects.', 401);
        }

        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', time() + TOKEN_TTL_HOURS * 3600);
        $stmt = db()->prepare('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?,?,?)');
        $stmt->execute([$token, $user['id'], $expires]);
        log_action((int) $user['id'], 'login');

        json_out([
            'token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
            ],
            'expires_at' => $expires,
        ]);
        break;

    case 'logout':
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.+)/', $auth, $m)) {
            db()->prepare('DELETE FROM auth_tokens WHERE token = ?')->execute([$m[1]]);
        }
        json_out(['ok' => true]);
        break;

    // Profil courant + tous les clubs dont l'utilisateur est membre actif
    case 'me':
        $me = current_user();
        $stmt = db()->prepare("
            SELECT cm.club_id, cm.role, c.name AS club_name, c.short_name AS club_short_name
            FROM club_members cm JOIN clubs c ON c.id = cm.club_id
            WHERE cm.user_id = ? AND cm.status = 'active'
        ");
        $stmt->execute([$me['id']]);
        $memberships = $stmt->fetchAll();

        json_out([
            'user' => [
                'id' => (int) $me['id'],
                'email' => $me['email'],
                'first_name' => $me['first_name'],
                'last_name' => $me['last_name'],
            ],
            'memberships' => $memberships,
        ]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
