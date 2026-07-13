<?php
/**
 * Olympique Castelblangeoise — files.php (Phase 6 : documents & médiathèque)
 *
 * Les fichiers sont stockés sur disque dans UPLOADS_DIR (défini dans
 * db-credentials.php), un dossier HORS de la zone déployée par GitHub
 * Actions — voir la migration 0010 pour l'explication complète. Seule
 * la métadonnée (titre, nom d'origine, type, taille) vit en base.
 */
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// L'upload est en multipart/form-data (pas de JSON), les autres actions
// utilisent le body JSON classique comme le reste de l'API.
$in = in_array($action, ['upload'], true) ? $_POST : body();

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 Mo
const ALLOWED_MIME = [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime',
];

function permission_for_kind(string $kind): string {
    if (!in_array($kind, ['document', 'media'], true)) json_error('Type invalide (document ou media).');
    return $kind === 'document' ? 'manage_documents' : 'manage_media';
}

function file_row_or_404(int $fileId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM club_files WHERE id = ? AND club_id = ?');
    $stmt->execute([$fileId, $clubId]);
    $f = $stmt->fetch();
    if (!$f) json_error('Fichier introuvable dans ce club.', 404);
    return $f;
}

function ensure_uploads_dir(string $sub): string {
    $dir = rtrim(UPLOADS_DIR, '/') . '/' . $sub;
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        json_error('Le dossier de stockage n\'a pas pu être créé (vérifie UPLOADS_DIR et ses permissions).', 500);
    }
    return $dir;
}

switch ($action) {

    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $kind = $in['kind'] ?? ($_GET['kind'] ?? '');
        if (!in_array($kind, ['document', 'media'], true)) json_error('Type invalide.');

        $stmt = db()->prepare('
            SELECT cf.id, cf.title, cf.original_filename, cf.mime_type, cf.size_bytes, cf.created_at,
                   u.first_name, u.last_name
            FROM club_files cf LEFT JOIN users u ON u.id = cf.uploaded_by
            WHERE cf.club_id = ? AND cf.kind = ?
            ORDER BY cf.created_at DESC
        ');
        $stmt->execute([$clubId, $kind]);
        json_out(['files' => $stmt->fetchAll()]);
        break;

    case 'upload':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        $kind = $in['kind'] ?? '';
        require_permission((int) $me['id'], $clubId, permission_for_kind($kind));

        $title = trim($in['title'] ?? '');
        if ($title === '') json_error('Titre requis.');

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            json_error('Fichier manquant ou upload échoué (code ' . ($_FILES['file']['error'] ?? 'inconnu') . ').');
        }
        $file = $_FILES['file'];
        if ($file['size'] > MAX_FILE_BYTES) json_error('Fichier trop volumineux (max 20 Mo).');

        $mime = mime_content_type($file['tmp_name']) ?: $file['type'];
        if (!in_array($mime, ALLOWED_MIME, true)) {
            json_error("Type de fichier non autorisé ($mime). Formats acceptés : PDF, Word, Excel, images, vidéo courte.");
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $stored = bin2hex(random_bytes(16)) . ($ext ? ".$ext" : '');
        $dir = ensure_uploads_dir("club_$clubId/$kind");
        if (!move_uploaded_file($file['tmp_name'], "$dir/$stored")) {
            json_error('Échec de l\'enregistrement du fichier sur le serveur.', 500);
        }

        $stmt = db()->prepare('
            INSERT INTO club_files (club_id, kind, title, original_filename, stored_filename, mime_type, size_bytes, uploaded_by)
            VALUES (?,?,?,?,?,?,?,?)
        ');
        $stmt->execute([$clubId, $kind, $title, $file['name'], $stored, $mime, (int) $file['size'], (int) $me['id']]);
        $id = (int) db()->lastInsertId();
        log_action((int) $me['id'], 'file_upload', "#$id $kind « $title »");
        json_out(['ok' => true, 'id' => $id]);
        break;

    case 'download':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $fileId = (int) ($in['file_id'] ?? ($_GET['file_id'] ?? 0));
        $f = file_row_or_404($fileId, $clubId);
        $path = rtrim(UPLOADS_DIR, '/') . "/club_{$clubId}/{$f['kind']}/{$f['stored_filename']}";
        if (!is_file($path)) json_error('Fichier absent du stockage (a-t-il été supprimé manuellement ?).', 404);

        header('Content-Type: ' . $f['mime_type']);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: attachment; filename="' . addslashes($f['original_filename']) . '"');
        readfile($path);
        exit;

    case 'delete':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        $fileId = (int) ($in['file_id'] ?? 0);
        $f = file_row_or_404($fileId, $clubId);
        require_permission((int) $me['id'], $clubId, permission_for_kind($f['kind']));

        $path = rtrim(UPLOADS_DIR, '/') . "/club_{$clubId}/{$f['kind']}/{$f['stored_filename']}";
        if (is_file($path)) @unlink($path);

        $stmt = db()->prepare('DELETE FROM club_files WHERE id = ? AND club_id = ?');
        $stmt->execute([$fileId, $clubId]);
        log_action((int) $me['id'], 'file_delete', "#$fileId « {$f['title']} »");
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
