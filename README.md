# Doneo Réparation — Planification

Application web de suivi des unités en réparation et de la charge de travail des
techniciens, sur les lignes de test et de réparation.

Générée à partir du fichier `Prépa_FT.xlsm` (feuilles `export_devices_mv`, `REF`,
`Affectation`).

## Fonctionnalités

- **Planification** : liste de tous les postes de ligne/banc, avec l'unité en
  cours (code-barres, type, marque), le statut, le technicien affecté, l'action
  à mener et le commentaire. Filtrable par ligne, technicien, statut, et
  recherche libre.
- **Collaborateurs** : liste des techniciens (rôle, charge actuelle, lignes sur
  lesquelles ils interviennent).

L'application est **en lecture seule** : les données sont mises à jour côté
base de données (import Excel régulier), pas depuis l'interface.

## Stack

- React + Vite, React Router
- Supabase (PostgreSQL + client JS, lecture via clé anonyme + RLS)
- Déploiement Netlify (`netlify.toml` fourni)

## Mise en route

### 1. Utiliser votre projet Supabase

Ce projet peut cohabiter avec une autre app (ex. suivi de colis/tournées) dans
le même projet Supabase : les tables `technicians`, `devices`, `planning`,
`repair_imports` ont des noms distincts et n'entrent pas en conflit avec
`tournees`, `colis`, `scans`, `imports`.

1. Ouvrir votre projet existant sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   - `supabase_schema.sql` (tables)
   - `supabase_policies.sql` (lecture publique en RLS)
   - `supabase_seed.sql` (données initiales, générées depuis `Prépa_FT.xlsm`)
3. Récupérer l'URL du projet et la clé `anon public` (Project Settings → API).

### 2. Configurer l'application

```bash
cp .env.example .env
# renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env
npm install
npm run dev
```

### 3. Mettre à jour les données plus tard

Quand un nouvel export Excel est disponible (même structure) :

```bash
npm run seed -- chemin/vers/nouvel_export.xlsm
```

Cela régénère `supabase_seed.sql`. Exécuter ensuite ce fichier dans l'éditeur
SQL Supabase (ou via `psql`) pour mettre à jour la base — les `INSERT ...
ON CONFLICT DO UPDATE` mettent à jour les lignes existantes sans dupliquer.

### 4. Déployer sur Netlify

1. Pousser ce dépôt sur GitHub.
2. Sur Netlify : "Add new site" → importer le dépôt.
3. Renseigner les variables d'environnement `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` dans Site settings → Environment variables.
4. Build command: `npm run build` — Publish directory: `dist` (déjà dans
   `netlify.toml`).

## Structure

```
src/
  App.jsx              routes
  Layout.jsx            sidebar + navigation
  supabaseClient.js      client Supabase
  pages/
    Planification.jsx   onglet principal
    Collaborateurs.jsx   équipe & charge
supabase_schema.sql       tables
supabase_policies.sql     RLS lecture seule
supabase_seed.sql         données initiales (depuis Prépa_FT.xlsm)
scripts/seed-from-excel.mjs   régénère le seed depuis un nouvel export
```

## Modèle de données

- `technicians` — collaborateurs (feuille `REF`) : nom, rôle (Diagnostic,
  Réparation, Pré-diagnostic, Validation…).
- `devices` — unités suivies (feuille `export_devices_mv`) : code-barres,
  statut, zone/sous-zone, marque, type, historique diag/réparation, pannes.
- `planning` — poste de ligne/banc (feuille `Affectation`) : position physique,
  unité qui l'occupe, technicien affecté, action et commentaire.
