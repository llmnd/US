# Oulimata

Boutique en ligne Oulimata, dédiée à la vente de produits Aloe vera, avec un
espace de gestion modulable.

La configuration de développement utilise une base locale `oulumata`.
L’instance Neon `US` est une base distincte et ne réutilise pas la base locale
ou les données de l’ancienne application.

## Architecture

```text
apps/
  api/       API REST FastAPI (Python, SQLAlchemy, Alembic)
  web/       Interface Next.js App Router (TypeScript)
```

Les domaines partagent une API et une base PostgreSQL, mais gardent leurs
propres routes, schémas et règles métier. Les modules Agriculture et Élevage
peuvent être masqués depuis la fiche Entreprise sans supprimer leurs données.

### Frontend

- `apps/web/src/app/` : routes et layouts App Router.
- `apps/web/src/features/` : fonctionnalités par domaine métier.
- `apps/web/src/components/` : shell applicatif et composants partagés.
- TanStack Query est réservé au cache serveur et aux mutations API.
- Zustand est réservé à l’état d’interface partagé.
- Les composants interactifs sont explicitement client ; le rendu serveur
  reste le comportement par défaut.

### Backend

- `apps/api/src/mamari_api/core/` : configuration, base et infrastructure.
- `apps/api/src/mamari_api/api/` : composition/versionnement HTTP.
- `apps/api/src/mamari_api/modules/` : domaines métier isolés.
- Chaque domaine évoluera vers `router`, `schemas`, `service` et `repository`.
- `apps/api/migrations/` : migrations Alembic versionnées.
- `apps/api/tests/` : tests unitaires et d’API.

## Démarrage local

1. Copier `.env.example` vers `.env`, puis renseigner les identifiants réels
   de PostgreSQL dans `DATABASE_URL`. Ce fichier est lu depuis la racine du
   dépôt, même lorsque les commandes sont lancées depuis `apps/api`.
2. Démarrer PostgreSQL : `docker compose up -d db`.
3. Installer l’interface : `npm install`.
4. Lancer Next.js : `npm run dev`.
5. Dans un autre terminal, installer l’API et ses dépendances :

   ```powershell
   py -3.13 -m venv apps\api\.venv
   apps\api\.venv\Scripts\python -m pip install -e "apps\api[dev]"
   ```

6. Depuis la racine du dépôt, appliquer les migrations avant le premier
   démarrage de l’API et après chaque mise à jour qui modifie le schéma :

   ```powershell
   Set-Location apps\api
   .\.venv\Scripts\python.exe -m alembic upgrade head
   ```

   Utiliser le Python du venv est indispensable : la commande globale
   `alembic` peut lancer Conda ou un autre environnement sans les dépendances
   du projet.

   Sur Neon, configurez `DATABASE_URL` avec la chaîne directe de la base `US`
   sur la branche `production`. L’application utilise SQLAlchemy asynchrone
   avec `asyncpg`; l’API normalise automatiquement le format PostgreSQL fourni
   par Neon. Appliquez toutes les migrations avec la même commande
   `alembic upgrade head` avant de démarrer l’API.

7. Démarrer l’API avec ce même environnement :

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn mamari_api.main:app --app-dir src --reload
   ```

L’interface est disponible sur `http://localhost:3000`, l’API sur
`http://localhost:8000` et sa documentation OpenAPI sur
`http://localhost:8000/docs`. Le tableau de bord agrège les commandes et les récoltes réellement saisies.
Les graphiques Revenus et Production sont indépendants et proposent les modes
courbe, aire et colonnes ; ils restent vides tant qu’aucune donnée correspondante
n’a été enregistrée.

### Accès privé et comptes

- L’espace de travail de l’équipe reste privé. Les clients de la boutique
  peuvent créer leur compte depuis `/register` ou au moment de la commande ;
  le compte est lié à une fiche client de l’organisation de la boutique.
- Une commande boutique exige une session client. La route
  `POST /api/v1/store/orders` utilise la fiche liée au compte connecté et ne
  fait pas confiance à un identifiant client fourni par le navigateur. Les
  commandes restent en attente jusqu’à leur validation par l’équipe. Le client
  ne peut consulter que ses commandes via `GET /api/v1/store/my-orders`.
  L’équipe retrouve les commandes depuis la fiche client et met leur statut à
  jour dans Ventes.
- Au premier accès à une base vide, se connecter avec `oulumata` / `passer123m`
  crée l’organisation Oulimata et son compte propriétaire. La création ne se
  produit qu’une fois ; les connexions suivantes vérifient le compte existant.
