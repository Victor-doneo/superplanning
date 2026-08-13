-- ============================================================
-- Doneo Réparation — Planification
-- SEULE nouvelle table ajoutée à votre projet Supabase existant.
-- Ne touche à aucune table/vue existante (export_devices_report, users,
-- areas_storage, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS repair_assignments (
    barcode      TEXT PRIMARY KEY,     -- correspond à export_devices_report.barcode
    technicien   TEXT,                 -- nom du technicien affecté (ex: "Wassime")
    action       TEXT,                 -- ex: Pré-diagnostic, Diagnostic, Réparation, Validation
    commentaire  TEXT,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : aucun accès direct depuis le client. Cette table n'est lue/écrite
-- que par la fonction serveur (clé service_role), jamais depuis le
-- navigateur — donc pas de politique SELECT/INSERT publique nécessaire.
ALTER TABLE repair_assignments ENABLE ROW LEVEL SECURITY;
-- (volontairement aucune policy : accès uniquement via service_role, qui
-- contourne RLS par nature — la table reste invisible à la clé anonyme)
