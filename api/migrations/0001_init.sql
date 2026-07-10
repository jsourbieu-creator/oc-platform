-- ═══════════════════════════════════════════════════════════════════════
-- Phase 0 — Fondations (MySQL / MariaDB, hébergement o2switch)
-- À importer via phpMyAdmin (accessible depuis cPanel) ou : mysql -u <user> -p <db> < 0001_init.sql
-- ═══════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────
-- users — pas de service d'auth externe : on gère tout nous-mêmes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  avatar_url VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_tokens (
  token CHAR(64) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- clubs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE clubs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  short_name VARCHAR(20) NOT NULL,
  logo_url VARCHAR(255) NULL,
  primary_color CHAR(7) NOT NULL DEFAULT '#187CB5',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- club_members — pivot central : appartenance + rôle
-- ─────────────────────────────────────────────────────────────
CREATE TABLE club_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('super_admin','admin','coach','board_member','player') NOT NULL DEFAULT 'player',
  status ENUM('invited','active','suspended','archived') NOT NULL DEFAULT 'invited',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_club_user (club_id, user_id),
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- permissions / role_permissions / member_permissions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permissions (
  role ENUM('super_admin','admin','coach','board_member','player') NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role, permission_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE member_permissions (
  club_member_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  granted TINYINT(1) NOT NULL, -- 1 = accorde en plus du rôle, 0 = retire explicitement
  PRIMARY KEY (club_member_id, permission_id),
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- seasons / teams / team_members
-- ─────────────────────────────────────────────────────────────
CREATE TABLE seasons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE teams (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  season_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NULL,
  color CHAR(7) NULL,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE team_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  is_captain TINYINT(1) NOT NULL DEFAULT 0,
  is_goalkeeper TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_team_member (team_id, club_member_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- audit_log — traçabilité des actions sensibles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════════════
-- Données de référence : permissions + mapping par défaut par rôle
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO permissions (code, label) VALUES
  ('manage_club_settings', 'Modifier les paramètres du club'),
  ('manage_members',       'Gérer les membres et leurs rôles'),
  ('manage_seasons',       'Créer/gérer les saisons'),
  ('manage_teams',         'Créer/gérer les équipes'),
  ('manage_events',        'Créer/gérer les événements'),
  ('manage_convocations',  'Gérer les convocations'),
  ('confirm_attendance',   'Confirmer les présences réelles'),
  ('manage_votes',         'Ouvrir/clôturer les sessions de vote'),
  ('publish_posts',        'Publier dans le Vestiaire'),
  ('manage_documents',     'Gérer la bibliothèque de documents'),
  ('manage_media',         'Gérer la médiathèque'),
  ('moderate_content',     'Modérer commentaires/messages signalés');

INSERT INTO role_permissions (role, permission_id)
SELECT 'coach', id FROM permissions
WHERE code IN ('manage_events','manage_convocations','confirm_attendance','manage_votes','publish_posts');

INSERT INTO role_permissions (role, permission_id)
SELECT 'board_member', id FROM permissions
WHERE code IN ('manage_events','publish_posts','manage_documents','manage_media','moderate_content');

-- player : aucune permission de gestion par défaut
