-- ═══════════════════════════════════════════════════════════════════════
-- Retrait du statut "Incertain" (maybe) — retour à 3 statuts de présence :
-- present / absent / injured. Décision produit : un statut de plus voulait
-- dire relancer les gens jusqu'à la dernière minute, trop lourd à gérer.
-- À importer via phpMyAdmin.
-- ═══════════════════════════════════════════════════════════════════════

-- Les rares réponses "maybe" déjà enregistrées basculent en "absent"
-- (mieux vaut sous-estimer la présence que la surestimer pour l'organisation).
UPDATE event_availabilities SET status = 'absent' WHERE status = 'maybe';

ALTER TABLE event_availabilities MODIFY status ENUM('present','absent','injured') NOT NULL;
