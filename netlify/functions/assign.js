// Fonction serveur : écrit dans repair_assignments (la seule table où l'app
// peut écrire), après vérification du jeton de session et du rôle.
//
// - admin : contrôle total (technicien / action / commentaire / son propre
//   commentaire technicien / tâche réalisée — un admin peut aussi être
//   affecté à des tâches).
// - technicien : uniquement tech_commentaire / task_done sur un appareil
//   qui lui est déjà affecté (vérifié côté serveur).
//
// Chaque passage de task_done à true est journalisé dans
// repair_task_events (historique, indépendant de repair_assignments).
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function logTaskDone(admin, barcode, technicien, action) {
  try {
    const { data: device } = await admin
      .from('export_devices_report')
      .select('area, subarea, brand_name, service_sub_category_name')
      .eq('barcode', barcode)
      .maybeSingle()
    await admin.from('repair_task_events').insert({
      barcode,
      technicien: technicien || null,
      action: action || null,
      area: device?.area || null,
      subarea: device?.subarea || null,
      brand_name: device?.brand_name || null,
      service_sub_category_name: device?.service_sub_category_name || null,
    })
  } catch (e) {
    console.error('Erreur journalisation tâche réalisée :', e.message)
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }) }
  }

  const { error: authError, claims } = requireAuth(event)
  if (authError) return authError

  const role = claims.role === 'technicien' ? 'technicien' : 'admin'
  const technicienName = claims.technicien_name || claims.name || null

  const admin = createClient(supabaseUrl, serviceKey)

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
      const { technicien, action, commentaire, tech_commentaire, task_done } = payload
      const update = { barcode: bc, updated_at: new Date().toISOString() }
      if (technicien !== undefined) update.technicien = technicien || null
      if (action !== undefined) update.action = action || null
      if (commentaire !== undefined) update.commentaire = commentaire || null
      if (tech_commentaire !== undefined) update.tech_commentaire = tech_commentaire || null
      if (task_done !== undefined) {
        update.task_done = !!task_done
        update.task_done_at = task_done ? new Date().toISOString() : null
      }

      const { error } = await admin.from('repair_assignments').upsert(update, { onConflict: 'barcode' })
      if (error) throw error

      if (task_done === true) {
        await logTaskDone(admin, bc, technicien ?? technicienName, action)
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
    }

    // Rôle technicien : uniquement sur ses propres appareils, uniquement
    // tech_commentaire / task_done.
    if (!technicienName) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Compte technicien non configuré.' }) }
    }

    const { data: current, error: fetchErr } = await admin
      .from('repair_assignments')
      .select('barcode, technicien, action')
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

    if (task_done === true) {
      await logTaskDone(admin, bc, technicienName, current.action)
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
