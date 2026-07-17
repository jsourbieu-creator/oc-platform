-- ═══════════════════════════════════════════════════════════════════════
-- Nettoyage complet de la saison de démonstration 2025-2026 (exemple) :
-- la saison, ses 18 entraînements (et tout ce qui s'y rattache : présences,
-- votes, convocations — cascade automatique), et les 14 comptes de démo
-- créés pour l'occasion (les leurs club_members disparaissent avec, par
-- cascade sur user_id).
--
-- Julien Admin et Julien Sourbieu (les seuls comptes réels) ne sont pas
-- concernés.
--
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM events
WHERE club_id = (SELECT id FROM clubs ORDER BY id LIMIT 1)
  AND DATE(starts_at) BETWEEN '2025-08-01' AND '2026-06-30';

DELETE FROM seasons WHERE name = '2025-2026 (exemple)';

DELETE FROM users WHERE email LIKE '%@exemple-oc.local';
