// Fonction publique : vérifie le PIN auprès d'un SECOND projet Supabase
// (table "collaborateurs", colonnes email / pin, gérée ailleurs), puis
// récupère le nom/rôle depuis le projet principal (table users, via
// correspondance sur l'email).
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY         (projet principal)
//   SUPABASE_COLLAB_URL, SUPABASE_COLLAB_SERVICE_ROLE_KEY   (projet des PIN)
//   JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { signToken } from './_shared/auth.js'

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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey || !collabUrl || !collabKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (variables Supabase principal / collaborateurs).' }) }
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
  const collab = createClient(collabUrl, collabKey)

  try {
    // 1. Retrouver la personne + son rôle dans le projet principal
    // (select() + limite manuelle plutôt que .maybeSingle(), pour ne pas
    // planter si l'id existe en double par accident)
    const { data: personRows, error: personErr } = await admin
      .from('users')
      .select('id, name, email, roles, deleted')
      .eq('id', user_id)
      .limit(1)
    if (personErr) throw personErr
    const person = personRows?.[0] || null
    const role = person && !person.deleted ? roleOf(person.roles) : null
    if (!person || !role) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Compte inconnu ou non autorisé.' }) }
    }
    if (!person.email) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Aucun email associé à ce compte, connexion impossible.' }) }
    }

    // 2. Vérifier le PIN dans le second projet (table collaborateurs), par
    // email. Si plusieurs lignes correspondent (doublon dans la table),
    // on prend la première plutôt que de planter.
    const { data: collabRows, error: collabErr } = await collab
      .from('collaborateurs')
      .select('pin, email')
      .ilike('email', person.email)
      .limit(1)
    if (collabErr) throw collabErr
    const collabRow = collabRows?.[0] || null

    if (!collabRow || collabRow.pin === null || collabRow.pin === undefined) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Aucun code PIN trouvé pour ce compte.' }) }
    }

    if (String(collabRow.pin).trim() !== String(pin).trim()) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Code PIN incorrect.' }) }
    }

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
