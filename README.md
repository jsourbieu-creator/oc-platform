# Olympique Castelblangeoise — Plateforme (Phases 0 à 7)

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

## Ce qui est fait (Phase 4)

- **Vestiaire** : fil d'annonces du club — publication par les coachs, le
  bureau et les admins (permission `publish_posts`), épinglage, modification/
  suppression (auteur ou modérateur), commentaires ouverts à tous les membres.
- **Notifications** : notification interne à chaque nouvelle annonce, à
  chaque nouvelle convocation (uniquement les nouveaux convoqués) et à chaque
  annulation d'événement (convoqués + répondants) ; commentaire → notifie
  l'auteur de l'annonce. Cloche 🔔 avec compteur non-lus dans la barre du
  haut (rafraîchi toutes les 60 s — pas de temps réel sur mutualisé), page
  dédiée avec « tout marquer lu » et navigation au tap.

⚠️ La Phase 4 nécessite d'importer `api/migrations/0006_phase4_vestiaire.sql`
via phpMyAdmin.

## Ce qui est fait (Phase 5)

- **Messagerie interne** : conversations 1-à-1 (dédupliquées : réécrire à la
  même personne rouvre le fil existant) et conversations de groupe titrées ;
  bulles style chat, compteurs de non-lus par conversation, marquage lu
  automatique à l'ouverture. Rafraîchissement par polling (fil ouvert : 8 s ;
  liste : 30 s) — pas de WebSocket possible sur hébergement mutualisé.

⚠️ La Phase 5 nécessite d'importer `api/migrations/0007_phase5_messagerie.sql`
via phpMyAdmin.

## Itérations post-Phase 5

- **Pastilles de non-lus** : badge rouge sur « Messages » et « Notifications »
  dans la barre latérale et la barre mobile (poll combiné toutes les 25 s) ;
  « Messages » remplace « Votes » (verrouillé) dans la barre mobile.
- **Mot de passe oublié** : lien sur l'écran de connexion → e-mail avec lien
  de réinitialisation (PHP `mail()`, jeton 1 h, usage unique, invalide toutes
  les sessions ouvertes). Réponse identique que l'e-mail existe ou non.
  Migration : `0008_password_resets.sql`.
- **Adhésion sans code** (plateforme mono-club) : après inscription, bouton
  « Demander à rejoindre le club » → les admins reçoivent une notification et
  valident dans Membres (statut « En attente » → « Actif », le membre est
  notifié). Le code d'invitation reste disponible en option (utile pour
  pré-attribuer un rôle).

## Ce qui est fait (Phase 2 — Ballon d'Or)

