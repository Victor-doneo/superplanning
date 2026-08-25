// Fonction serveur : signale une anomalie sur un appareil précis.
// - technicien : uniquement sur un appareil qui lui est affecté.
// - admin : sur n'importe quel appareil.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const ANOMALY_TYPES = [
  'Pièce non reçue',
  'Temps insuffisant',
  'Casse de matériel',
  'Pièce erronée ou cassée',
  'Manque de qualification',
  'Appareil indisponible',
]

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  const { error: authError, claims } = requireAuth(event)
  if (authError) return authError

  const role = claims.role === 'technicien' ? 'technicien' : 'admin'
  const technicienName = claims.technicien_name || claims.name || null

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête invalide.' }) }
  }

  const { barcode, type, commentaire } = payload
  if (!barcode || !type) {
    return { statusCode: 400, body: JSON.stringify({ error: 'barcode et type sont requis.' }) }
  }
  if (!ANOMALY_TYPES.includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Type d\'anomalie inconnu.' }) }
  }
  const bc = String(barcode)

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    // Un technicien ne peut signaler une anomalie que sur SES appareils
    if (role === 'technicien') {
      const { data: rows, error: fetchErr } = await admin
        .from('repair_assignments')
        .select('barcode, technicien')
        .eq('barcode', bc)
        .limit(1)
      if (fetchErr) throw fetchErr
      const current = rows?.[0]
      if (!current || current.technicien !== technicienName) {
        return { statusCode: 403, body: JSON.stringify({ error: "Cet appareil ne vous est pas affecté." }) }
      }
    }

    const { data: deviceRows } = await admin
      .from('export_devices_report')
      .select('area, subarea, brand_name, service_sub_category_name')
      .eq('barcode', bc)
      .limit(1)
    const device = deviceRows?.[0] || null

    const { error } = await admin.from('repair_anomalies').insert({
      barcode: bc,
      technicien: technicienName,
      type,
      commentaire: commentaire || null,
      area: device?.area || null,
      subarea: device?.subarea || null,
      brand_name: device?.brand_name || null,
      service_sub_category_name: device?.service_sub_category_name || null,
    })
    if (error) throw error

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
