-- ============================================================
-- Politiques RLS — accès en LECTURE SEULE depuis l'app (clé anonyme)
-- L'écriture (import, mise à jour de la planification) doit se faire
-- via un rôle de service (service_role), jamais depuis le client.
-- ============================================================

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning    ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique technicians" ON technicians FOR SELECT USING (true);
CREATE POLICY "Lecture publique devices"     ON devices     FOR SELECT USING (true);
CREATE POLICY "Lecture publique planning"    ON planning    FOR SELECT USING (true);
-- repair_imports : réservé au dashboard admin / service role (pas de politique SELECT publique)
