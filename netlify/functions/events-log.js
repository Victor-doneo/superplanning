// Fonction serveur (admin uniquement) : consulte le journal repair_app_events
// (tâches réalisées et/ou anomalies), filtrable par type, technicien et
// intervalle de dates.
//
// Paramètres :
//   type        'task_done' | 'anomaly' | (absent = les deux)
//   technicien  nom exact (optionnel)
//   from        date début 'YYYY-MM-DD' (défaut : aujourd'hui)
//   to          date fin 'YYYY-MM-DD' incluse (défaut : aujourd'hui)
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  const { error: authError } = requireAdmin(event)
  if (authError) return authError

  const admin = createClient(supabaseUrl, serviceKey)
  const params = event.queryStringParameters || {}
  const type = params.type || null
  const technicien = params.technicien || null
  const from = params.from || todayISODate()
  const to = params.to || todayISODate()

  const startIso = `${from}T00:00:00.000Z`
  const endExclusive = new Date(`${to}T00:00:00.000Z`)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)

  try {
    let query = admin
      .from('repair_app_events')
      .select('*')
      .gte('created_at', startIso)
      .lt('created_at', endExclusive.toISOString())
      .order('created_at', { ascending: false })

    if (type) query = query.eq('event_type', type)
    if (technicien) query = query.eq('technicien', technicien)

    const { data, error } = await query
    if (error) throw error

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: data || [] }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
