# Olympique Castelblangeoise — Plateforme (Phases 0-1-3)

Plateforme complète de gestion du club, construite phase par phase à partir
du cahier des charges. **Phase 0 : fondations** — architecture, auth, rôles
et permissions, design, navigation. Stack **100% autonome sur ton hébergement
o2switch existant** : React + PHP + MySQL, aucun service externe requis
(contrairement à une première version explorée avec Supabase, abandonnée
pour rester sur ce que tu payes déjà).

## Stack

- **Frontend** : React + Vite (comme le Ballon d'Or), build statique →
  déploiement FTP sur o2switch (cPanel) via GitHub Actions.
- **Backend** : PHP + MySQL, sur ton hébergement o2switch.
- **Design** : charte du prompt (bleu OC `#187CB5`, navy `#123A5A`, or pour
  les trophées...), Inter + Barlow Condensed.

## Ce qui est fait (Phase 0)

- Authentification e-mail/mot de passe maison (inscription, connexion,
  déconnexion) — pas de service tiers, tokens gérés en base.
- Modèle **club → membres → rôles → permissions** :
  - rôles : `super_admin`, `admin`, `coach`, `board_member`, `player` ;
  - permissions par défaut par rôle + surcharges individuelles possibles ;
  - **isolation stricte par club**, vérifiée à chaque requête API — testé :
    un joueur d'un club ne voit jamais rien d'un autre club.
- Écran de création du club au tout premier compte créé (tu deviens
  automatiquement super-administrateur).
- Saisons / équipes (tables + endpoints).
- Thème clair/sombre, navigation desktop (barre latérale) + mobile (barre
  du bas, 5 entrées + "Plus"), avec indicateur de phase par section.
- Tableau de bord connecté en direct à ta base MySQL.

## Ce qui est fait (Phase 1)

- **Équipes & saisons** : écran complet — création/édition de saisons avec
  statut (une seule saison active à la fois), création/suppression d'équipes,
  gestion des effectifs (ajout/retrait de membres, capitaine, gardien).
- **Membres** : liste complète du club, changement de rôle et de statut
  (garde-fous : impossible de rétrograder ou suspendre le dernier
  super-admin actif, ni de se suspendre soi-même ; seuls les super-admins
  touchent aux rôles administrateurs).
- **Invitations par code** : un admin génère un code à 8 caractères (14
  jours de validité, révocable) ; la personne crée son compte puis saisit le
  code sur l'écran "Rejoindre le club" — aucun envoi d'e-mail requis.
- **Profil** : modification prénom/nom/téléphone + changement de mot de passe.
- **Paramètres** : édition du nom du club (admins).
- **Administration** : journal d'audit des 100 dernières actions
  (super-admin uniquement).

⚠️ La Phase 1 nécessite d'importer `api/migrations/0003_phase1_invitations.sql`
via phpMyAdmin (comme 0001).

## Ce qui est fait (Phase 3)

- **Événements** : création/édition par les coachs et admins — matchs
  (avec adversaire), entraînements, événements club ; rattachés à une équipe
  ou à tout le club ; lieu, heure de début, heure de rendez-vous, notes ;
  annulation réversible ou suppression définitive.
- **Calendrier** : vue chronologique groupée par mois (passé masquable),
  détail par événement avec réponses de disponibilité en un tap, liste des
  réponses de tout le monde, et gestion des convocations intégrée.
- **Disponibilités** : récap des événements à venir « à renseigner » +
  réponses rapides (Disponible / Peut-être / Indisponible).
- **Convocations** : le coach coche les joueurs convoqués (synchronisation
  complète), chaque joueur confirme ou décline depuis sa page Convocations
  ou le Calendrier ; compteurs confirmés/total visibles sur chaque événement.

⚠️ La Phase 3 nécessite d'importer `api/migrations/0004_phase3_calendrier.sql`
via phpMyAdmin. La Phase 2 (fusion Ballon d'Or) reste verrouillée en
attendant les fichiers du module existant.

## Ce qui n'est PAS encore fait

Vestiaire/notifications (Phase 4),
messagerie (Phase 5 — ici en "polling" plutôt qu'en temps réel, faute de
WebSocket sur hébergement mutualisé classique), documents/médiathèque
(Phase 6), statistiques avancées/autres trophées (Phase 7), PWA (Phase 8).
Le module Ballon d'Or déjà construit (PHP/SQLite séparé) n'est pas encore
fusionné dans cette base MySQL commune — c'est la Phase 2.

## Mise en route

### 1. Créer la base MySQL sur o2switch

Dans **cPanel** (o2switch) : section "Bases de données" → **"Bases de données MySQL"** → crée une base + un utilisateur, puis ajoute-le à la base avec "Toutes les permissions". Le nom de la base et de l'utilisateur seront automatiquement préfixés par ton identifiant de compte (ex. `tonlogin_platform`).
Note le nom de la base, l'utilisateur et le mot de passe générés.

### 2. Importer le schéma

Via **phpMyAdmin** (accessible depuis cPanel, section "Bases de données") : sélectionne ta base → onglet
**Importer** → choisis `api/migrations/0001_init.sql` → Exécuter.

### 3. Configurer les identifiants — deux façons selon où tu es

**En production (déploiement via GitHub Actions)** : les identifiants ne
sont **jamais écrits dans le code**. Ajoute-les comme secrets du repo
(`Settings → Secrets and variables → Actions → New repository secret`) :
- `DB_HOST` (presque toujours `localhost` sur o2switch)
- `DB_NAME`, `DB_USER`, `DB_PASS`

Le workflow génère automatiquement `api/db-credentials.php` avec ces
valeurs juste avant l'upload FTP — ce fichier n'existe jamais dans Git,
donc **le repo peut être public sans risque**.

**En développement local** : copie `api/db-credentials.example.php` en
`api/db-credentials.php` (déjà dans `.gitignore`, ne sera jamais commité) et
remplis-le avec tes propres identifiants de test.

### 4. Développement local

```bash
npm install
npm run dev
```
Il te faudra aussi un PHP local pointant vers une base MySQL (locale ou
directement celle d'o2switch si elle autorise les connexions distantes —
sinon teste directement en ligne après déploiement).

### 5. Déploiement

1. Push le repo sur GitHub (`git clone` + édition locale recommandé, vu la
   taille du projet — contrairement au Ballon d'Or qui tenait dans un seul
   fichier collable).
2. Les secrets FTP existent déjà sur ce repo (réutilisés du projet
   cérémonie) : `O2SWITCH_HOST`, `O2SWITCH_USER`, `O2SWITCH_PASSWORD`,
   `O2SWITCH_PATH`. **Vérifie que `O2SWITCH_PATH` pointe bien vers `/club/`**
   avant de pousser — le workflow fait un `dangerous-clean-slate` (il
   supprime tout ce qu'il y a dans ce dossier à chaque déploiement), donc ce
   secret ne doit surtout pas pointer vers la racine du site.
3. Ajoute 4 nouveaux secrets (`Settings → Secrets and variables → Actions`) :
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.
4. Push sur `main` → build + déploiement FTP automatique.
5. Ouvre l'app déployée → `/signup` → crée ton compte → l'écran "Créer le
   club" apparaît automatiquement (une seule fois) → tu deviens
   super-administrateur.

En cas de souci avec cet écran, un SQL de secours est fourni dans
`api/migrations/0002_bootstrap_manuel_secours.sql`.

## Sécurité — points d'attention

- Les identifiants MySQL ne sont jamais commités : `api/db-credentials.php`
  est dans `.gitignore`, et en production le workflow GitHub Actions le
  génère depuis les secrets du repo juste avant l'upload FTP. **Ça veut
  dire que ce repo peut être rendu public sans exposer ta base de
  données** — vérifie juste que tu n'as jamais committé de vraies valeurs
  dans `db-credentials.php` par erreur avant que ce mécanisme existe (dans
  ce cas, il faudrait changer le mot de passe MySQL par sécurité, pas
  seulement le retirer du repo).
- Les mots de passe utilisateurs sont hashés (`password_hash`), jamais
  stockés en clair.
- Pas encore de confirmation d'e-mail à l'inscription (pas de service
  d'envoi configuré) — acceptable pour un usage interne de club restreint,
  à muscler plus tard si besoin (vérification par lien, limitation du
  nombre d'inscriptions, etc.).

## Prochaine étape

Dis-moi quand tu veux enchaîner sur la **Phase 1** (écrans saisons/équipes/
membres, invitations) ou si tu préfères d'abord fusionner le **Ballon d'Or**
(Phase 2) dans cette base commune.
