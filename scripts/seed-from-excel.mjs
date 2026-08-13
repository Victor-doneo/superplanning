// Génère supabase_seed.sql : uniquement les affectations manuelles
// (technicien / action / commentaire), depuis la feuille "Affectation"
// d'un export Excel (même structure que Prépa_FT.xlsm).
//
// Ne touche à aucune autre table — les infos appareil (statut, ligne, banc,
// marque...) sont lues en direct depuis export_devices_report à l'affichage.
//
// Usage : node scripts/seed-from-excel.mjs chemin/vers/fichier.xlsm

import xlsx from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/seed-from-excel.mjs <fichier.xlsm>')
  process.exit(1)
}

const wb = xlsx.readFile(inputPath, { cellDates: true })

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return `'${v.toISOString()}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

const ws = wb.Sheets['Affectation']
if (!ws) {
  console.error(`Feuille "Affectation" introuvable dans ${inputPath}`)
  process.exit(1)
}
const rows = xlsx.utils.sheet_to_json(ws, { defval: null, raw: true })

const lines = []
lines.push('-- Généré automatiquement par scripts/seed-from-excel.mjs')
lines.push(`-- Source : ${path.basename(inputPath)} (${new Date().toISOString()})`)
lines.push('-- Alimente UNIQUEMENT repair_assignments (aucune autre table touchée)\n')

let count = 0
for (const r of rows) {
  const rdn = r.RDN
  if (!rdn) continue // pas d'appareil sur ce poste -> rien à affecter
  const barcode = String(rdn)
  lines.push(
    'INSERT INTO repair_assignments (barcode, technicien, action, commentaire) VALUES (' +
    `${esc(barcode)}, ${esc(r.Technicien)}, ${esc(r.Action)}, ${esc(r.Commentaire)}` +
    ') ON CONFLICT (barcode) DO UPDATE SET technicien=EXCLUDED.technicien, ' +
    'action=EXCLUDED.action, commentaire=EXCLUDED.commentaire, updated_at=NOW();'
  )
  count++
}

fs.writeFileSync('supabase_seed.sql', lines.join('\n'))
console.log(`✓ supabase_seed.sql généré (${count} affectations)`)
