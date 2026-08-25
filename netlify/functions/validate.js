// Fonction serveur (admin uniquement) : "Valider les tâches" — publie le
// brouillon (draft_technicien/draft_action/draft_commentaire) vers les
// valeurs réellement visibles par le technicien (technicien/action/commentaire).
//
// Le commentaire technicien (tech_commentaire) est remis à zéro SI ET
// SEULEMENT SI l'action ou le commentaire admin change par rapport à la
// dernière version publiée (sinon on le laisse tel quel).
//
// Variables d'environnement requises (Netlify) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from './_shared/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration serveur manquante.' }) }
  }

  const { error: authError } = requireAdmin(event)
  if (authError) return authError

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête invalide.' }) }
  }

  const barcodes = Array.isArray(payload.barcodes) ? payload.barcodes.map(String) : []
  if (barcodes.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'barcodes (tableau) requis.' }) }
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const { data: rows, error: fetchErr } = await admin
      .from('repair_assignments')
      .select('barcode, technicien, action, commentaire, draft_technicien, draft_action, draft_commentaire')
      .in('barcode', barcodes)
    if (fetchErr) throw fetchErr

    const now = new Date().toISOString()
    const updates = []

    for (const bc of barcodes) {
      const row = rows.find(r => r.barcode === bc)
      // Rien à valider si aucune ligne n'existe encore (aucun brouillon saisi)
      if (!row) continue

      const newAction = row.draft_action ?? null
      const newCommentaire = row.draft_commentaire ?? null
      const newTechnicien = row.draft_technicien ?? null

      const actionOrCommentChanged =
        (row.action || null) !== newAction || (row.commentaire || null) !== newCommentaire

      const update = {
        barcode: bc,
        technicien: newTechnicien,
        action: newAction,
        commentaire: newCommentaire,
        validated_at: now,
        updated_at: now,
      }
      if (actionOrCommentChanged) {
        update.tech_commentaire = null
      }
      updates.push(update)
    }

    if (updates.length === 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, validated: 0 }) }
    }

    const { error: upsertErr } = await admin.from('repair_assignments').upsert(updates, { onConflict: 'barcode' })
    if (upsertErr) throw upsertErr

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, validated: updates.length }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) }
  }
}
