-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — invitations par code
-- À importer via phpMyAdmin (comme 0001) : sélectionne la base → Importer.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE invitations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  code CHAR(8) NOT NULL UNIQUE,
  role ENUM('admin','coach','board_member','player') NOT NULL DEFAULT 'player',
  email VARCHAR(190) NULL, -- purement indicatif (pas d'envoi d'e-mail en Phase 1)
  status ENUM('pending','used','revoked') NOT NULL DEFAULT 'pending',
  invited_by INT UNSIGNED NULL,
  used_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
