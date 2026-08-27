import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { useAuth } from '../AuthContext'
import TaskCard from '../TaskCard'
import { RefreshCw, LogOut } from 'lucide-react'

export default function MesTaches() {
  const { devices, loading, error, reload, saveAssignment } = usePlanningData()
  const { name, signOut } = useAuth()
  const [showDone, setShowDone] = useState(false)

  const mine = useMemo(
    () => devices
      .filter(d => d.technicien === name)
      .filter(d => showDone || !d.task_done)
      .filter(d => !d.last_anomaly)
      .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || (a.area || '').localeCompare(b.area || '', 'fr', { numeric: true }) || (a.subarea || '').localeCompare(b.subarea || '', 'fr', { numeric: true })),
    [devices, name, showDone]
  )

  const pendingAnomalyCount = useMemo(
    () => devices.filter(d => d.technicien === name && d.last_anomaly).length,
    [devices, name]
  )

  return (
    <div className="tech-page">
      <div className="tech-topbar">
        <div>
          <div className="tech-topbar-title">Mes tâches</div>
          <div className="tech-topbar-sub">{name}</div>
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
        {pendingAnomalyCount > 0 && (
          <div className="anomaly-pending-note">
            {pendingAnomalyCount} tâche{pendingAnomalyCount > 1 ? 's' : ''} masquée{pendingAnomalyCount > 1 ? 's' : ''} en attente de traitement de l'anomalie signalée
          </div>
        )}

        {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
        {!error && loading && <div className="loading-state">Chargement…</div>}
        {!error && !loading && mine.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Aucune tâche pour le moment</div>
            <div className="empty-state-sub">Les appareils qui vous sont affectés apparaîtront ici.</div>
          </div>
        )}
        {!error && !loading && mine.map(d => (
          <TaskCard key={d.barcode} device={d} onSave={saveAssignment} />
        ))}
      </div>
    </div>
  )
}
