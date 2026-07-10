<?php
/**
 * Olympique Castelblangeoise — config.php
 * Connexion MySQL (o2switch) + helpers communs + vérification de permissions.
 *
 * IMPORTANT : remplis les constantes DB_* avec les identifiants de ta base
 * MySQL créée dans cPanel (section « Bases de données MySQL »), puis importe
 * api/migrations/0001_init.sql via phpMyAdmin.
 */

declare(strict_types=1);

// ─────────────────────────────────────────────────────────────
// Connexion base de données
// ─────────────────────────────────────────────────────────────
// Les identifiants réels ne sont JAMAIS dans ce fichier (qui est commité sur
// GitHub, potentiellement en dépôt public) : ils vivent dans
// db-credentials.php, qui est dans .gitignore et n'existe que :
//   - en local, où tu le crées toi-même à partir de db-credentials.example.php
//   - en production, où le workflow GitHub Actions le génère depuis les
//     secrets du repo juste avant l'upload FTP (jamais commité)
require __DIR__ . '/db-credentials.php';

const TOKEN_TTL_HOURS = 24 * 14; // 2 semaines — plateforme d'usage quotidien, pas un vote ponctuel

// ─────────────────────────────────────────────────────────────
// CORS + JSON helpers
// ─────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Toute exception non attrapée renvoie un JSON explicite au lieu d'une 500 muette.
set_exception_handler(function (Throwable $e): void {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur : ' . $e->getMessage(),
        'type' => get_class($e),
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

function json_out($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_out(['error' => $message], $status);
}

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ─────────────────────────────────────────────────────────────
// Connexion PDO (singleton)
// ─────────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return $pdo;
}

function log_action(?int $actorUserId, string $action, string $details = ''): void {
    $stmt = db()->prepare('INSERT INTO audit_log (actor_user_id, action, details) VALUES (?,?,?)');
    $stmt->execute([$actorUserId, $action, $details]);
}

// ─────────────────────────────────────────────────────────────
// Auth — token bearer simple (pas de service externe)
// ─────────────────────────────────────────────────────────────
function current_user(): array {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $auth, $m)) {
        json_error('Non authentifié.', 401);
    }
    $token = $m[1];
    $stmt = db()->prepare('
        SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, t.expires_at
        FROM auth_tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token = ?
    ');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) json_error('Session invalide.', 401);
    if (strtotime($row['expires_at']) < time()) json_error('Session expirée.', 401);
    return $row;
}

/** Rôle de l'utilisateur dans un club (null si non-membre actif) */
function member_role_in(int $userId, int $clubId): ?string {
    $stmt = db()->prepare("
        SELECT role FROM club_members
        WHERE user_id = ? AND club_id = ? AND status = 'active'
    ");
    $stmt->execute([$userId, $clubId]);
    $role = $stmt->fetchColumn();
    return $role ?: null;
}

function is_club_member(int $userId, int $clubId): bool {
    return member_role_in($userId, $clubId) !== null;
}

/**
 * Équivalent PHP de la fonction has_permission() côté Postgres dans la
 * version Supabase : rôle par défaut + surcharge individuelle éventuelle.
 */
function has_permission(int $userId, int $clubId, string $permissionCode): bool {
    $stmt = db()->prepare("
        SELECT id, role FROM club_members
        WHERE user_id = ? AND club_id = ? AND status = 'active'
    ");
    $stmt->execute([$userId, $clubId]);
    $member = $stmt->fetch();
    if (!$member) return false;

    if (in_array($member['role'], ['super_admin', 'admin'], true)) {
        return true;
    }

    $stmt = db()->prepare('
        SELECT mp.granted
        FROM member_permissions mp
        JOIN permissions p ON p.id = mp.permission_id
        WHERE mp.club_member_id = ? AND p.code = ?
    ');
    $stmt->execute([$member['id'], $permissionCode]);
    $override = $stmt->fetchColumn();
    if ($override !== false) return (bool) $override;

    $stmt = db()->prepare('
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.code = ?
    ');
    $stmt->execute([$member['role'], $permissionCode]);
    return (bool) $stmt->fetchColumn();
}

/** Vérifie la permission et arrête la requête avec 403 si elle est absente. */
function require_permission(int $userId, int $clubId, string $permissionCode): void {
    if (!has_permission($userId, $clubId, $permissionCode)) {
        json_error("Permission manquante : $permissionCode", 403);
    }
}

/** Vérifie l'appartenance au club et arrête la requête avec 403 sinon. */
function require_club_member(int $userId, int $clubId): void {
    if (!is_club_member($userId, $clubId)) {
        json_error('Tu n\'es pas membre de ce club.', 403);
    }
}
