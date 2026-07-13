-- ═══════════════════════════════════════════════════════════════════════
-- Réactions emoji sur les publications du Vestiaire (refonte UI/UX).
-- Une seule réaction active par membre et par publication (change = upsert).
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE post_reactions (
  post_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  emoji VARCHAR(8) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, club_member_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
