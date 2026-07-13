-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — calendrier : événements, disponibilités, convocations
-- À importer via phpMyAdmin (comme 0001 et 0003).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  club_id INT UNSIGNED NOT NULL,
  team_id INT UNSIGNED NULL, -- NULL = tout le club
  type ENUM('match','training','club_event') NOT NULL DEFAULT 'match',
  title VARCHAR(150) NOT NULL,
  opponent VARCHAR(150) NULL,
  location VARCHAR(200) NULL,
  starts_at DATETIME NOT NULL,
  meet_at DATETIME NULL, -- heure de rendez-vous (avant le début)
  notes TEXT NULL,
  status ENUM('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_availabilities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  status ENUM('available','unavailable','maybe') NOT NULL,
  comment VARCHAR(200) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_member (event_id, club_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE convocations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  club_member_id INT UNSIGNED NOT NULL,
  status ENUM('pending','confirmed','declined') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  UNIQUE KEY uniq_event_member (event_id, club_member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (club_member_id) REFERENCES club_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
