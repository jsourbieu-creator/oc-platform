-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — Ballon d'Or : présence réelle, votes entre joueurs,
-- auto-évaluation, classement annuel (moyenne ajustée + assiduité).
-- À importer via phpMyAdmin (comme les précédentes).
--
-- Décisions actées avec le club avant cette migration :
--   - Vote après CHAQUE séance (entraînement + match), pas seulement les matchs.
--   - Pas de module anti-fraude (retiré du cahier des charges initial).
--   - Seuls les joueurs au statut RÉEL "présent" votent et sont notés
--     (les blessés, comme les absents, ne votent pas et ne sont pas notés).
--   - Les séances "blessure" sont EXCLUES du dénominateur du taux de
--     présence (ni présence ni absence comptée) : une blessure est subie,
--     elle ne doit pas pénaliser l'assiduité.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Paramètres de calcul par saison (configurables par un admin)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE seasons
  ADD COLUMN reliability_threshold INT UNSIGNED NOT NULL DEFAULT 10
    COMMENT 'Seuil de fiabilité (k) de la moyenne ajustée bayésienne',
  ADD COLUMN attendance_coef_min DECIMAL(3,2) NOT NULL DEFAULT 0.70
    COMMENT 'Coefficient d''assiduité minimum (taux de présence = 0%)',
  ADD COLUMN attendance_coef_range DECIMAL(3,2) NOT NULL DEFAULT 0.30
    COMMENT 'Amplitude ajoutée au minimum quand le taux de présence = 100%',
  ADD COLUMN eligibility_min_sessions INT UNSIGNED NOT NULL DEFAULT 10
    COMMENT 'Séances minimum pour intégrer le classement officiel',
  ADD COLUMN eligibility_min_attendance_pct DECIMAL(5,2) NOT NULL DEFAULT 40.00
    COMMENT 'Taux de présence minimum (%) pour le classement officiel';

-- ─────────────────────────────────────────────────────────────
-- Présence réelle validée après la séance (distincte de la dispo
-- annoncée avant / de la convocation — ce sont 3 informations séparées)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE event_attendances (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  real_status ENUM('present','absent','injured') NOT NULL,
  validated_by INT UNSIGNED NULL,
  validated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_member (event_id, club_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- Session de vote d'une séance (ouverture/clôture par le coach/admin)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE vote_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL UNIQUE,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  opened_by INT UNSIGNED NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- Évaluations entre joueurs (anonymes pour les joueurs, note 1-10 par
-- demi-point) — une note = un votant qui note un participant présent
-- ─────────────────────────────────────────────────────────────
CREATE TABLE evaluations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  rater_member_id INT UNSIGNED NOT NULL,
  ratee_member_id INT UNSIGNED NOT NULL,
  score DECIMAL(3,1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_vote (event_id, rater_member_id, ratee_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_member_id) REFERENCES club_members(id) ON DELETE CASCADE,
  FOREIGN KEY (ratee_member_id) REFERENCES club_members(id) ON DELETE CASCADE,
  CHECK (score >= 1 AND score <= 10),
  CHECK (rater_member_id <> ratee_member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- Auto-évaluations — jamais utilisées dans le classement officiel,
-- servent uniquement à la comparaison ressenti / perception du groupe
-- ─────────────────────────────────────────────────────────────
CREATE TABLE self_evaluations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  score DECIMAL(3,1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_self (event_id, club_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE,
  CHECK (score >= 1 AND score <= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- Marque qu'un votant a validé DÉFINITIVEMENT son vote pour une séance
-- (notes de tous les présents + auto-éval, en un seul envoi atomique —
-- pas de modification possible après, cf. parcours de vote rapide)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE vote_submissions (
  event_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, club_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
