// Fonction serveur (admin uniquement) : "Valider les tâches" — publie le
// brouillon (draft_technicien/draft_action/draft_commentaire/draft_priority)
// vers les valeurs réellement visibles par le technicien.
//
// Le commentaire technicien (tech_commentaire) ET le statut "tâche
// réalisée" (task_done) sont remis à zéro SI ET SEULEMENT SI l'action ou le
// commentaire admin change par rapport à la dernière version publiée
// (sinon on les conserve tels quels).
//
// Chaque ligne de la mise à jour groupée porte EXPLICITEMENT tous les
// champs concernés (même valeur inchangée répétée), plutôt que d'omettre
// certaines clés selon les lignes — un upsert groupé avec des ensembles de
// colonnes hétérogènes entre les lignes peut se comporter de façon
// imprévisible.
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
      .select('barcode, technicien, action, commentaire, draft_technicien, draft_action, draft_commentaire, draft_priority, tech_commentaire, task_done, task_done_at')
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
      const newPriority = !!row.draft_priority

      const actionOrCommentChanged =
        (row.action || null) !== newAction || (row.commentaire || null) !== newCommentaire

      // Toutes les lignes de la mise à jour groupée portent EXACTEMENT les
      // mêmes colonnes, valeur inchangée répétée si besoin.
      updates.push({
        barcode: bc,
        technicien: newTechnicien,
        action: newAction,
        commentaire: newCommentaire,
        priority: newPriority,
        validated_at: now,
        updated_at: now,
        tech_commentaire: actionOrCommentChanged ? null : (row.tech_commentaire ?? null),
        task_done: actionOrCommentChanged ? false : !!row.task_done,
        task_done_at: actionOrCommentChanged ? null : (row.task_done_at ?? null),
      })
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
