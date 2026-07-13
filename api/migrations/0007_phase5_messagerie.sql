-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — messagerie interne (polling)
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE conversations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NULL, -- NULL = conversation 1-à-1 (titre déduit des participants)
  created_by_member_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_member_id) REFERENCES club_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_participants (
  conversation_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  last_read_message_id INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, club_member_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  author_member_id INT UNSIGNED NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_conv_id (conversation_id, id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (author_member_id) REFERENCES club_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
