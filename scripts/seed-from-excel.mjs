// Régénère supabase_seed.sql à partir d'un export Excel (même structure que Prépa_FT.xlsm :
// feuilles "export_devices_mv", "REF", "Affectation").
//
// Usage : node scripts/seed-from-excel.mjs chemin/vers/fichier.xlsm
//
// Le fichier généré contient des INSERT ... ON CONFLICT DO UPDATE (upsert),
// à exécuter dans l'éditeur SQL Supabase ou via `psql`.

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

function escArray(v) {
  if (v === null || v === undefined) return "'{}'"
  const s = String(v).trim()
  if (s === '{}' || s === '') return "'{}'"
  return `'${s.replace(/'/g, "''")}'`
}

function sheetRows(name) {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Feuille "${name}" introuvable dans ${inputPath}`)
  return xlsx.utils.sheet_to_json(ws, { defval: null, raw: true })
}

// REF n'a pas de ligne d'en-tête (col A = nom, col B = rôle) : lire en tableau brut.
function refRowsRaw() {
  const ws = wb.Sheets['REF']
  if (!ws) throw new Error(`Feuille "REF" introuvable dans ${inputPath}`)
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
}

const lines = []
lines.push('-- Généré automatiquement par scripts/seed-from-excel.mjs')
lines.push(`-- Source : ${path.basename(inputPath)} (${new Date().toISOString()})\n`)

// Techniciens (REF) — pas de ligne d'en-tête dans cette feuille
const refRows = refRowsRaw()
lines.push('-- Techniciens')
for (const row of refRows) {
  const name = row[0]
  const role = row[1]
  if (!name) continue
  lines.push(
    `INSERT INTO technicians (name, role) VALUES (${esc(name)}, ${esc(role)}) ON CONFLICT (name) DO UPDATE SET role = EXCLUDED.role;`
  )
}
lines.push('')

// Unités (export_devices_mv)
const deviceRows = sheetRows('export_devices_mv')
lines.push(`-- Unités / appareils — ${deviceRows.length} lignes`)
for (const r of deviceRows) {
  if (!r.barcode) continue
  lines.push(
    'INSERT INTO devices (barcode, status, subarea, area, service_sub_category_name, brand_name, creator, ' +
    'sparepart_types, diag_request_by, diag_valid_by, repar_request_by, repar_valid_by, diag_request_date, ' +
    'qual_nogo_diag_request_by, qual_nogo_diag_valid_by, qual_nogo_repar_request_by, qual_nogo_repar_valid_by, ' +
    'merged_micro_failures, merged_macro_failures, last_refresh_utc) VALUES (' +
    `${esc(String(r.barcode))}, ${esc(r.status)}, ${esc(r.subarea)}, ${esc(r.area)}, ${esc(r.service_sub_category_name)}, ` +
    `${esc(r.brand_name)}, ${esc(r.creator)}, ${escArray(r.sparepart_types)}, ${esc(r.diag_request_by)}, ` +
    `${esc(r.diag_valid_by)}, ${esc(r.repar_request_by)}, ${esc(r.repar_valid_by)}, ${esc(r.diag_request_date)}, ` +
    `${esc(r.qual_nogo_diag_request_by)}, ${esc(r.qual_nogo_diag_valid_by)}, ${esc(r.qual_nogo_repar_request_by)}, ` +
    `${esc(r.qual_nogo_repar_valid_by)}, ${escArray(r.merged_micro_failures)}, ${escArray(r.merged_macro_failures)}, ${esc(r.last_refresh_utc)}` +
    ') ON CONFLICT (barcode) DO UPDATE SET status=EXCLUDED.status, subarea=EXCLUDED.subarea, area=EXCLUDED.area, updated_at=NOW();'
  )
}
lines.push('')

// Planification (Affectation)
const planningRows = sheetRows('Affectation')
lines.push(`-- Planification — ${planningRows.length} lignes`)
for (const r of planningRows) {
  const zone = r.Zone
  if (!zone) continue
  const parts = String(zone).split('_')
  const ligne = parts[0] || null
  const banc = parts[1] || null
  const barcode = r.RDN ? String(r.RDN) : null
  lines.push(
    'INSERT INTO planning (zone_rdn, ligne, banc, barcode, type_appareil, marque, statut, technicien, action, commentaire) VALUES (' +
    `${esc(zone)}, ${esc(ligne)}, ${esc(banc)}, ${esc(barcode)}, ${esc(r.Type)}, ${esc(r.Marque)}, ${esc(r.Statut)}, ` +
    `${esc(r.Technicien)}, ${esc(r.Action)}, ${esc(r.Commentaire)}` +
    ') ON CONFLICT (zone_rdn) DO UPDATE SET barcode=EXCLUDED.barcode, type_appareil=EXCLUDED.type_appareil, ' +
    'marque=EXCLUDED.marque, statut=EXCLUDED.statut, technicien=EXCLUDED.technicien, action=EXCLUDED.action, ' +
    'commentaire=EXCLUDED.commentaire, updated_at=NOW();'
  )
}

fs.writeFileSync('supabase_seed.sql', lines.join('\n'))
console.log(`✓ supabase_seed.sql généré (${deviceRows.length} unités, ${planningRows.length} postes, ${refRows.length} techniciens)`)
