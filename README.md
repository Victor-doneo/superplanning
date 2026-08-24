# Doneo Réparation — Planification

Application web de suivi des unités en réparation et de la charge de travail
des techniciens, sur les lignes de test et de réparation.

## Architecture (important)

Cette app **ne duplique aucune donnée existante** de votre projet Supabase :

- Les unités/appareils sont lus **en direct** depuis la vue existante
  `export_devices_report`.
- Les techniciens/admins sont lus **en direct** depuis la table existante
  `users` — le rôle dans l'app est déduit automatiquement de
  `users.roles` : contient `"Admin réparation"` → admin,
  contient `"Réparation"` → technicien.
- **Deux nouvelles tables** sont ajoutées, sans lien de dépendance sur vos
  autres tables :
  - `repair_assignments` : technicien affecté / action / commentaire /
    suivi "depuis combien de temps" par appareil.
  - `repair_pins` : le code PIN (haché) de connexion de chaque personne.

Ces lectures/écritures ne se font **jamais directement depuis le
navigateur** : des fonctions serveur (`netlify/functions/*.js`) utilisent la
clé `service_role` (secrète), après avoir vérifié un jeton de session signé
par le serveur. Aucune politique RLS existante n'a besoin d'être modifiée,
et **aucun compte Supabase Auth n'est utilisé**.

```
Navigateur (React) --jeton signé--> Fonctions Netlify --service_role--> Supabase
                                        (login, planning, assign, pins)
```

## Connexion : nom + code PIN (pas de compte à créer)

Pas d'email ni de mot de passe : chaque personne choisit son nom dans une
liste (tirée de `users`, filtrée sur les rôles "Réparation" /
"Admin réparation") puis tape un code à 4 chiffres.

- **Rôle automatique** : basé sur `users.roles` — pas de gestion de compte à
  faire à part définir le PIN.
- **Sécurité du PIN** : haché (jamais stocké en clair), verrouillage 15 min
  après 5 essais incorrects.
- ⚠️ Un code à 4 chiffres reste un niveau de sécurité modeste (pensé pour un
  usage interne d'atelier). Ne l'utilisez pas pour protéger des données
  sensibles au-delà de ce contexte.

### Définir le PIN de quelqu'un

Connecté en tant qu'admin, allez dans l'onglet **Accès** → à côté de la
personne, cliquez "Définir le PIN" (un code aléatoire est proposé,
modifiable) → Valider. Communiquez-le à la personne concernée.

### Tout premier accès admin (bootstrap, une seule fois)

Comme il faut être connecté pour définir un PIN depuis l'app, le tout
premier PIN doit être créé directement en base, une seule fois :

1. Repérez votre `id` dans la table `users` (Supabase → Table Editor →
   `users`, cherchez votre ligne).
2. Dans l'éditeur SQL Supabase :
   ```sql
   -- Remplacez 'VOTRE_USER_ID' et '1234' (choisissez un vrai PIN)
   insert into repair_pins (user_id, pin_hash)
   values ('VOTRE_USER_ID', crypt('1234', gen_salt('bf')))
   on conflict (user_id) do update set pin_hash = excluded.pin_hash;
   ```
   Si `crypt`/`gen_salt` ne sont pas disponibles (extension `pgcrypto` non
   activée), activez-la d'abord : `create extension if not exists pgcrypto;`
3. Connectez-vous à l'app avec ce PIN, puis créez tous les autres PIN depuis
   l'onglet Accès.

## Mise en route

### 1. Ajouter les tables manquantes

Dans l'éditeur SQL Supabase, exécuter `supabase_schema.sql` — crée
`repair_assignments` et `repair_pins` (RLS activé, aucune policy publique :
accès exclusivement via les fonctions serveur).

### 2. Charger les affectations depuis l'Excel (optionnel, données de départ)

```bash
npm run seed -- chemin/vers/Prépa_FT.xlsm
```

Génère `supabase_seed.sql` (upserts dans `repair_assignments` à partir de la
feuille "Affectation"). Exécuter ce fichier dans l'éditeur SQL Supabase.

### 3. Variables d'environnement (Netlify uniquement, jamais dans le client)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → `service_role`)
- `JWT_SECRET` — une chaîne aléatoire longue et secrète, ex. générée avec
  `openssl rand -hex 32`. Sert à signer les jetons de session.

Plus aucune variable `VITE_...` n'est nécessaire : le client ne parle plus
directement à Supabase.

### 4. Lancer en local

```bash
npm install
npx netlify dev
```

(`npm run dev` seul ne fait tourner que le front — les fonctions serveur ont
besoin de `netlify dev` pour s'exécuter en local, avec les 3 variables
ci-dessus exportées dans le shell ou dans un fichier `.env` non commité.)

### 5. Déployer sur Netlify

1. Pousser ce dépôt sur GitHub, puis l'importer dans Netlify.
2. Site settings → Environment variables : ajouter `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.
3. Build command `npm run build`, publish directory `dist` (déjà dans
   `netlify.toml`), fonctions dans `netlify/functions`.

## Structure

```
src/
  App.jsx                 routes + garde-fous par rôle
  AuthContext.jsx           session (jeton stocké en localStorage)
  auth.js                    helpers session + authedFetch
  RequireAuth.jsx            redirige vers /login si non connecté
  usePlanningData.js         hook : appelle la fonction serveur planning
  Layout.jsx                 sidebar admin + déconnexion
  pages/
    Login.jsx                choix du nom + clavier PIN
    Planification.jsx        onglet principal (admin)
    Collaborateurs.jsx        équipe & charge (admin)
    MesTaches.jsx             vue technicien (mobile-friendly)
    Pins.jsx                  gestion des PIN (admin)
netlify/functions/
  _shared/auth.js            signature/vérification du jeton de session
  login.js                   vérifie le PIN, émet le jeton
  people.js                  liste publique des noms (pour l'écran de connexion)
  pins.js                    admin : définir/réinitialiser/supprimer un PIN
  planning.js                lecture sécurisée des données (filtrée si technicien)
  assign.js                  écriture sécurisée (droits différents admin/technicien)
supabase_schema.sql          repair_assignments + repair_pins
supabase_seed.sql            affectations initiales (généré depuis Prépa_FT.xlsm)
scripts/seed-from-excel.mjs  régénère le seed depuis un nouvel export
```

## Modèle de données

- **`export_devices_report`** (existant, lecture seule) — unités : code-barres,
  statut, `area` (= Ligne), `subarea` (= Banc), marque, type, pannes.
- **`users`** (existant, lecture seule) — personnes ; rôle app déduit de
  `roles` ("Admin réparation" / "Réparation").
- **`repair_assignments`** (nouvelle table) — barcode, technicien, action,
  commentaire admin, commentaire technicien, tâche réalisée, suivi
  zone/statut dans le temps.
- **`repair_pins`** (nouvelle table) — PIN haché par personne, compteur
  d'essais, verrouillage temporaire.
