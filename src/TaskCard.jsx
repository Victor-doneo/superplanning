import { useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import { authedFetch } from './auth'

const STATUS_COLORS = {
  'En attente de mise en test': 'gray',
  'Mise en test': 'green',
  'Attente pièces': 'yellow',
  'Contrôle qualité': 'orange',
  'Appareil à démonter': 'red',
  'Restitution partenaire': 'red',
}

export const ANOMALY_TYPES = [
  'Pièce non reçue',
  'Temps insuffisant',
  'Casse de matériel',
  'Pièce erronée ou cassée',
  'Manque de qualification',
  'Appareil indisponible',
]

export function StatusBadge({ statut }) {
  if (!statut) return <span className="badge badge-gray">—</span>
  const color = STATUS_COLORS[statut] || 'gray'
  return <span className={`badge badge-${color}`}>{statut}</span>
}

export function formatSince(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return '0 j'
  return `${Math.floor(diffMs / 86400000)} j`
}

// vert < 2j, orange 2-4j, rouge > 4j
export function sinceClass(iso) {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 2) return 'since-ok'
  if (days <= 4) return 'since-warn'
  return 'since-late'
}

function AnomalyForm({ barcode, comment, onDone }) {
  const [type, setType] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!type) { setError('Choisissez un type d\'anomalie.'); return }
    setSending(true)
    setError(null)
    try {
      await authedFetch('/.netlify/functions/anomaly', {
        method: 'POST',
        body: JSON.stringify({ barcode, type, commentaire: comment }),
      })
      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="anomaly-form">
      <select className="form-input w-full" value={type} onChange={e => setType(e.target.value)}>
        <option value="">— Type d'anomalie —</option>
        {ANOMALY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {error && <div className="login-error">{error}</div>}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={submit} disabled={sending}>
          {sending ? 'Envoi…' : 'Signaler'}
        </button>
        <button className="btn" onClick={() => onDone(true)}>Annuler</button>
      </div>
    </div>
  )
}

export default function TaskCard({ device, onSave, readOnly = false }) {
  const [comment, setComment] = useState(device.tech_commentaire || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!device.task_done)
  const [showAnomaly, setShowAnomaly] = useState(false)
  const [anomalySent, setAnomalySent] = useState(false)

  async function saveComment() {
    if (readOnly) return
    setSaving(true)
    try {
      await onSave(device.barcode, { tech_commentaire: comment })
    } catch (e) {
      alert("Échec de l'enregistrement : " + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleDone() {
    if (readOnly) return
    const next = !done
    setDone(next)
    setSaving(true)
    try {
      await onSave(device.barcode, { task_done: next })
    } catch (e) {
      setDone(!next)
      alert("Échec de l'enregistrement : " + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`task-card${done ? ' task-card-done' : ''}`}>
      <div className="task-card-top">
        <div>
          <div className="task-card-title">{device.area} · {device.subarea}</div>
          <div className="task-card-sub">{device.brand_name} — {device.service_sub_category_name}</div>
        </div>
        <StatusBadge statut={device.status} />
      </div>

      <div className="task-card-meta">
        <span>Code-barres : <b>{device.barcode}</b></span>
        <span className={sinceClass(device.status_since)}>Depuis {formatSince(device.status_since)}</span>
      </div>

      {device.action && (
        <div className="task-card-action">Action demandée : <b>{device.action}</b></div>
      )}
      {device.commentaire && (
        <div className="task-card-admin-comment">Note admin : {device.commentaire}</div>
      )}

      {readOnly ? (
        device.tech_commentaire && (
          <div className="task-card-admin-comment">Commentaire technicien : {device.tech_commentaire}</div>
        )
      ) : (
        <>
          <label className="form-label">Commentaire (optionnel)</label>
          <textarea
            className="form-input w-full"
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={saveComment}
            placeholder="Ce que vous avez fait, un blocage… (utilisé aussi si vous signalez une anomalie)"
          />
          <button className={`btn task-done-btn${done ? ' task-done-btn-active' : ''}`} onClick={toggleDone} disabled={saving}>
            {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {done ? 'Tâche réalisée' : 'Marquer comme réalisée'}
          </button>

          {!showAnomaly && !anomalySent && (
            <button className="btn anomaly-btn" onClick={() => setShowAnomaly(true)}>
              <AlertTriangle size={14} />
              Signaler une anomalie
            </button>
          )}
          {anomalySent && (
            <div className="anomaly-sent"><AlertTriangle size={13} /> Anomalie signalée</div>
          )}
          {showAnomaly && (
            <AnomalyForm
              barcode={device.barcode}
              comment={comment}
              onDone={(cancelled) => { setShowAnomaly(false); if (!cancelled) setAnomalySent(true) }}
            />
          )}
        </>
      )}
      {readOnly && (
        <div className="flex gap-2 items-center text-sm text-gray">
          {done ? <CheckCircle2 size={14} color="var(--green)" /> : <Circle size={14} />}
          {done ? 'Tâche réalisée' : 'En cours'}
        </div>
      )}
    </div>
  )
}
