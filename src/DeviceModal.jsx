import { useEffect, useState } from 'react'
import { authedFetch } from './auth'
import { StatusBadge, formatSince, sinceClass } from './TaskCard'
import { X, CheckCircle2, AlertTriangle, Send, RefreshCw, Star } from 'lucide-react'

const ACTIONS = ['Pré-diagnostic', 'Diagnostic', 'Réparation', 'Contrôle qualité', 'Validation']

export default function DeviceModal({ device, technicienNames, onClose, onSave, onValidate, focusComment = false }) {
  const [technicien, setTechnicien] = useState(device.draft_technicien || '')
  const [action, setAction] = useState(device.draft_action || '')
  const [commentaire, setCommentaire] = useState(device.draft_commentaire || '')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setEventsLoading(true)
    setEventsError(null)
    authedFetch(`/.netlify/functions/events-log?barcode=${encodeURIComponent(device.barcode)}`)
      .then(body => setEvents(body.events || []))
      .catch(e => setEventsError(e.message))
      .finally(() => setEventsLoading(false))
  }, [device.barcode])

  async function persist(fields) {
    setSaving(true)
    try {
      await onSave(device.barcode, fields)
    } catch (e) {
      alert("Échec de l'enregistrement : " + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    setValidating(true)
    try {
      await onValidate([device.barcode])
    } catch (e) {
      alert('Échec de la validation : ' + e.message)
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{device.area || '—'} · {device.subarea && device.subarea !== device.area ? device.subarea : ''}</div>
            <div className="modal-sub">{device.brand_name} — {device.service_sub_category_name} · Code-barres {device.barcode}</div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-status-row">
            <StatusBadge statut={device.status} />
            <span className={`text-sm ${sinceClass(device.status_since)}`}>Depuis {formatSince(device.status_since)}</span>
            {device.pending_validation && <span className="badge badge-orange">En attente de validation</span>}
            <button
              className={`btn-priority${device.draft_priority ? ' btn-priority-active' : ''}`}
              onClick={() => persist({ draft_technicien: technicien, draft_action: action, draft_commentaire: commentaire, draft_priority: !device.draft_priority })}
              title={device.draft_priority ? 'Retirer la priorité' : 'Marquer prioritaire'}
            >
              <Star size={16} fill={device.draft_priority ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Affectation</div>
            <div className="modal-grid">
              <div>
                <label className="form-label">Technicien</label>
                <select
                  className="form-input w-full"
                  value={technicien}
                  onChange={e => { setTechnicien(e.target.value); persist({ draft_technicien: e.target.value, draft_action: action, draft_commentaire: commentaire }) }}
                >
                  <option value="">—</option>
                  {technicienNames.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Action</label>
                <select
                  className="form-input w-full"
                  value={action}
                  onChange={e => { setAction(e.target.value); persist({ draft_technicien: technicien, draft_action: e.target.value, draft_commentaire: commentaire }) }}
                >
                  <option value="">—</option>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <label className="form-label">Commentaire admin</label>
            <textarea
              className="form-input w-full"
              rows={2}
              autoFocus={focusComment}
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              onBlur={() => persist({ draft_technicien: technicien, draft_action: action, draft_commentaire: commentaire })}
              placeholder="Instructions pour le technicien…"
            />
            <div className="flex gap-2 items-center" style={{ marginTop: 8 }}>
              {saving && <span className="text-sm text-gray"><RefreshCw size={12} className="spin" style={{ verticalAlign: -1, marginRight: 4 }} />Enregistrement…</span>}
              {device.pending_validation && (
                <button className="btn btn-validate" onClick={handleValidate} disabled={validating}>
                  <Send size={13} />
                  {validating ? 'Envoi…' : 'Valider la tâche'}
                </button>
              )}
            </div>
          </div>

          {device.tech_commentaire && (
            <div className="modal-section">
              <div className="modal-section-title">Commentaire technicien</div>
              <div className="task-card-admin-comment">{device.tech_commentaire}</div>
            </div>
          )}

          <div className="modal-section">
            <div className="modal-section-title">Historique de cet appareil</div>
            {eventsError && <div className="empty-state-sub">{eventsError}</div>}
            {!eventsError && eventsLoading && <div className="loading-state">Chargement…</div>}
            {!eventsError && !eventsLoading && events.length === 0 && (
              <div className="empty-state-sub">Aucun événement enregistré pour cet appareil.</div>
            )}
            {!eventsError && !eventsLoading && events.length > 0 && (
              <ul className="modal-history-list">
                {events.map(ev => (
                  <li key={ev.id} className="modal-history-item">
                    {ev.event_type === 'task_done' ? (
                      <CheckCircle2 size={14} color="var(--green)" />
                    ) : (
                      <AlertTriangle size={14} color="var(--orange)" />
                    )}
                    <div>
                      <div className="modal-history-line">
                        {ev.event_type === 'task_done' ? (
                          <>Tâche réalisée{ev.action ? ` — ${ev.action}` : ''}</>
                        ) : (
                          <>Anomalie : <b>{ev.anomaly_type}</b></>
                        )}
                        <span className="text-sm text-gray"> · {ev.technicien || 'inconnu'}</span>
                      </div>
                      <div className="text-sm text-gray">
                        {new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {ev.commentaire ? ` — ${ev.commentaire}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
