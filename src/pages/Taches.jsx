import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { useAuth } from '../AuthContext'
import TaskCard from '../TaskCard'
import { RefreshCw } from 'lucide-react'

export default function Taches() {
  const { devices, loading, error, reload, saveAssignment } = usePlanningData()
  const { name } = useAuth()
  const [showDone, setShowDone] = useState(false)

  const mine = useMemo(
    () => devices
      .filter(d => d.technicien === name)
      .filter(d => showDone || !d.task_done)
      .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr')),
    [devices, name, showDone]
  )

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Tâches</h2>
        <p className="page-subtitle">Les appareils qui vous sont affectés personnellement</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
          <label className="tech-toggle" style={{ padding: 0 }}>
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
            Afficher les tâches déjà réalisées
          </label>
          <button className="btn btn-icon" onClick={reload} title="Rafraîchir">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
        {!error && loading && <div className="loading-state">Chargement…</div>}
        {!error && !loading && mine.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Aucune tâche</div>
            <div className="empty-state-sub">Aucun appareil ne vous est actuellement affecté personnellement.</div>
          </div>
        )}
        <div className="tasks-grid">
          {!error && !loading && mine.map(d => (
            <TaskCard key={d.barcode} device={d} onSave={saveAssignment} />
          ))}
        </div>
      </div>
    </>
  )
}