- **Présences réelles** : validation post-séance par le coach/admin
  (présent/absent/blessé), distincte de la dispo annoncée et de la
  convocation. Les blessures sont exclues du dénominateur du taux de
  présence (subies, elles ne pénalisent pas l'assiduité).
- **Votes** : session ouverte/clôturée par séance ; parcours de vote
  atomique pour chaque présent (note 1-10 par demi-point de tous les
  autres présents + auto-évaluation), validé en un seul envoi définitif —
  aucune modification possible ensuite. Pas de module anti-fraude (choix
  acté avec le club).
- **Classement** : score Ballon d'Or = moyenne ajustée (bayésienne, seuil
  de fiabilité configurable) × coefficient d'assiduité. Classement
  officiel (seuils d'éligibilité configurables) + provisoire. Réglages de
  calcul éditables par saison par un admin.
- **Mon ressenti** : comparaison auto-évaluation / moyenne reçue par
  séance, avec graphique et niveau de proximité de perception.
- **Trophées de fin de saison** : Ballon d'Or, joueur le plus régulier,
  le plus assidu, meilleure progression, ressenti le plus proche du
  groupe — plus deux trophées humoristiques optionnels (désactivés par
  défaut, à activer par un admin dans Trophées).
- **Export CSV** du classement et des présences d'une séance.

⚠️ Nécessite `api/migrations/0009_phase2_ballondor.sql`.

## Ce qui est fait (Phase 6 — Documents & médiathèque)

- Upload/téléchargement/suppression de fichiers (PDF, Word, Excel,
  images, courtes vidéos ; 20 Mo max), séparés en deux bibliothèques
  (Documents / Médiathèque) avec permissions dédiées
  (`manage_documents` / `manage_media`).
- **Stockage hors zone déployée** : les fichiers vivent dans un dossier
  séparé du dossier `/club/` (voir « Mise en route » ci-dessous) — sans
  quoi ils seraient effacés à chaque déploiement (`dangerous-clean-slate`).

⚠️ Nécessite `api/migrations/0010_phase6_files_and_trophies_setting.sql`
**et** la création du dossier de stockage + le secret `UPLOADS_DIR`
(voir Mise en route, étape 3bis).

## Ce qui est fait (Phase 7 — Statistiques collectives)

- Page Statistiques : moyenne générale du groupe, taux de réponse aux
  convocations, taux de participation aux votes, joueur le plus
  régulier/assidu, meilleure progression — à l'échelle de la saison.

## Charte de couleurs validée (15/07, après proposition visuelle)

- **Hero « prochaine séance »** : bloc pastel bleu ciel clair
  (`--hero-sky`/`--hero-sky-soft`) avec texte en encre marine
  (`--hero-ink`), plus deux formes internes floutées (un halo clair en haut
  à droite, une ombre discrète en bas à gauche) pour donner du volume sans
  jamais utiliser de bordure. Le match bascule sur un dégradé corail
  (`--kpi-coral`) avec la même logique encre foncée.
- **Tuiles KPI** : Ballon d'Or en corail (`--kpi-coral` / `--kpi-coral-ink`),
  Ma présence en lime, À venir en bleu électrique — toutes en aplat plein,
  jamais de blanc sur fond saturé, toujours la encre assortie à la teinte.
- **Statuts de présence** repris à l'identique du hero pour la cohérence :
  présent = lime, absent = rouge-corail, blessé = violet — chacun avec sa
  propre encre foncée pour le texte.
- Cette palette a été proposée visuellement (nuancier interactif) avant
  implémentation et validée telle quelle.

## Itération design/fonctionnalité du 15/07 — messagerie enrichie

- **Pièces jointes** : images, vidéos courtes et documents (PDF/Word/Excel)
  peuvent être joints à un message, via l'infrastructure de stockage déjà
  en place pour Documents/Médias (`files.php`, kind `message` — n'importe
  quel membre du club peut y uploader, contrairement aux kinds
  `document`/`media` qui restent réservés aux rôles habilités). Les images
  et vidéos s'affichent directement dans la bulle (tap pour télécharger),
  les autres fichiers en chip avec nom + taille. Les GIF passent par un
  simple upload de fichier `.gif` (pas d'intégration Giphy/Tenor — ça
  demanderait une clé d'API tierce qu'on n'a pas configurée).
- **Modifier / supprimer un message** : menu ⋮ sur ses propres messages.
  Modifier édite le contenu et marque « · modifié ». Supprimer fait une
  suppression douce (`deleted_at`) — le message devient « Message
  supprimé » en italique, sa pièce jointe est effacée du disque pour
  libérer la place. Un modérateur (`moderate_content`) peut aussi
  supprimer n'importe quel message.
- **Accès direct aux messages** : icône 💬 avec pastille de non-lus ajoutée
  dans la barre du haut, juste à côté de la cloche — visible sur mobile et
  desktop, sans avoir à passer par le menu "Plus" ou la sidebar.
- Migration : `0017_messages_attachments_edit_delete.sql`.

## Itération du 16/07 (suite) — statuts de présence : fond neutre partout, icônes colorées porteuses de sens

Après plusieurs allers-retours (4 teintes saturées → tout en bleu → retour à
de vraies couleurs), la solution retenue règle le problème à la racine :

- **Puces de comptage** : fond neutre uniforme (blanc sur le hero, gris sombre
  discret sur les cartes de liste — jamais la même teinte que le fond
  derrière, donc plus jamais invisible), avec un petit **badge d'icône
  coloré** en coin qui porte le vrai code couleur : vert (présent), rouge
  (absent), orange (blessé — jamais d'or), gris (sans réponse). L'anneau du
  badge s'adapte à la couleur du fond derrière (bleu poudré, bleu roi ou
  carte neutre) pour bien se détacher.
- **Boutons Présent/Absent/Blessé** (hero, carte de liste, modale, correction
  admin) : même logique — actif = fond blanc + icône colorée + encre marine,
  inactif = fond translucide/contour discret + icône et texte atténués à
  75-80%. Un seul repère visuel (le blanc) indique "sélectionné", peu
  importe lequel des trois c'est.
- Le badge de statut dans la liste des participants suit la même palette
  d'icônes (auparavant gris uniforme par erreur, invisible sémantiquement).

## Itération du 16/07 — palette des statuts apaisée + icônes

- **Fini l'effet guirlande de Noël** sur les pastilles de comptage et les
  boutons Présent/Absent/Blessé : au lieu de 4 teintes saturées différentes
  (lime, rouge-rose, violet, gris), la palette se resserre autour de
  l'identité bleue déjà présente partout ailleurs — présent en bleu, absent
  en rouge calmé, blessé en ambre, sans réponse en gris neutre.
- **Icônes ajoutées** dans les boutons Présent/Absent/Blessé (coche, croix,
  pansement) sur les trois emplacements où ils apparaissent (hero, carte de
  liste, modale de détail), plus la petite icône de statut dans la liste des
  participants (le "!" de blessé devient un vrai pansement, cohérent avec
  les coche/croix déjà en place pour présent/absent).

## Reconstruction du 15/07 — Ballon d'Or repensé en 3 blocs (Séances / Mon profil / Le groupe)

Après une première tentative en 5 onglets jugée "trop brouillon", la page a
été repensée autour de **moments d'usage** plutôt que de fonctionnalités :

- **Séances** (l'onglet "action") : si une séance attend un vote, une grande
  carte "Tu as une séance à noter" apparaît en premier (tap → flux de vote
  dédié à cette séance, avec retour). En dessous : séances à venir avec le
  rappel "vote après la séance", puis l'historique séance par séance
  (auto-évaluation vs moyenne reçue). `events.php:list` renvoie désormais
  `my_vote_submitted` par séance pour repérer les votes en attente sans
  requête supplémentaire.
- **Mon profil** (l'onglet "où j'en suis") : score, jauge d'éligibilité avec
  discours en clair ("si tu fais X séances de plus..."), explication
  dépliable des coefficients avec les vrais réglages du club, mon ressenti
  de la saison, et mes trophées personnels uniquement.
- **Le groupe** (l'onglet "curiosité") : classement officiel + provisoire
  complets, stats collectives, records du groupe, galerie complète des
  trophées de la saison.
- Sélecteur de saison partagé par "Mon profil" et "Le groupe" (pas
  "Séances", qui reste centré sur l'instant présent).

## Itération majeure du 15/07 — Ballon d'Or devient un vrai hub (Votes fusionné avec Classements/Stats/Trophées)

- **La page Votes devient "Ballon d'Or"**, avec 5 onglets : **Voter** (inchangé),
  **Séances** (historique perso + rappel sur les séances à venir : "vote après
  la séance"), **Classement** (position + jauge d'éligibilité + explication en
  clair des coefficients avec les vrais chiffres réglés par le club +
  classement officiel et provisoire complets), **Statistiques** (collectives
  + individuelles, tuiles colorées), **Trophées** (galerie complète de la
  saison).
- **Sélecteur de saison** commun à ces 4 onglets (au lieu de forcer la saison
  active) — permet par exemple de garder une saison de test isolée pour
  essayer le système sans polluer la vraie saison.
- **Discours explicatif pour le classement provisoire** : "Actuellement, ta
  note est de X. Si tu fais Y entraînements supplémentaires, tu seras
  éligible au classement officiel et à la remise des trophées, avant la fin
  de la saison le [date]." — plus un bloc dépliable expliquant le seuil de
  fiabilité, le coefficient de présence (avec les bornes réelles) et les
  conditions d'éligibilité (séances minimum + taux de présence minimum).
- Aucune nouvelle route API — tout réutilise `my_perception`,
  `season_rankings`, `season_settings_get`, `season_team_stats`,
  `season_trophies`, déjà en place. Les pages Statistiques/Classements/
  Trophées séparées restent dans le menu pour l'instant (pas supprimées),
  Votes/Ballon d'Or devient simplement le point d'entrée central voulu.

## Itération du 15/07 — page Votes enrichie (Séances / Classement)

- **Onglets sur la page Votes** : "Voter" (inchangé), **"Séances"** (historique
  personnel séance par séance — auto-évaluation vs moyenne reçue du groupe,
  avec l'écart coloré et le ressenti global de la saison, réutilise
  `my_perception`), **"Classement"** (ta position actuelle — score, rang
  officiel ou nombre de séances avant de l'être, top 3 du club, bouton vers
  le classement complet — réutilise `season_rankings`, aucune nouvelle
  route API nécessaire).
- Objectif : savoir où on en est (séances jouées, écart de perception,
  position au classement) sans quitter la page Votes.

## Itération design du 15/07 (suite 5) — liste de conversations façon Messenger/WhatsApp

- **Liste des messages repensée** : fini le bloc en carte fermée — avatar
  plus grand (50px, comme un vrai avatar de contact), lignes plein bord
  séparées par un simple filet fin (pas de carte), nom en gras + heure sur
  la même ligne, aperçu du dernier message en dessous avec pastille de
  non-lus ronde à droite quand pertinent — la disposition classique d'un
  inbox de messagerie plutôt qu'une liste de fiches.
- Les bulles de message (fil de discussion) gardent leur avatar par auteur
  ajouté à l'itération précédente ; ce changement-ci concerne uniquement
  l'écran de liste des conversations.

## Itération design du 15/07 (suite 4) — Bootstrap Icons + Vestiaire renommé Annonces

- **Changement de bibliothèque d'icônes** : Phosphor → **Bootstrap Icons**
  (`react-bootstrap-icons`), choisi après comparatif visuel — traits plus
  nets, plus lisibles en petite taille. Toutes les icônes de l'app migrées
  (nav, événements, statuts, trophées…), avec des équivalents sémantiques
  choisis à la main pour les icônes sport absentes du set (match → drapeau,
  entraînement → activité, événement club → ballon de fête).
- **"Vestiaire" renommé "Annonces"**, icône mégaphone — plus clair sur ce
  que fait vraiment cette section (le fil d'annonces du club). La clé
  technique interne (`view: "vestiaire"`, fichier `VestiairePage.jsx`)
  n'a pas changé, seul le libellé visible et l'icône ont bougé.
- Bonus : le bundle JS a rétréci d'environ 60 Ko grâce au tree-shaking plus
  efficace de Bootstrap Icons par rapport à Phosphor.

## Itération design du 15/07 (suite 3) — nettoyage complet de l'ancien bleu + fix lisibilité navbar

- **Tous les résidus de l'ancien bleu saturé** (`--oc-blue-deep`,
  `--oc-sky-600`, `--electric-blue`) remplacés par le bleu ciel du hero
  (`--hero-sky` + `--hero-ink`) : couleur des types d'événement
  (entraînement/événement club), case sélectionnée du calendrier mensuel,
  bouton rond "+ Ajouter", tuile KPI bleue, icônes décoratives (épingle du
  Vestiaire, écran "rejoindre un club").
- **Fix de lisibilité navbar mobile** : le label actif héritait de l'encre
  marine (foncée) — invisible sur la barre sombre. Corrigé en séparant les
  deux : le **label** reste clair (bleu ciel) sur la barre sombre, seule
  l'**icône** passe en encre marine sur son propre rond clair.
- Les boutons "primaire" classiques (Enregistrer, Créer un compte…) gardent
  pour l'instant le bleu plus saturé — à repasser en pastel si demandé.

## Itération design du 15/07 (suite 2) — cohérence charte, hero cliquable, navbar avec labels

- **Boutons de présence du hero** : le bouton actif utilise maintenant la
  vraie couleur du statut en fond (`AVAIL_FILL`) au lieu d'un blanc
  générique — même logique que partout ailleurs (badges, pastilles,
  tuiles KPI).
- **Hero cliquable vers le détail complet** : taper la zone titre/date du
  hero rouvre la liste en vue "À venir" et ouvre directement la fiche
  complète de la prochaine séance (mêmes onglets Infos/Participants que
  depuis la liste), au lieu de simplement pointer une case du calendrier.
- **Message d'état vide reformulé** : "Personne n'a encore répondu" devient
  "Sois le premier à répondre".
- **Navbar mobile** : les labels texte sont revenus sous les icônes (en
  Bricolage Grotesque) — l'icône seule ne suffisait pas à la clarté. Le
  pointeur rond bleu ciel de l'onglet actif est conservé.
- **Sidebar desktop** : l'onglet actif passe du dégradé bleu profond au
  même bleu ciel clair que le hero, texte en encre marine assortie, et
  toute la sidebar passe en Bricolage Grotesque pour matcher la
  typographie du reste de l'app.

## Itération design du 15/07 (suite) — navbar icônes seules, hero en un seul bloc

- **Navbar mobile** : icônes seules (Phosphor), plus de label texte visible ;
  l'onglet actif reçoit un **pointeur rond bleu ciel** (`--hero-sky`) derrière
  l'icône au lieu de la pilule allongée précédente — direction confirmée par
  les captures de référence (icônes seules, indicateur rond).
- **Hero "prochaine séance" fusionné** : la bande de séparation entre le
  titre/date et "Qui est là"/"Ma présence" (fond légèrement teinté + bordure
  invisible par négatif de marge) a été supprimée — c'est maintenant un
  bloc visuel continu, seule la respiration verticale sépare les sections.
  Le titre de la séance est aussi passé de 24px à 28px.
- **KPI recentrées sur 2 tuiles utiles** : Ballon d'Or (corail) et Ma
  présence (lime). La tuile "À venir" (un simple total de 46, qui ne disait
  rien à l'utilisateur) a été retirée.

## Itération design du 15/07 — retrait du statut Incertain, zéro bordure, hero actionnable

- **Statut "Incertain" retiré** : décision produit — un 4ᵉ statut obligeait à
  relancer les gens jusqu'à la dernière minute. Retour à 3 statuts nets :
  Présent / Absent / Blessé. Migration `0016_availability_remove_maybe.sql`
  (bascule les rares réponses "Incertain" déjà enregistrées en "Absent").
- **Nouvelles couleurs de statut**, bien distinctes de l'orange déjà utilisé
  ailleurs (KPI, hero) : présent en lime, absent en rouge-corail, blessé en
  violet (`--status-present/absent/injured` + `-ink`).
- **Zéro bordure sur tout le site** : sidebar, topbar, listes, avatars,
  cercle décoratif du hero, contour "aujourd'hui" du calendrier — toutes les
  bordures littérales ont été remplacées par de l'espacement ou des ombres
  douces (`box-shadow`), jamais un trait.
- **Hero "prochaine séance" repensé** : halo dégradé (au lieu du cercle à
  bordure), et surtout **actionnable directement** — "Qui est là" (avatars +
  compteur) et les 3 boutons Présent/Absent/Blessé sont dans la même carte,
  sans avoir à ouvrir autre chose. Objectif : ouvrir l'app, voir la prochaine
  séance, qui vient, et changer sa présence en un tap.
- **Salutation d'accueil** : phrase du jour piochée dans un pool d'une
  vingtaine de tournures foot (Cantona, clin d'œil Mourinho/Joga Bonito,
  ton grandiloquent façon président de club) — une phrase par jour, stable
  toute la journée, pas de flicker au rechargement.

## Passe design (post-refonte TeamPulse)

- **Icônes** : tous les emojis d'interface remplacés par `lucide-react`
  (navigation, types d'événements, notifications, trophées, boutons,
  cloche, thème) — seules les réactions du Vestiaire restent des emojis,
  car c'est du contenu, pas de l'iconographie.
- **Typographie** : Oswald → **Space Grotesk** en display (titres, chiffres,
  hero), tracking resserré (-0.02em) ; Inter conservé en texte avec
  `cv05/cv11` ; labels plus discrets (0.68rem, tracking 0.08em).
- **Couleurs** : neutres refroidis et teintés bleu (ancrés sur le blason),
  mode sombre plus profond (#0A141F) avec sémantiques translucides,
  success/warning/danger modernisés (émeraude/ambre), focus ring visible
  (accessibilité), ombres plus douces, boutons primaires en dégradé du
  blason (deep → mid).

## Ce qui n'est PAS encore fait

Profil enrichi (photo de profil, équipe pro préférée, point fort / point
faible, meilleur pied, mini-avatar) — demandé, planifié après la PWA.
Export Excel/PDF natif (le CSV couvre l'essentiel, s'ouvre dans Excel),
fusion du module Ballon d'Or cérémonie existant (PHP/SQLite séparé, projet
« awards-castelblangeoise ») dans cette base commune, PWA (Phase 8).

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

### 3bis. Dossier de stockage des fichiers (Documents/Médiathèque — Phase 6)

Le déploiement vide entièrement `O2SWITCH_PATH` (`/club/`) à chaque push. Les
fichiers uploadés doivent donc vivre **ailleurs** sur l'hébergement, sinon
ils seraient perdus au prochain déploiement.

1. Dans le gestionnaire de fichiers cPanel (ou en FTP), crée un dossier
   **en dehors** de `/club/` — par exemple un dossier `oc_uploads` à la
   racine de ton compte (à côté de `public_html`, pas dedans). Donne-lui
   les permissions d'écriture standard (755 ou 775).
2. Note son **chemin absolu sur le serveur** (visible dans cPanel, ex.
   `/home/tonlogin/oc_uploads`).
3. Ajoute un secret `UPLOADS_DIR` (`Settings → Secrets and variables →
   Actions`) avec ce chemin absolu.

Si ce secret n'est pas configuré, l'upload de fichiers échouera proprement
avec un message d'erreur clair — le reste de la plateforme continue de
fonctionner normalement.

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
3. Ajoute 5 nouveaux secrets (`Settings → Secrets and variables → Actions`) :
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `UPLOADS_DIR`.
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

Toutes les phases planifiées (0 à 7) sont livrées. Reste en option : export
Excel/PDF natif, fusion du Ballon d'Or cérémonie existant, PWA (Phase 8).
