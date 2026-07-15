-- ═══════════════════════════════════════════════════════════════════════
-- Profil enrichi : informations complémentaires que chacun peut renseigner
-- sur soi-même (taille, poids, pied fort, joueur préféré, équipe préférée).
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN height_cm SMALLINT UNSIGNED NULL AFTER phone,
  ADD COLUMN weight_kg SMALLINT UNSIGNED NULL AFTER height_cm,
  ADD COLUMN strong_foot ENUM('left','right','both') NULL AFTER weight_kg,
  ADD COLUMN favorite_player VARCHAR(100) NULL AFTER strong_foot,
  ADD COLUMN favorite_team VARCHAR(100) NULL AFTER favorite_player;
