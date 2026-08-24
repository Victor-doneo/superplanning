// Fonction serveur : gère les comptes de connexion (création, modification
// de rôle, suppression) sans passer par le tableau de bord Supabase.
//
// Réservé aux comptes admin (vérifié via app_metadata.role, non falsifiable
// côté client). Utilise l'API Admin de Supabase Auth (clé service_role).
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function requireAdmin(admin, event) {
  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return { error: { statusCode: 401, body: JSON.stringify({ error: 'Non authentifié.' }) } }

  const { data: userData, error: authError } = await admin.auth.getUser(token)
  if (authError || !userData?.user) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Session invalide, merci de vous reconnecter.' }) } }
  }
  const role = userData.user.app_metadata?.role === 'technicien' ? 'technicien' : 'admin'
  if (role !== 'admin') {
    return { error: { statusCode: 403, body: JSON.stringify({ error: 'Réservé aux administrateurs.' }) } }
  }
  return { user: userData.user }
}

export async function handler(event) {
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }) }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { error: authError } = await requireAdmin(admin, event)
  if (authError) return authError

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 })
      if (error) throw error
      const users = (data.users || []).map(u => ({
        id: u.id,
        email: u.email,
        role: u.app_metadata?.role === 'technicien' ? 'technicien' : 'admin',
        technicien_name: u.app_metadata?.technicien_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users }) }
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}')
      const { email, password, role, technicien_name } = payload
      if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Email et mot de passe requis.' }) }
      }
      if (role === 'technicien' && !technicien_name) {
        return { statusCode: 400, body: JSON.stringify({ error: 'technicien_name requis pour un compte technicien.' }) }
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // pas de mail de confirmation à gérer
        app_metadata: {
          role: role === 'technicien' ? 'technicien' : 'admin',
          ...(role === 'technicien' ? { technicien_name } : {}),
        },
      })
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, id: data.user.id }) }
    }

    if (event.httpMethod === 'PATCH') {
      const payload = JSON.parse(event.body || '{}')
      const { id, role, technicien_name } = payload
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) }
      const { error } = await admin.auth.admin.updateUserById(id, {
        app_metadata: {
          role: role === 'technicien' ? 'technicien' : 'admin',
          ...(role === 'technicien' ? { technicien_name } : { technicien_name: null }),
        },
      })
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    if (event.httpMethod === 'DELETE') {
      const payload = JSON.parse(event.body || '{}')
      const { id } = payload
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) }
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 405, body: 'Method not allowed' }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
