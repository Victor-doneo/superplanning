// Fonction serveur : écrit dans repair_assignments (la seule table où l'app
// peut écrire), après vérification de l'authentification.
//
// Mêmes variables d'environnement que planning.js :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }) }
  }

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

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête invalide.' }) }
  }

  const { barcode, technicien, action, commentaire } = payload
  if (!barcode) {
    return { statusCode: 400, body: JSON.stringify({ error: 'barcode manquant.' }) }
  }

  try {
    const { error } = await admin
      .from('repair_assignments')
      .upsert(
        {
          barcode: String(barcode),
          technicien: technicien || null,
          action: action || null,
          commentaire: commentaire || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'barcode' }
      )
    if (error) throw error

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
