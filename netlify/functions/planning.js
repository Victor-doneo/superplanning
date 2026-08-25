// Fonction serveur : lit export_devices_report, users, devices, device_actions
// et repair_assignments avec la clé service_role (jamais exposée au
// navigateur), après avoir vérifié le jeton de session (PIN) émis par
// login.js.
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

    const repairRows = (devicesRes.data || []).filter(d => isRepairArea(d.area))

    // --- status_since = date de la dernière action (device_actions) dont le
    // statut diffère du statut actuel de l'appareil. Nécessite de relier
    // barcode -> devices.id -> device_actions.device_id.
    const barcodes = repairRows.map(d => d.barcode).filter(Boolean)
    let lastDifferentStatusAt = new Map() // normalized barcode -> ISO date

    if (barcodes.length > 0) {
      const { data: deviceRows, error: devErr } = await admin
        .from('devices')
        .select('id, barcode')
        .in('barcode', barcodes)
      if (devErr) throw devErr

      const deviceIdByBarcode = new Map()
      for (const dv of deviceRows || []) {
        deviceIdByBarcode.set(normalizeBarcode(dv.barcode), dv.id)
      }
      const idToBarcode = new Map([...deviceIdByBarcode.entries()].map(([bc, id]) => [id, bc]))
      const deviceIds = [...idToBarcode.keys()]

      if (deviceIds.length > 0) {
        const { data: actionRows, error: actErr } = await admin
          .from('device_actions')
          .select('device_id, status, created_at, last_edit')
          .in('device_id', deviceIds)
          .order('created_at', { ascending: false })
        if (actErr) throw actErr

        // Regrouper les actions par device_id (déjà triées du plus récent au plus ancien)
        const actionsByDeviceId = new Map()
        for (const act of actionRows || []) {
          if (!actionsByDeviceId.has(act.device_id)) actionsByDeviceId.set(act.device_id, [])
          actionsByDeviceId.get(act.device_id).push(act)
        }

        const currentStatusByBarcode = new Map(repairRows.map(d => [normalizeBarcode(d.barcode), d.status]))

        for (const [deviceId, actions] of actionsByDeviceId) {
          const bc = idToBarcode.get(deviceId)
          const currentStatus = currentStatusByBarcode.get(bc)
          const differing = actions.find(a => a.status !== currentStatus)
          if (differing) {
            lastDifferentStatusAt.set(bc, differing.created_at || differing.last_edit || null)
          }
        }
      }
    }

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

    const devices = repairRows
      .map(d => {
        const a = assignmentsByBarcode.get(normalizeBarcode(d.barcode))

        // status_since : priorité à device_actions (dernière action à statut
        // différent) ; à défaut (aucun historique trouvé), on retombe sur le
        // suivi applicatif existant (repair_assignments.status_since).
        const statusSince = lastDifferentStatusAt.get(normalizeBarcode(d.barcode)) || a?.status_since || null

        return {
          barcode: d.barcode,
          status: d.status,
          area: d.area,          // = "Ligne"
          subarea: d.subarea,    // = "Banc"
          brand_name: d.brand_name,
          service_sub_category_name: d.service_sub_category_name,
          merged_micro_failures: d.merged_micro_failures,
          merged_macro_failures: d.merged_macro_failures,
          // Valeurs publiées (visibles par le technicien)
          technicien: a?.technicien || null,
          action: a?.action || null,
          commentaire: a?.commentaire || null,
          // Brouillon admin (invisible du technicien tant que non validé)
          draft_technicien: a?.draft_technicien ?? a?.technicien ?? null,
          draft_action: a?.draft_action ?? a?.action ?? null,
          draft_commentaire: a?.draft_commentaire ?? a?.commentaire ?? null,
          pending_validation: !!(a && (
            (a.draft_technicien || null) !== (a.technicien || null) ||
            (a.draft_action || null) !== (a.action || null) ||
            (a.draft_commentaire || null) !== (a.commentaire || null)
          )),
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
