-- ═══════════════════════════════════════════════════════════════════════
-- Discussion de séance : chaque événement peut avoir une conversation de
-- groupe associée (créée à la demande, nommée d'après la séance).
-- À importer via phpMyAdmin (comme les précédentes).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE events
  ADD COLUMN conversation_id INT UNSIGNED NULL,
  ADD FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
