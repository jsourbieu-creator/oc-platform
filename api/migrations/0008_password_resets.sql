-- ═══════════════════════════════════════════════════════════════════════
-- Itération — mot de passe oublié (jetons de réinitialisation)
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE password_resets (
  token CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
