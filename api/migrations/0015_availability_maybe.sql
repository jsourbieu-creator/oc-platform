-- ═══════════════════════════════════════════════════════════════════════
-- Ajoute le statut "Incertain" (maybe) à la disponibilité déclarée avant
-- la séance : présent / incertain / absent / blessé. La présence RÉELLE
-- validée après coup par le coach (event_attendances) reste à 3 valeurs
-- (present/absent/injured) — un coach doit trancher, pas rester incertain.
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE event_availabilities MODIFY status VARCHAR(20) NOT NULL;
ALTER TABLE event_availabilities MODIFY status ENUM('present','maybe','absent','injured') NOT NULL;
