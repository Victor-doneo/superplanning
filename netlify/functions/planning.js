// Fonction serveur : lit export_devices_report, users et repair_assignments
// avec la clé service_role (jamais exposée au navigateur), après avoir
// vérifié que l'appelant est authentifié via un token Supabase Auth valide.
//
// Variables d'environnement requises (à définir dans Netlify, PAS dans le
// bundle client) :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (clé secrète — jamais préfixée VITE_)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Lignes/zones considérées comme "atelier réparation" (area dans export_devices_report)
const REPAIR_AREAS_PREFIXES = ['Ligne', 'Zone attente validation', 'Zone qualité', 'Zone pré-diagnostic', 'Zone attente pièces']

function isRepairArea(area) {
  if (!area) return false
  return REPAIR_AREAS_PREFIXES.some(p => area.startsWith(p))
}

// Les codes-barres peuvent être stockés avec ou sans zéros de tête selon la
// source (ex: "074267" vs "74267") — on normalise pour fiabiliser le rapprochement.
function normalizeBarcode(b) {
  if (b === null || b === undefined) return null
  const s = String(b).trim()
  const stripped = s.replace(/^0+/, '')
  return stripped === '' ? '0' : stripped
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }) }
  }

  // 1. Vérifier l'authentification (token Supabase Auth passé par le client)
  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Non authentifié.' }) }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: authError } = await admin.auth.getUser(token)
  if (authError || !userData?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide, merci de vous reconnecter.' }) }
  }

  try {
    const [devicesRes, assignmentsRes, techsRes] = await Promise.all([
      admin.from('export_devices_report').select('*'),
      admin.from('repair_assignments').select('*'),
      admin.from('users').select('id, name, roles, deleted').contains('roles', ['Réparation']),
    ])

    if (devicesRes.error) throw devicesRes.error
    if (assignmentsRes.error) throw assignmentsRes.error
    if (techsRes.error) throw techsRes.error

    const assignmentsByBarcode = new Map(
      assignmentsRes.data.map(a => [normalizeBarcode(a.barcode), a])
    )

    const devices = (devicesRes.data || [])
      .filter(d => isRepairArea(d.area))
      .map(d => {
        const a = assignmentsByBarcode.get(normalizeBarcode(d.barcode))
        return {
          barcode: d.barcode,
          status: d.status,
          area: d.area,          // = "Ligne"
          subarea: d.subarea,    // = "Banc"
          brand_name: d.brand_name,
          service_sub_category_name: d.service_sub_category_name,
          merged_micro_failures: d.merged_micro_failures,
          merged_macro_failures: d.merged_macro_failures,
          technicien: a?.technicien || null,
          action: a?.action || null,
          commentaire: a?.commentaire || null,
        }
      })

    const technicians = (techsRes.data || [])
      .filter(u => !u.deleted)
      .map(u => ({ id: u.id, name: u.name }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devices, technicians }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
