-- ═══════════════════════════════════════════════════════════════════════
-- Suivi manuel par membre : certificat médical (obligatoire pour être
-- convoqué à un match) et cotisation payée (lié à Yapla, pas d'API,
-- donc coché à la main par un admin).
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE club_members
  ADD COLUMN has_medical_certificate TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN has_paid TINYINT(1) NOT NULL DEFAULT 0;
