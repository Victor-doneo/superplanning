// Fonction serveur (admin uniquement, LECTURE SEULE) : montre qui a un PIN
// défini. Les PIN eux-mêmes sont gérés ailleurs (table "collaborateurs"
// dans un second projet Supabase) — cette fonction ne les modifie jamais.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                 (projet principal)
//   SUPABASE_COLLAB_URL, SUPABASE_COLLAB_SERVICE_ROLE_KEY    (projet des PIN)
//   JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const collabUrl = process.env.SUPABASE_COLLAB_URL
const collabKey = process.env.SUPABASE_COLLAB_SERVICE_ROLE_KEY

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
  if (!supabaseUrl || !serviceKey || !collabUrl || !collabKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  const { error: authError } = requireAdmin(event)
  if (authError) return authError

  const admin = createClient(supabaseUrl, serviceKey)
  const collab = createClient(collabUrl, collabKey)

  try {
    const { data: people, error: pplErr } = await admin.from('users').select('id, name, email, roles, deleted')
    if (pplErr) throw pplErr

    const { data: collabRows, error: collabErr } = await collab.from('collaborateurs').select('email, pin')
    if (collabErr) throw collabErr

    const pinByEmail = new Map(
      (collabRows || [])
        .filter(c => c.email)
        .map(c => [c.email.toLowerCase(), c.pin !== null && c.pin !== undefined && String(c.pin).trim() !== ''])
    )

    const list = (people || [])
      .filter(u => !u.deleted && roleOf(u.roles))
      .map(u => ({
        id: u.id,
        name: u.name,
        role: roleOf(u.roles),
        has_pin: u.email ? !!pinByEmail.get(u.email.toLowerCase()) : false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ people: list }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
