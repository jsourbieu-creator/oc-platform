-- ═══════════════════════════════════════════════════════════════════════
-- Convocations de match : distinction gardien / joueur de champ, pour
-- limiter une convocation à 1 gardien + 8 joueurs de champ maximum.
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE convocations
  ADD COLUMN role ENUM('goalkeeper','field') NOT NULL DEFAULT 'field' AFTER club_member_id;
