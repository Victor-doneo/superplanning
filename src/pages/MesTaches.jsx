import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { useAuth } from '../AuthContext'
import { RefreshCw, LogOut, CheckCircle2, Circle } from 'lucide-react'

const STATUS_COLORS = {
  'En attente de mise en test': 'gray',
  'Mise en test': 'green',
  'Attente pièces': 'yellow',
  'Contrôle qualité': 'orange',
  'Appareil à démonter': 'red',
  'Restitution partenaire': 'red',
}

function StatusBadge({ statut }) {
  if (!statut) return <span className="badge badge-gray">—</span>
  const color = STATUS_COLORS[statut] || 'gray'
  return <span className={`badge badge-${color}`}>{statut}</span>
}

function formatSince(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return '0 j'
  return `${Math.floor(diffMs / 86400000)} j`
}

function TaskCard({ device, onSave }) {
  const [comment, setComment] = useState(device.tech_commentaire || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!device.task_done)

  async function saveComment() {
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
        <span>Depuis {formatSince(device.status_since)}</span>
      </div>

      {device.action && (
        <div className="task-card-action">Action demandée : <b>{device.action}</b></div>
      )}
      {device.commentaire && (
        <div className="task-card-admin-comment">Note admin : {device.commentaire}</div>
      )}

      <label className="form-label">Votre commentaire</label>
      <textarea
        className="form-input w-full"
        rows={2}
        value={comment}
        onChange={e => setComment(e.target.value)}
        onBlur={saveComment}
        placeholder="Notez ce que vous avez fait, un blocage..."
      />

      <button className={`btn task-done-btn${done ? ' task-done-btn-active' : ''}`} onClick={toggleDone} disabled={saving}>
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        {done ? 'Tâche réalisée' : 'Marquer comme réalisée'}
      </button>
    </div>
  )
}

export default function MesTaches() {
  const { devices, loading, error, reload, saveAssignment } = usePlanningData()
  const { technicienName, signOut } = useAuth()
  const [showDone, setShowDone] = useState(false)

  const filtered = useMemo(
    () => devices
      .filter(d => showDone || !d.task_done)
      .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr')),
    [devices, showDone]
  )

  return (
    <div className="tech-page">
      <div className="tech-topbar">
        <div>
          <div className="tech-topbar-title">Mes tâches</div>
          <div className="tech-topbar-sub">{technicienName}</div>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn btn-icon" onClick={reload} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-icon" onClick={signOut} title="Déconnexion">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="tech-body">
        <label className="tech-toggle">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
          Afficher les tâches déjà réalisées
        </label>

        {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
        {!error && loading && <div className="loading-state">Chargement…</div>}
        {!error && !loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Aucune tâche pour le moment</div>
            <div className="empty-state-sub">Les appareils qui vous sont affectés apparaîtront ici.</div>
          </div>
        )}
        {!error && !loading && filtered.map(d => (
          <TaskCard key={d.barcode} device={d} onSave={saveAssignment} />
        ))}
      </div>
    </div>
  )
}
