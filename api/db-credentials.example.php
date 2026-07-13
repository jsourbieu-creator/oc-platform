<?php
/**
 * Copie ce fichier en "db-credentials.php" (même dossier) pour le
 * développement local, et remplis avec les identifiants de ta base MySQL
 * o2switch (cPanel → Bases de données MySQL).
 *
 * En production, ce fichier est généré automatiquement par le workflow
 * GitHub Actions à partir des secrets du repo — tu n'as jamais besoin de le
 * committer ni de le déposer toi-même en FTP.
 */

declare(strict_types=1);

const DB_HOST = 'localhost';           // presque toujours 'localhost' sur o2switch
const DB_NAME = 'CHANGE_ME_dbname';    // nom complet préfixé, ex. tonlogin_platform
const DB_USER = 'CHANGE_ME_user';      // ex. tonlogin_platform_user
const DB_PASS = 'CHANGE_ME_password';

// Dossier de stockage des fichiers uploadés (documents/médiathèque), en
// dehors du dossier déployé par GitHub Actions (qui est entièrement vidé
// à chaque push — voir 0010_phase6_files_and_trophies_setting.sql).
// En local : n'importe quel chemin absolu inscriptible sur ta machine.
const UPLOADS_DIR = '/tmp/oc-platform-uploads';
