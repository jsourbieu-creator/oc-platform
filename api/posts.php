<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$in = body();

function my_member_id_posts(int $userId, int $clubId): int {
    $stmt = db()->prepare("SELECT id FROM club_members WHERE user_id = ? AND club_id = ? AND status = 'active'");
    $stmt->execute([$userId, $clubId]);
    $id = $stmt->fetchColumn();
    if (!$id) json_error('Tu n\'es pas membre actif de ce club.', 403);
    return (int) $id;
}

function post_in_club_or_404(int $postId, int $clubId): array {
    $stmt = db()->prepare('SELECT * FROM posts WHERE id = ? AND club_id = ?');
    $stmt->execute([$postId, $clubId]);
    $p = $stmt->fetch();
    if (!$p) json_error('Publication introuvable dans ce club.', 404);
    return $p;
}

switch ($action) {

    case 'list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $stmt = db()->prepare('
            SELECT p.*, u.first_name AS author_first_name, u.last_name AS author_last_name,
                   cm.role AS author_role,
                   (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count
            FROM posts p
            LEFT JOIN club_members cm ON cm.id = p.author_member_id
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE p.club_id = ?
            ORDER BY p.pinned DESC, p.created_at DESC
            LIMIT 100
        ');
        $stmt->execute([$clubId]);
        json_out(['posts' => $stmt->fetchAll(), 'my_member_id' => $myMemberId]);
        break;

    case 'create':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'publish_posts');
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $title = trim($in['title'] ?? '');
        $content = trim($in['content'] ?? '');
        if ($title === '' || $content === '') json_error('Titre et contenu requis.');

        $stmt = db()->prepare('INSERT INTO posts (club_id, author_member_id, title, content) VALUES (?,?,?,?)');
        $stmt->execute([$clubId, $myMemberId, $title, $content]);
        $id = (int) db()->lastInsertId();

        notify_members(
            active_member_ids($clubId, [$myMemberId]),
            'new_post',
            "Nouvelle annonce : $title",
            'vestiaire'
        );
        log_action((int) $me['id'], 'create_post', "#$id $title");
        json_out(['ok' => true, 'id' => $id]);
        break;

    case 'update':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $id = (int) ($in['post_id'] ?? 0);
        $post = post_in_club_or_404($id, $clubId);
        if ((int) $post['author_member_id'] !== $myMemberId && !has_permission((int) $me['id'], $clubId, 'moderate_content')) {
            json_error('Tu ne peux modifier que tes propres publications.', 403);
        }

        $title = trim($in['title'] ?? '');
        $content = trim($in['content'] ?? '');
        if ($title === '' || $content === '') json_error('Titre et contenu requis.');

        $stmt = db()->prepare('UPDATE posts SET title = ?, content = ? WHERE id = ?');
        $stmt->execute([$title, $content, $id]);
        log_action((int) $me['id'], 'update_post', "#$id");
        json_out(['ok' => true]);
        break;

    case 'delete':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $id = (int) ($in['post_id'] ?? 0);
        $post = post_in_club_or_404($id, $clubId);
        if ((int) $post['author_member_id'] !== $myMemberId && !has_permission((int) $me['id'], $clubId, 'moderate_content')) {
            json_error('Tu ne peux supprimer que tes propres publications.', 403);
        }

        $stmt = db()->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->execute([$id]);
        log_action((int) $me['id'], 'delete_post', "#$id");
        json_out(['ok' => true]);
        break;

    case 'pin':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_permission((int) $me['id'], $clubId, 'publish_posts');

        $id = (int) ($in['post_id'] ?? 0);
        post_in_club_or_404($id, $clubId);
        $pinned = (int) (bool) ($in['pinned'] ?? 0);

        $stmt = db()->prepare('UPDATE posts SET pinned = ? WHERE id = ?');
        $stmt->execute([$pinned, $id]);
        log_action((int) $me['id'], 'pin_post', "#$id → " . ($pinned ? 'épinglé' : 'désépinglé'));
        json_out(['ok' => true]);
        break;

    // ── Commentaires ─────────────────────────────────────────────────

    case 'comment_list':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? ($_GET['club_id'] ?? 0));
        require_club_member((int) $me['id'], $clubId);

        $postId = (int) ($in['post_id'] ?? ($_GET['post_id'] ?? 0));
        post_in_club_or_404($postId, $clubId);

        $stmt = db()->prepare('
            SELECT pc.id, pc.author_member_id, pc.content, pc.created_at,
                   u.first_name, u.last_name
            FROM post_comments pc
            LEFT JOIN club_members cm ON cm.id = pc.author_member_id
            LEFT JOIN users u ON u.id = cm.user_id
            WHERE pc.post_id = ?
            ORDER BY pc.created_at ASC
        ');
        $stmt->execute([$postId]);
        json_out(['comments' => $stmt->fetchAll()]);
        break;

    case 'comment_add':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $postId = (int) ($in['post_id'] ?? 0);
        $post = post_in_club_or_404($postId, $clubId);

        $content = trim($in['content'] ?? '');
        if ($content === '') json_error('Commentaire vide.');

        $stmt = db()->prepare('INSERT INTO post_comments (post_id, author_member_id, content) VALUES (?,?,?)');
        $stmt->execute([$postId, $myMemberId, $content]);

        // Notifie l'auteur du post (sauf s'il se répond à lui-même)
        if ($post['author_member_id'] && (int) $post['author_member_id'] !== $myMemberId) {
            notify_members([(int) $post['author_member_id']], 'new_comment', "Nouveau commentaire sur « {$post['title']} »", 'vestiaire');
        }
        json_out(['ok' => true]);
        break;

    case 'comment_delete':
        $me = current_user();
        $clubId = (int) ($in['club_id'] ?? 0);
        require_club_member((int) $me['id'], $clubId);
        $myMemberId = my_member_id_posts((int) $me['id'], $clubId);

        $commentId = (int) ($in['comment_id'] ?? 0);
        $stmt = db()->prepare('
            SELECT pc.*, p.club_id FROM post_comments pc
            JOIN posts p ON p.id = pc.post_id
            WHERE pc.id = ?
        ');
        $stmt->execute([$commentId]);
        $comment = $stmt->fetch();
        if (!$comment || (int) $comment['club_id'] !== $clubId) json_error('Commentaire introuvable.', 404);
        if ((int) $comment['author_member_id'] !== $myMemberId && !has_permission((int) $me['id'], $clubId, 'moderate_content')) {
            json_error('Tu ne peux supprimer que tes propres commentaires.', 403);
        }

        $stmt = db()->prepare('DELETE FROM post_comments WHERE id = ?');
        $stmt->execute([$commentId]);
        json_out(['ok' => true]);
        break;

    default:
        json_error('Action inconnue.', 404);
}
