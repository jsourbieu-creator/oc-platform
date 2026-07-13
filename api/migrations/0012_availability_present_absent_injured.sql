-- ═══════════════════════════════════════════════════════════════════════
-- La disponibilité déclarée AVANT la séance passe de
-- disponible/peut-être/indisponible à présent/absent/blessé — conforme
-- au cahier des charges initial (section 4) et cohérent avec la
-- validation de présence RÉELLE après la séance (déjà en present/
-- absent/injured depuis la Phase 2).
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

-- Conversion des réponses existantes avant de changer l'ENUM
-- (available → present, unavailable → absent, maybe → absent par défaut,
-- une réponse "peut-être" n'ayant pas d'équivalent direct)
ALTER TABLE event_availabilities MODIFY status VARCHAR(20) NOT NULL;
UPDATE event_availabilities SET status = 'present' WHERE status = 'available';
UPDATE event_availabilities SET status = 'absent' WHERE status IN ('unavailable', 'maybe');
ALTER TABLE event_availabilities MODIFY status ENUM('present','absent','injured') NOT NULL;
