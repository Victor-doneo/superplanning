// Fonction publique (pas d'authentification requise) : liste les personnes
// pouvant se connecter à l'app, pour peupler l'écran de connexion (choix du
// nom). Ne renvoie que id + name + le fait qu'un PIN existe déjà — aucune
// donnée sensible.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function roleOf(roles) {
  if (!Array.isArray(roles)) return null
  if (roles.includes('Admin réparation')) return 'admin'
  if (roles.includes('Réparation')) return 'technicien'
  return null
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }) }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  try {
    const { data, error } = await admin.from('users').select('id, name, roles, deleted')
    if (error) throw error

    const people = (data || [])
      .filter(u => !u.deleted && roleOf(u.roles))
      .map(u => ({ id: u.id, name: u.name, role: roleOf(u.roles) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ people }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
