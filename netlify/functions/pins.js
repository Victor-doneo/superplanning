// Fonction serveur (admin uniquement) : définit ou réinitialise le code PIN
// d'une personne (public.users). Ne crée ni ne modifie aucun compte — juste
// le PIN dans notre propre table repair_pins.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { requireAdmin } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function handler(event) {
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  const { error: authError } = requireAdmin(event)
  if (authError) return authError

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    if (event.httpMethod === 'GET') {
      const { data: people, error: pplErr } = await admin.from('users').select('id, name, roles, deleted')
      if (pplErr) throw pplErr
      const { data: pins, error: pinErr } = await admin.from('repair_pins').select('user_id, updated_at, locked_until')
      if (pinErr) throw pinErr
      const pinByUser = new Map(pins.map(p => [p.user_id, p]))

      const roleOf = (roles) => {
        if (!Array.isArray(roles)) return null
        if (roles.includes('Admin réparation')) return 'admin'
        if (roles.includes('Réparation')) return 'technicien'
        return null
      }

      const list = (people || [])
        .filter(u => !u.deleted && roleOf(u.roles))
        .map(u => ({
          id: u.id,
          name: u.name,
          role: roleOf(u.roles),
          has_pin: pinByUser.has(u.id),
          locked: pinByUser.get(u.id)?.locked_until && new Date(pinByUser.get(u.id).locked_until) > new Date(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ people: list }) }
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}')
      const { user_id, pin } = payload
      if (!user_id || !pin || !/^\d{4}$/.test(String(pin))) {
        return { statusCode: 400, body: JSON.stringify({ error: 'user_id et un PIN à 4 chiffres sont requis.' }) }
      }
      const pin_hash = await bcrypt.hash(String(pin), 10)
      const { error } = await admin
        .from('repair_pins')
        .upsert(
          { user_id, pin_hash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    if (event.httpMethod === 'DELETE') {
      const payload = JSON.parse(event.body || '{}')
      const { user_id } = payload
      if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'user_id requis.' }) }
      const { error } = await admin.from('repair_pins').delete().eq('user_id', user_id)
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 405, body: 'Method not allowed' }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
