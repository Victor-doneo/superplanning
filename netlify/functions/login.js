// Fonction publique : vérifie le PIN et renvoie un jeton de session signé.
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { signToken } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function roleOf(roles) {
  if (!Array.isArray(roles)) return null
  if (roles.includes('Admin réparation')) return 'admin'
  if (roles.includes('Réparation')) return 'technicien'
  return null
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) }
  }
  const { user_id, pin } = payload
  if (!user_id || !pin) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nom et code PIN requis.' }) }
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const { data: person, error: personErr } = await admin
      .from('users')
      .select('id, name, roles, deleted')
      .eq('id', user_id)
      .maybeSingle()
    if (personErr) throw personErr
    const role = person && !person.deleted ? roleOf(person.roles) : null
    if (!person || !role) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Compte inconnu ou non autorisé.' }) }
    }

    const { data: pinRow, error: pinErr } = await admin
      .from('repair_pins')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle()
    if (pinErr) throw pinErr

    if (!pinRow) {
      return { statusCode: 401, body: JSON.stringify({ error: "Aucun code PIN défini pour ce compte. Demandez à un admin de vous en créer un dans l'onglet Accès." }) }
    }

    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(pinRow.locked_until) - new Date()) / 60000)
      return { statusCode: 423, body: JSON.stringify({ error: `Trop de tentatives. Réessayez dans ${mins} min.` }) }
    }

    const valid = await bcrypt.compare(String(pin), pinRow.pin_hash)

    if (!valid) {
      const attempts = (pinRow.failed_attempts || 0) + 1
      const update = { failed_attempts: attempts, updated_at: new Date().toISOString() }
      if (attempts >= MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
        update.failed_attempts = 0
      }
      await admin.from('repair_pins').update(update).eq('user_id', user_id)
      return { statusCode: 401, body: JSON.stringify({ error: 'Code PIN incorrect.' }) }
    }

    // Succès : réinitialiser le compteur d'essais
    await admin.from('repair_pins').update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq('user_id', user_id)

    const claims = {
      sub: person.id,
      name: person.name,
      role,
      technicien_name: role === 'technicien' ? person.name : null,
    }
    const token = signToken(claims)

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...claims }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
