-- ═══════════════════════════════════════════════════════════════════════
-- Bootstrap manuel de secours — normalement inutile : l'app propose un
-- écran "Créer le club" automatiquement au premier compte créé (voir
-- api/clubs.php action=bootstrap, appelé depuis src/pages/NoClubScreen.jsx).
-- Ne t'en sers que si cet écran pose un problème technique.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Crée d'abord ton compte via /signup dans l'app, connecte-toi, note ton
--    user_id (visible dans la table `users` via phpMyAdmin).
-- 2) Adapte puis exécute :

INSERT INTO clubs (name, short_name, primary_color)
VALUES ('Olympique Castelblangeoise', 'OC', '#187CB5');

-- Récupère l'id créé (SELECT LAST_INSERT_ID(); ou regarde dans phpMyAdmin),
-- puis :
INSERT INTO club_members (club_id, user_id, role, status)
VALUES (1, /* <-- ton user_id */ 1, 'super_admin', 'active');
