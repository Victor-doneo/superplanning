-- ============================================================
-- Doneo Réparation — Schéma Supabase (PostgreSQL)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- Collaborateurs / techniciens (feuille "REF" du fichier Excel)
CREATE TABLE IF NOT EXISTS technicians (
    id          SERIAL PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    role        TEXT,                 -- ex: Diagnostic, Réparation, Pré-diagnostic, Validation
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unités / appareils suivis (feuille "export_devices_mv")
CREATE TABLE IF NOT EXISTS devices (
    barcode                    TEXT PRIMARY KEY,
    status                     TEXT,
    subarea                    TEXT,     -- ex: "Banc 08"
    area                       TEXT,     -- ex: "Ligne 04"
    service_sub_category_name  TEXT,     -- ex: "Lave-linge hublot"
    brand_name                 TEXT,
    creator                    TEXT,
    sparepart_types            TEXT[],
    diag_request_by            TEXT,
    diag_valid_by              TEXT,
    repar_request_by           TEXT,
    repar_valid_by             TEXT,
    diag_request_date          TIMESTAMPTZ,
    qual_nogo_diag_request_by  TEXT,
    qual_nogo_diag_valid_by    TEXT,
    qual_nogo_repar_request_by TEXT,
    qual_nogo_repar_valid_by   TEXT,
    merged_micro_failures      TEXT[],
    merged_macro_failures      TEXT[],
    last_refresh_utc           TIMESTAMPTZ,
    updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_area ON devices(area);
CREATE INDEX IF NOT EXISTS idx_devices_subarea ON devices(subarea);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- Planification par poste de ligne/banc (feuille "Affectation")
-- Une ligne = un emplacement physique (ex: "Ligne 04_Banc 01"), qui peut
-- accueillir une unité (barcode) et être affecté à un technicien pour une action.
CREATE TABLE IF NOT EXISTS planning (
    id            SERIAL PRIMARY KEY,
    zone_rdn      TEXT UNIQUE NOT NULL,   -- ex: "Ligne 04_Banc 01"
    ligne         TEXT,                   -- ex: "Ligne 04"
    banc          TEXT,                   -- ex: "Banc 01"
    barcode       TEXT REFERENCES devices(barcode) ON DELETE SET NULL,
    type_appareil TEXT,
    marque        TEXT,
    statut        TEXT,
    technicien    TEXT REFERENCES technicians(name) ON DELETE SET NULL,
    action        TEXT,                   -- ex: Pré-diagnostic, Diagnostic, Réparation, Validation
    commentaire   TEXT,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_ligne ON planning(ligne);
CREATE INDEX IF NOT EXISTS idx_planning_technicien ON planning(technicien);
CREATE INDEX IF NOT EXISTS idx_planning_statut ON planning(statut);

-- Historique des imports (traçabilité des rafraîchissements de données)
CREATE TABLE IF NOT EXISTS imports (
    id           SERIAL PRIMARY KEY,
    filename     TEXT,
    date_import  TIMESTAMPTZ DEFAULT NOW(),
    nb_devices   INTEGER DEFAULT 0,
    nb_planning  INTEGER DEFAULT 0
);
