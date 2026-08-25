// Fonction serveur : lit export_devices_report, users et repair_assignments
// avec la clé service_role (jamais exposée au navigateur), après avoir
// vérifié le jeton de session (PIN) émis par login.js.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_shared/auth.js'

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

  const { error: authError, claims } = requireAuth(event)
  if (authError) return authError

  const role = claims.role === 'technicien' ? 'technicien' : 'admin'
  const technicienName = claims.technicien_name || null

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const [devicesRes, assignmentsRes, techsRes, anomaliesRes] = await Promise.all([
      admin.from('export_devices_report').select('*'),
      admin.from('repair_assignments').select('*'),
      admin.from('users').select('id, name, roles, deleted').contains('roles', ['Réparation']),
      admin
        .from('repair_app_events')
        .select('barcode, anomaly_type, created_at')
        .eq('event_type', 'anomaly')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false }),
    ])

    if (devicesRes.error) throw devicesRes.error
    if (assignmentsRes.error) throw assignmentsRes.error
    if (techsRes.error) throw techsRes.error
    if (anomaliesRes.error) throw anomaliesRes.error

    const assignmentsByBarcode = new Map(
      assignmentsRes.data.map(a => [normalizeBarcode(a.barcode), a])
    )

    // Anomalie la plus récente du jour, par appareil (la liste est déjà
    // triée du plus récent au plus ancien, donc le premier match gagne).
    const lastAnomalyByBarcode = new Map()
    for (const an of anomaliesRes.data || []) {
      const key = normalizeBarcode(an.barcode)
      if (!lastAnomalyByBarcode.has(key)) lastAnomalyByBarcode.set(key, an.anomaly_type)
    }

    const now = new Date().toISOString()
    const trackingUpdates = []

    const devices = (devicesRes.data || [])
      .filter(d => isRepairArea(d.area))
      .map(d => {
        const a = assignmentsByBarcode.get(normalizeBarcode(d.barcode))

        // Détection d'un changement de zone/statut depuis le dernier passage :
        // si différent (ou jamais vu), on redémarre le chrono "depuis".
        let statusSince = a?.status_since || null
        const changed = !a || a.tracked_area !== d.area || a.tracked_status !== d.status
        if (changed) {
          statusSince = now
          trackingUpdates.push({
            barcode: String(d.barcode),
            tracked_area: d.area,
            tracked_status: d.status,
            status_since: now,
          })
        }

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
          tech_commentaire: a?.tech_commentaire || null,
          task_done: a?.task_done || false,
          task_done_at: a?.task_done_at || null,
          status_since: statusSince,
          last_anomaly: lastAnomalyByBarcode.get(normalizeBarcode(d.barcode)) || null,
        }
      })
      .filter(d => {
        if (role !== 'technicien') return true
        if (!technicienName) return false
        return d.technicien === technicienName
      })

    // Enregistrer les changements détectés (ne touche pas technicien/action/commentaire)
    if (trackingUpdates.length > 0) {
      const { error: trackErr } = await admin
        .from('repair_assignments')
        .upsert(trackingUpdates, { onConflict: 'barcode' })
      if (trackErr) console.error('Erreur mise à jour du suivi zone/statut :', trackErr.message)
    }

    const technicians = (techsRes.data || [])
      .filter(u => !u.deleted)
      .map(u => ({ id: u.id, name: u.name }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        devices,
        technicians,
        viewer: { role, technicienName },
      }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
