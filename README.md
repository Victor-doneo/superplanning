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

## Connexion : nom + code PIN (table externe, pas de compte à créer)

Pas d'email ni de mot de passe géré ici : chaque personne choisit son nom
dans une liste (tirée de `users` du projet principal, filtrée sur les rôles
"Réparation" / "Admin réparation") puis tape son code PIN.

**Le PIN lui-même n'est pas stocké par cette app** : il est vérifié auprès
d'un **second projet Supabase**, table `collaborateurs` (colonnes `email` /
`pin`, en clair), déjà géré par un autre de vos outils. La correspondance se
fait par email entre les deux projets.

- **Rôle automatique** : basé sur `users.roles` (projet principal).
- ⚠️ **Sécurité réduite par rapport à la version précédente** : comme le PIN
  vit dans une table qui ne nous appartient pas, cette app ne peut plus
  ajouter de hachage ni de verrouillage anti-brute-force dessus (ça
  demanderait de modifier la structure de `collaborateurs`, ce qu'on
  s'interdit ici). Le PIN reste ce qu'il est dans votre autre outil : à vous
  de juger si son niveau de sécurité (longueur, complexité) est suffisant
  pour cet usage.
- L'onglet **Accès** de cette app est **en lecture seule** : il indique qui a
  un PIN défini ou non, mais ne permet pas de le créer/modifier — ça se fait
  dans l'outil qui gère la table `collaborateurs`.

## Mise en route

### 1. Ajouter la table manquante

Dans l'éditeur SQL Supabase (projet principal), exécuter `supabase_schema.sql`
— crée uniquement `repair_assignments`.

### 2. Charger les affectations depuis l'Excel (optionnel, données de départ)

```bash
npm run seed -- chemin/vers/Prépa_FT.xlsm
```

Génère `supabase_seed.sql` (upserts dans `repair_assignments` à partir de la
feuille "Affectation"). Exécuter ce fichier dans l'éditeur SQL Supabase.

### 3. Variables d'environnement (Netlify uniquement, jamais dans le client)

Projet principal (unités, techniciens, affectations) :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Second projet (table `collaborateurs`, gestion des PIN) :
- `SUPABASE_COLLAB_URL`
- `SUPABASE_COLLAB_SERVICE_ROLE_KEY`

Commun :
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

- **`export_devices_report`** (projet principal, existant, lecture seule) —
  unités : code-barres, statut, `area` (= Ligne), `subarea` (= Banc), marque,
  type, pannes.
- **`users`** (projet principal, existant, lecture seule) — personnes ; rôle
  app déduit de `roles` ("Admin réparation" / "Réparation") ; email utilisé
  pour retrouver le PIN dans l'autre projet.
- **`collaborateurs`** (SECOND projet, existant, lecture seule) — `email` +
  `pin` en clair, géré par un autre de vos outils.
- **`repair_assignments`** (nouvelle table, projet principal) — barcode,
  technicien, action, commentaire admin, commentaire technicien, tâche
  réalisée, suivi zone/statut dans le temps.
