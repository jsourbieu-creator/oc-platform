-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 (documents/médiathèque) + complément Phase 2 (trophées) +
-- Phase 7 (statistiques collectives, calculées à la volée — pas de table).
-- À importer via phpMyAdmin (comme les précédentes).
--
-- IMPORTANT — stockage des fichiers uploadés :
-- Le déploiement GitHub Actions fait un "clean slate" du dossier de l'app
-- à CHAQUE push (il supprime tout avant de réuploader). Les fichiers de
-- cette bibliothèque doivent donc être stockés dans un dossier HORS de ce
-- dossier déployé, sans quoi ils seraient effacés au prochain déploiement.
-- Voir le README pour la création de ce dossier + le secret UPLOADS_DIR.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE seasons
  ADD COLUMN humorous_trophies_enabled TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Trophées humoristiques (section 29) — désactivés par défaut, opt-in admin';

CREATE TABLE club_files (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  kind ENUM('document','media') NOT NULL,
  title VARCHAR(150) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL COMMENT 'Nom unique sur disque, hors dossier déployé',
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  uploaded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_club_files_kind ON club_files (club_id, kind, created_at);
