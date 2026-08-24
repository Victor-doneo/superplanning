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
-- Codes PIN de connexion
-- ============================================================
-- Remplace Supabase Auth : chaque personne se connecte en choisissant son
-- nom (parmi public.users, filtré sur roles) puis en tapant un code à 4
-- chiffres. Le rôle (admin / technicien) est déduit automatiquement de
-- public.users.roles : "Admin réparation" -> admin, "Réparation" -> technicien.
-- Ne touche pas à la table users existante — juste une référence par id.
CREATE TABLE IF NOT EXISTS repair_pins (
    user_id         TEXT PRIMARY KEY,   -- correspond à users.id
    pin_hash        TEXT NOT NULL,      -- code PIN haché (jamais stocké en clair)
    failed_attempts INT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE repair_pins ENABLE ROW LEVEL SECURITY;
-- (idem : accès exclusivement via service_role depuis les fonctions serveur)
