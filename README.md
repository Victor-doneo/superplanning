# Doneo Réparation — Planification

Application web de suivi des unités en réparation et de la charge de travail
des techniciens, sur les lignes de test et de réparation.

## Architecture (important)

Cette app **ne duplique aucune donnée existante** de votre projet Supabase :

- Les unités/appareils sont lus **en direct** depuis la vue existante
  `export_devices_report`.
- Les techniciens sont lus **en direct** depuis la table existante `users`
  (filtrée sur `roles` contenant `"Réparation"`).
- **Une seule nouvelle table** est ajoutée : `repair_assignments`, qui stocke
  uniquement ce qui n'existe nulle part ailleurs — le technicien affecté,
  l'action à mener et le commentaire, par code-barres.

Ces lectures ne se font **jamais directement depuis le navigateur** : une
fonction serveur (`netlify/functions/planning.js`) utilise la clé
`service_role` (secrète, jamais exposée au client) pour interroger ces
tables/vues, après avoir vérifié que l'utilisateur est bien connecté. Ainsi,
aucune politique RLS existante n'a besoin d'être modifiée.

```
Navigateur (React) --token Supabase Auth--> Fonction Netlify --service_role--> Supabase
                                                                (export_devices_report,
                                                                 users, repair_assignments)
```

## Authentification

L'app utilise **Supabase Auth natif** (email + mot de passe), complètement
indépendant de votre table `users` existante (qui semble alimentée par un
autre système). Ça n'ajoute qu'une couche de connexion à `auth.users`
(schéma interne de Supabase), sans toucher à vos tables `public.*`.

**Créer un accès pour quelqu'un** : Supabase → Authentication → Users → *Add
user* → renseigner email + mot de passe. La personne peut ensuite se
connecter sur cette application avec ces identifiants (indépendants de ses
identifiants sur vos autres outils).

## Mise en route

### 1. Ajouter la table manquante

Dans l'éditeur SQL Supabase, exécuter `supabase_schema.sql` — crée
uniquement `repair_assignments` (RLS activé, aucune policy publique : accès
exclusivement via la fonction serveur).

### 2. Charger les affectations depuis l'Excel (optionnel, données de départ)

```bash
npm run seed -- chemin/vers/Prépa_FT.xlsm
```

Génère `supabase_seed.sql` (uniquement des upserts dans `repair_assignments`
à partir de la feuille "Affectation"). Exécuter ce fichier dans l'éditeur SQL
Supabase.

### 3. Configurer les variables d'environnement

Le fichier `.env` (client, `VITE_...`) sert uniquement à l'authentification :

```bash
cp .env.example .env
# VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Project Settings → API)
```

La fonction serveur a besoin, elle, de variables **côté Netlify uniquement**
(jamais dans `.env` du client, jamais commitées) :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (clé secrète — Project Settings → API → `service_role`)

En local, pour tester la fonction avec `netlify dev`, créer un fichier
`.env` à la racine contenant aussi ces deux variables (non préfixées
`VITE_`), ou les exporter dans le shell avant `netlify dev`.

### 4. Lancer

```bash
npm install
npm run dev        # front seul (la fonction ne répondra pas en local sans netlify dev)
# ou, pour tester front + fonction ensemble :
npx netlify dev
```

### 5. Créer votre tout premier compte admin (une seule fois)

Il faut un premier compte admin pour pouvoir se connecter et créer les
autres depuis l'app. Cette seule étape passe encore par le tableau de bord
Supabase :

1. Supabase → Authentication → Users → Add user (email + mot de passe,
   cochez "Auto Confirm User" si l'option existe).
2. Ouvrez `supabase_schema.sql`, section "Rôles des comptes de connexion",
   copiez la requête "Pour un compte ADMIN", adaptez l'email, exécutez-la
   dans l'éditeur SQL Supabase.

**Après cette étape unique**, connectez-vous à l'app avec ce compte, allez
dans l'onglet **Accès**, et créez tous les autres comptes (admins et
techniciens) directement depuis l'interface — plus besoin de retourner sur
le tableau de bord Supabase.

- Compte **admin** : accède à Planification (vue complète, affectation),
  Collaborateurs et Accès.
- Compte **technicien** : accède uniquement à "Mes tâches" — les appareils
  qui lui sont affectés, avec son propre commentaire et un bouton "Tâche
  réalisée". Il ne voit ni les autres techniciens, ni les autres appareils,
  ni l'écran Accès.

### 6. Déployer sur Netlify

1. Pousser ce dépôt sur GitHub, puis l'importer dans Netlify.
2. Site settings → Environment variables, ajouter les **4** variables :
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Build command `npm run build`, publish directory `dist` (déjà dans
   `netlify.toml`), fonctions dans `netlify/functions`.

## Structure

```
src/
  App.jsx                routes + AuthProvider
  AuthContext.jsx         session Supabase Auth
  RequireAuth.jsx          garde d'accès (redirige vers /login)
  usePlanningData.js       hook : appelle la fonction serveur
  Layout.jsx               sidebar + déconnexion
  supabaseClient.js         client Supabase (auth uniquement)
  pages/
    Login.jsx
    Planification.jsx      onglet principal
    Collaborateurs.jsx      équipe & charge
netlify/functions/
  planning.js              lecture sécurisée (service_role) des données existantes + repair_assignments
supabase_schema.sql        SEULE nouvelle table : repair_assignments
supabase_seed.sql          affectations initiales (généré depuis Prépa_FT.xlsm)
scripts/seed-from-excel.mjs  régénère le seed depuis un nouvel export
```

## Modèle de données

- **`export_devices_report`** (existant, lecture seule) — unités : code-barres,
  statut, `area` (= Ligne), `subarea` (= Banc), marque, type, pannes.
- **`users`** (existant, lecture seule, filtré sur `roles` ⊇ `Réparation`) —
  techniciens.
- **`repair_assignments`** (nouvelle table) — barcode, technicien, action,
  commentaire : le seul ajout à votre base.
