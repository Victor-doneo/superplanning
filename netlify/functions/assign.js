// Fonction serveur : écrit dans repair_assignments (la seule table où l'app
// peut écrire), après vérification de l'authentification et du rôle.
//
// - admin : peut modifier technicien / action / commentaire de n'importe
//   quel appareil.
// - technicien : peut UNIQUEMENT modifier tech_commentaire / task_done sur
//   un appareil qui lui est déjà affecté (vérifié côté serveur, jamais fait
//   confiance au client).
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

  const meta = userData.user.app_metadata || {}
  const role = meta.role === 'technicien' ? 'technicien' : 'admin'
  const technicienName = meta.technicien_name || null

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête invalide.' }) }
  }

  const { barcode } = payload
  if (!barcode) {
    return { statusCode: 400, body: JSON.stringify({ error: 'barcode manquant.' }) }
  }
  const bc = String(barcode)

  try {
    if (role === 'admin') {
      const { technicien, action, commentaire } = payload
      const { error } = await admin
        .from('repair_assignments')
        .upsert(
          {
            barcode: bc,
            technicien: technicien || null,
            action: action || null,
            commentaire: commentaire || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'barcode' }
        )
      if (error) throw error
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    // Rôle technicien : uniquement sur ses propres appareils, uniquement
    // tech_commentaire / task_done.
    if (!technicienName) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Compte technicien non configuré (technicien_name manquant).' }) }
    }

    const { data: current, error: fetchErr } = await admin
      .from('repair_assignments')
      .select('barcode, technicien')
      .eq('barcode', bc)
      .maybeSingle()
    if (fetchErr) throw fetchErr

    if (!current || current.technicien !== technicienName) {
      return { statusCode: 403, body: JSON.stringify({ error: "Cet appareil ne vous est pas affecté." }) }
    }

    const { tech_commentaire, task_done } = payload
    const update = { updated_at: new Date().toISOString() }
    if (tech_commentaire !== undefined) update.tech_commentaire = tech_commentaire || null
    if (task_done !== undefined) {
      update.task_done = !!task_done
      update.task_done_at = task_done ? new Date().toISOString() : null
    }

    const { error: updateErr } = await admin
      .from('repair_assignments')
      .update(update)
      .eq('barcode', bc)
    if (updateErr) throw updateErr

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
