-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3.1 — heure de fin optionnelle sur les événements
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE events ADD COLUMN ends_at DATETIME NULL AFTER starts_at;
