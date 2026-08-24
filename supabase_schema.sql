-- ============================================================
-- Doneo Réparation — Planification
-- SEULE nouvelle table ajoutée à votre projet Supabase existant.
-- Ne touche à aucune table/vue existante (export_devices_report, users,
-- areas_storage, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS repair_assignments (
    barcode          TEXT PRIMARY KEY,   -- correspond à export_devices_report.barcode
    technicien       TEXT,               -- nom du technicien affecté (ex: "Wassime")
    action           TEXT,               -- ex: Pré-diagnostic, Diagnostic, Réparation, Validation
    commentaire      TEXT,               -- commentaire admin
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

-- RLS : aucun accès direct depuis le client. Cette table n'est lue/écrite
-- que par la fonction serveur (clé service_role), jamais depuis le
-- navigateur — donc pas de politique SELECT/INSERT publique nécessaire.
ALTER TABLE repair_assignments ENABLE ROW LEVEL SECURITY;
-- (volontairement aucune policy : accès uniquement via service_role, qui
-- contourne RLS par nature — la table reste invisible à la clé anonyme)

-- ============================================================
-- Rôles des comptes de connexion (admin / technicien)
-- ============================================================
-- Après avoir créé un utilisateur dans Authentication → Users, exécutez
-- l'une de ces deux requêtes pour lui attribuer un rôle. C'est stocké dans
-- app_metadata (zone non modifiable par l'utilisateur lui-même, contrairement
-- à user_metadata) — donc impossible à falsifier depuis le navigateur.
--
-- IMPORTANT : un compte SANS rôle défini est traité comme admin par défaut
-- (accès complet). Pensez à taguer chaque compte technicien explicitement.

-- Pour un compte ADMIN (vue complète, affectation) :
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
-- where email = 'vous@doneo.co';

-- Pour un compte TECHNICIEN (vue "Mes tâches" uniquement, filtrée sur son nom) :
-- 'technicien_name' doit correspondre EXACTEMENT au nom dans la table users
-- (celui utilisé pour l'affectation, ex: "Wassime").
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'technicien', 'technicien_name', 'Wassime')
-- where email = 'wassime@doneo.co';
