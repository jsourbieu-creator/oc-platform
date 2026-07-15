-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie enrichie : pièces jointes (images/vidéos/documents/gifs via
-- l'infrastructure de fichiers existante), modification et suppression
-- (douce) des messages.
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE messages
  MODIFY content TEXT NOT NULL DEFAULT '',
  ADD COLUMN attachment_file_id INT UNSIGNED NULL AFTER content,
  ADD COLUMN edited_at DATETIME NULL AFTER created_at,
  ADD COLUMN deleted_at DATETIME NULL AFTER edited_at,
  ADD FOREIGN KEY (attachment_file_id) REFERENCES club_files(id) ON DELETE SET NULL;
