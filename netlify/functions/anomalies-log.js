// Fonction serveur (admin uniquement) : liste les anomalies remontées,
// filtrable par technicien et par date (par défaut : aujourd'hui).
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  const technicien = params.technicien || null
  const todayOnly = params.all !== 'true'

  try {
    let query = admin.from('repair_anomalies').select('*').order('created_at', { ascending: false })

    if (todayOnly) {
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      query = query.gte('created_at', startOfDay.toISOString())
    }
    if (technicien) query = query.eq('technicien', technicien)

    const { data, error } = await query
    if (error) throw error

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anomalies: data || [] }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