- L’administrateur peut créer des utilisateurs dans Administration. L’API
  `POST /api/v1/organizations/users` exige un compte propriétaire ou
  administrateur, une organisation autorisée et un mot de passe d’au moins
  6 caractères. La page Administration permet aussi de gérer les rôles,
  suspendre/réactiver un accès, enregistrer le téléphone WhatsApp et la photo
  de profil des membres. Les mots de passe sont hachés avec Argon2id.
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` et `GET /api/v1/auth/me`
  gèrent les sessions avec un cookie `HttpOnly`. La connexion accepte
  l’identifiant d’équipe ou l’adresse e-mail du compte client.
- Dans Clients, sélectionner le nom d’une fiche affiche ses achats. Les cartes
  d’indicateurs du tableau de bord ouvrent leur définition et leur détail
  mensuel. Les formulaires d’unités utilisent un catalogue commun plutôt qu’une
  saisie libre.
- Dans Entreprise, les propriétaires et administrateurs peuvent masquer ou
  réafficher Agriculture et Élevage pour toute l’organisation. Leurs données
  restent conservées.
- Les routes de domaine protégées doivent utiliser la dépendance
  `get_current_membership` et exiger l’en-tête `X-Organization-ID`. Les rôles
  disponibles sont `owner`, `admin`, `manager`, `operator` et `reader`.
  Seuls les propriétaires, administrateurs et responsables peuvent gérer les
  données métier des modules ; un employé (`operator`) consulte uniquement les
  opérations qui lui sont attribuées et transmet leur avancement. Le rôle
  `reader` reste en lecture seule.
- Le module Ventes fournit les routes paginées et filtrables
  `GET /api/v1/sales/orders`, l’enregistrement d’une commande par
  `POST /api/v1/sales/orders` et le changement de statut par
  `PATCH /api/v1/sales/orders/{id}/status`. Le tableau de bord agrège les ventes
  non annulées par mois via `GET /api/v1/dashboard/overview?year=2026`.
- Le module Agriculture organise plusieurs fermes, leurs parcelles et leur
  catalogue de cultures. Les campagnes suivent le parcours planification,
  simulation sur la base des hypothèses saisies, lancement, récoltes,
  clôture, commercialisation et archivage. Les dépenses et recettes sont
  rattachées à une ferme et facultativement à une campagne ; les rapports
  agrègent les mouvements réels. Les routes principales sont
  `/api/v1/agriculture/farms`, `/crops`, `/parcels`, `/campaigns`,
  `/harvests` et `/finance/transactions`. Les photos JPEG, PNG et WebP sont
  limitées à 5 Mo en local et à 4 Mo sur Vercel ; en local elles sont stockées
  dans `UPLOAD_DIRECTORY`, et en production dans un Blob Vercel privé.
- Le module Opérations suit les tâches de l’équipe, avec échéance, priorité,
  responsable, recherche, filtres et états à faire/en cours/terminé/archivé.
  Les employés ne voient que les tâches qui leur sont attribuées et peuvent
  transmettre leur avancement ; une tâche en retard demande une justification.
  Les responsables et administrateurs suivent l’activité, consultent son
  historique et peuvent contacter un collaborateur via WhatsApp. Le tableau se
  rafraîchit automatiquement toutes les 15 secondes (sans connexion WebSocket).
  Les tâches et leurs statistiques sont isolées par organisation via
  `/api/v1/operations`.
- Le module Élevage suit les animaux individuels et les lots, leurs bâtiments,
  photos, soins et échéances, événements de reproduction, productions et
  alimentation. Les bâtiments rattachés à une ferme ajoutent automatiquement
  les coûts aux Finances et les recettes de production aux revenus. Les médias
  privés sont stockés sous `UPLOAD_DIRECTORY` en local et dans un Blob Vercel
  privé en production. La limite est de 5 Mo en local et 4 Mo sur Vercel.
- La migration `0010_operations_collaborators` ajoute les profils des membres,
  les comptes rendus des tâches et leur historique.
- Avant d’exposer le serveur sur Internet, remplacer `BOOTSTRAP_ADMIN_PASSWORD`
  par un secret propre à l’instance dans `.env`, et définir une clé
  `JWT_SECRET_KEY` unique d’au moins 32 caractères ainsi que les origines de
  confiance dans `CORS_ORIGINS`. Ne pas partager les identifiants par défaut.

## Déploiement Vercel et fichiers

Déployer le frontend et l’API comme deux projets Vercel du même dépôt :

- projet web, répertoire racine `apps/web` ;
- projet API, répertoire racine `apps/api` (FastAPI est exposé par
  `apps/api/src/index.py`).

Dans le projet API, définir `APP_ENV=production`, `DATABASE_URL` (base Neon
`US`), `JWT_SECRET_KEY` (au moins 32 caractères), `BOOTSTRAP_ADMIN_PASSWORD`,
`CORS_ORIGINS` (l’origine exacte du site web) et les identifiants du Blob
Vercel. Dans le projet web, définir `API_PROXY_URL` comme l’URL du projet API
et `NEXT_PUBLIC_API_URL=/api/v1`. Le proxy Next.js garde les appels API sur
l’origine du site, ce qui permet aux cookies de session de fonctionner.
Ajouter chaque origine Vercel de prévisualisation autorisée à `CORS_ORIGINS`.

Créer le Blob en mode **privé** : les photos et médias transitent par les
routes FastAPI qui vérifient les autorisations avant de les renvoyer. Le
mode et la région du Blob ne pouvant pas être changés ensuite, utiliser `iad1`
(US East), région choisie pour rester proche de Neon `us-east-2`. Les fichiers
restent stockés localement en développement. La limite d’envoi sur Vercel est
de 4 Mo, car les requêtes des fonctions Vercel sont limitées en taille.

Pour transférer les fichiers locaux existants, fournir les identifiants du
Blob dans `apps/api/.env.local`, puis, depuis `apps/api`, lancer :

```powershell
.\.venv\Scripts\python.exe scripts\migrate_uploads_to_blob.py
```

Le script conserve les chemins des objets attendus par l’API et vérifie chaque
téléversement en le relisant. Il ne supprime pas les fichiers locaux ; ne
retirer la copie locale qu’après vérification du site déployé. Appliquer les
migrations Alembic à Neon avant le premier déploiement de l’API.

## Base Neon

La branche `production` du projet Neon dédié contient la base `US`. Pour cette
instance, `DATABASE_URL` doit viser directement cette base. Après avoir
configuré l’URL, appliquez les migrations depuis `apps/api` :

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Le fichier [`apps/api/schema.sql`](apps/api/schema.sql) est un script autonome
contenant les 27 tables, contraintes, index et la révision Alembic
`0022_hidden_organization_modules`, sans données applicatives. Il peut être
collé dans l’éditeur SQL d’une base PostgreSQL **vide**. Ne l’exécutez pas sur
une base contenant déjà des tables. Pour la base `US` existante ou toute base
qui doit évoluer avec le code, préférez Alembic, qui reste la source de vérité.

Le script SQL et Alembic sont deux méthodes alternatives d’initialisation :
après avoir exécuté le script dans une base vide, la révision enregistrée
permet à Alembic de poursuivre avec les migrations ultérieures.

## Qualité

- `npm run lint` : ESLint frontend.
- `npm run typecheck` : vérification TypeScript.
- `npm run build` : build de production frontend.
- Depuis `apps/api` : `python -m pytest`.
- Les changements de schéma passent par Alembic ; ne pas créer les tables à
  partir des modèles automatiquement au démarrage. La migration
  `0004_agriculture` crée les tables historiques des parcelles et récoltes ;
  `0005_farm_campaign_finance` les rattache aux fermes et cultures, puis ajoute
  les campagnes et mouvements financiers en conservant les données existantes ;
  `0006_parcel_photos` ajoute la métadonnée photo des parcelles ;
  `0007_operations_tasks` ajoute le planning des tâches ;
  `0008_seed_crop_catalog` initialise le catalogue des cultures des organisations
  qui n’en possèdent pas encore ;
  `0009_livestock` ajoute les bâtiments, lots, animaux et événements d’élevage.

## Principes de conception

1. Les agrégats et règles métier appartiennent à leur domaine.
2. Les intégrations inter-domaines passent par des services explicites ; éviter
   les dépendances circulaires.
3. Les listes API sont paginées et leurs filtres explicitement validés.
4. Les dates sont enregistrées en UTC ; les montants utilisent des types
   décimaux et une devise explicite.
5. Les permissions, l’audit et l’isolation des organisations sont vérifiés sur
   chaque opération sensible côté serveur.
6. Les fichiers sont stockés hors base ; PostgreSQL conserve leurs métadonnées.
#   U S  
 