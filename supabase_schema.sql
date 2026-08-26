-- ============================================================
-- Doneo Réparation — Planification
-- SEULE nouvelle table ajoutée à votre projet Supabase existant.
-- Ne touche à aucune table/vue existante (export_devices_report, users,
-- areas_storage, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS repair_assignments (
    barcode          TEXT PRIMARY KEY,   -- correspond à export_devices_report.barcode
    -- Valeurs PUBLIÉES : ce que le technicien voit réellement. Ne changent
    -- que lorsque l'admin clique "Valider les tâches" (voir draft_* ci-dessous).
    technicien       TEXT,               -- nom du technicien affecté (ex: "Wassime")
    action           TEXT,               -- ex: Pré-diagnostic, Diagnostic, Réparation, Validation
    commentaire      TEXT,               -- commentaire admin
    -- Brouillon : ce que l'admin prépare dans Planification, invisible du
    -- technicien tant que non validé.
    draft_technicien TEXT,
    draft_action     TEXT,
    draft_commentaire TEXT,
    draft_priority   BOOLEAN DEFAULT FALSE, -- tâche prioritaire (brouillon, avant validation)
    priority         BOOLEAN DEFAULT FALSE, -- valeur publiée, détermine l'ordre dans "Tâches"
    validated_at     TIMESTAMPTZ,
    -- Suivi "depuis combien de temps sur cette zone avec ce statut" : l'app
    -- met à jour ces 3 colonnes elle-même dès qu'elle détecte un changement
    -- de zone ou de statut sur l'appareil (aucune donnée historique
    -- n'existant ailleurs, le compteur démarre à partir du premier passage
    -- de l'app après ce changement).
    tracked_area     TEXT,
    tracked_status   TEXT,
    status_since     TIMESTAMPTZ,
    -- Espace du technicien : son propre commentaire (distinct du commentaire
    -- admin) + bouton "Tâche réalisée".
    tech_commentaire TEXT,
    task_done        BOOLEAN DEFAULT FALSE,
    task_done_at     TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existait déjà (déploiement précédent), ajouter les colonnes :
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS tracked_area TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS tracked_status TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS status_since TIMESTAMPTZ;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS tech_commentaire TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS task_done BOOLEAN DEFAULT FALSE;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS task_done_at TIMESTAMPTZ;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS draft_technicien TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS draft_action TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS draft_commentaire TEXT;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS draft_priority BOOLEAN DEFAULT FALSE;
ALTER TABLE repair_assignments ADD COLUMN IF NOT EXISTS priority BOOLEAN DEFAULT FALSE;

-- Si vous aviez déjà des affectations publiées avant l'introduction du
-- brouillon, on les recopie une seule fois comme point de départ du
-- brouillon (pour ne pas perdre l'affichage côté admin), et on marque ces
-- lignes comme déjà validées (pour ne pas faire disparaître d'un coup les
-- tâches déjà visibles par les techniciens).
UPDATE repair_assignments
SET draft_technicien = technicien,
    draft_action = action,
    draft_commentaire = commentaire,
    validated_at = COALESCE(validated_at, updated_at, NOW())
WHERE draft_technicien IS NULL AND draft_action IS NULL AND draft_commentaire IS NULL
  AND (technicien IS NOT NULL OR action IS NOT NULL OR commentaire IS NOT NULL);

-- RLS : aucun accès direct depuis le client. Cette table n'est lue/écrite
-- que par la fonction serveur (clé service_role), jamais depuis le
-- navigateur — donc pas de politique SELECT/INSERT publique nécessaire.
ALTER TABLE repair_assignments ENABLE ROW LEVEL SECURITY;
-- (volontairement aucune policy : accès uniquement via service_role, qui
-- contourne RLS par nature — la table reste invisible à la clé anonyme)

-- ============================================================
-- Journal des événements (tâches réalisées + anomalies signalées)
-- ============================================================
-- Journal append-only unique : une ligne à chaque tâche marquée "réalisée"
-- ou anomalie signalée. Permet de garder une trace même si l'appareil
-- change ensuite de statut/technicien (ce que repair_assignments seul ne
-- permet pas). Un seul event_type ('task_done' | 'anomaly') distingue les
-- deux natures d'événement plutôt que deux tables quasi identiques.
CREATE TABLE IF NOT EXISTS repair_app_events (
    id                          SERIAL PRIMARY KEY,
    event_type                  TEXT NOT NULL,  -- 'task_done' | 'anomaly'
    barcode                     TEXT,
    technicien                  TEXT,
    action                      TEXT,           -- rempli pour event_type = 'task_done'
    anomaly_type                TEXT,           -- rempli pour event_type = 'anomaly' (une des 6 catégories)
    commentaire                 TEXT,           -- détail libre saisi par le technicien pour une anomalie
    assignment_commentaire      TEXT,           -- copie du commentaire admin (repair_assignments.commentaire) au moment de l'événement
    area                        TEXT,
    subarea                     TEXT,
    brand_name                  TEXT,
    service_sub_category_name   TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE repair_app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_app_events ADD COLUMN IF NOT EXISTS assignment_commentaire TEXT;
CREATE INDEX IF NOT EXISTS idx_events_type ON repair_app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_technicien ON repair_app_events(technicien);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON repair_app_events(created_at);

-- Si vous aviez déjà déployé la version précédente (deux tables séparées),
-- migrez les données existantes puis supprimez les anciennes tables :
--
-- insert into repair_app_events (event_type, barcode, technicien, action, area, subarea, brand_name, service_sub_category_name, created_at)
-- select 'task_done', barcode, technicien, action, area, subarea, brand_name, service_sub_category_name, created_at
-- from repair_task_events;
--
-- insert into repair_app_events (event_type, barcode, technicien, anomaly_type, commentaire, area, subarea, brand_name, service_sub_category_name, created_at)
-- select 'anomaly', barcode, technicien, type, commentaire, area, subarea, brand_name, service_sub_category_name, created_at
-- from repair_anomalies;
--
-- drop table if exists repair_task_events;
-- drop table if exists repair_anomalies;

-- ============================================================
-- Codes PIN de connexion
-- ============================================================
-- Les PIN sont gérés dans un AUTRE projet Supabase, table
-- "collaborateurs" (colonnes email / pin), pas ici. Rien à créer côté
-- base pour cette partie — voir netlify/functions/login.js pour le détail
-- de la connexion entre les deux projets.
