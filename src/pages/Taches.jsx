import { useEffect, useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { useAuth } from '../AuthContext'
import { authedFetch } from '../auth'
import TaskCard from '../TaskCard'
import DateRangePicker, { defaultRange } from '../DateRangePicker'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function Taches() {
  const { devices, loading, error, reload, saveAssignment } = usePlanningData()
  const { name } = useAuth()
  const [showDone, setShowDone] = useState(false)
  const [range, setRange] = useState(defaultRange())

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

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState(null)

  useEffect(() => {
    if (!name) return
    setEventsLoading(true)
    setEventsError(null)
    authedFetch(`/.netlify/functions/events-log?technicien=${encodeURIComponent(name)}&from=${range.from}&to=${range.to}`)
      .then(body => setEvents(body.events || []))
      .catch(e => setEventsError(e.message))
      .finally(() => setEventsLoading(false))
  }, [name, range])

  const doneEvents = events.filter(e => e.event_type === 'task_done')
  const anomalyEvents = events.filter(e => e.event_type === 'anomaly')

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
        {pendingAnomalyCount > 0 && (
          <div className="anomaly-pending-note" style={{ marginBottom: 16 }}>
            {pendingAnomalyCount} tâche{pendingAnomalyCount > 1 ? 's' : ''} masquée{pendingAnomalyCount > 1 ? 's' : ''} en attente de traitement de l'anomalie signalée
          </div>
        )}

        {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
        {!error && loading && <div className="loading-state">Chargement…</div>}
        {!error && !loading && mine.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Aucune tâche</div>
            <div className="empty-state-sub">Aucun appareil ne vous est actuellement affecté personnellement.</div>
          </div>
        )}
        <div className="tasks-grid" style={{ marginBottom: 28 }}>
          {!error && !loading && mine.map(d => (
            <TaskCard key={d.barcode} device={d} onSave={saveAssignment} />
          ))}
        </div>

        <div className="flex gap-2 items-center" style={{ marginBottom: 16 }}>
          <span className="font-bold text-sm">Historique</span>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Réalisées ({doneEvents.length})</span>
          </div>
          <div className="table-wrapper">
            {eventsError && <div className="empty-state"><div className="empty-state-sub">{eventsError}</div></div>}
            {!eventsError && eventsLoading && <div className="loading-state">Chargement…</div>}
            {!eventsError && !eventsLoading && doneEvents.length === 0 && (
              <div className="empty-state"><div className="empty-state-sub">Aucune tâche réalisée sur cette période.</div></div>
            )}
            {!eventsError && !eventsLoading && doneEvents.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ligne</th>
                    <th>Banc</th>
                    <th>Code-barres</th>
                    <th>Marque / Type</th>
                    <th>Action</th>
                    <th>Commentaire (planification)</th>
                  </tr>
                </thead>
                <tbody>
                  {doneEvents.map(ev => (
                    <tr key={ev.id}>
                      <td><CheckCircle2 size={14} color="var(--green)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{ev.area || '—'}</td>
                      <td>{ev.subarea || '—'}</td>
                      <td>{ev.barcode}</td>
                      <td>{ev.brand_name} {ev.service_sub_category_name}</td>
                      <td>{ev.action || '—'}</td>
                      <td className="text-sm text-gray">{ev.assignment_commentaire || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Anomalies signalées ({anomalyEvents.length})</span>
          </div>
          <div className="table-wrapper">
            {eventsError && <div className="empty-state"><div className="empty-state-sub">{eventsError}</div></div>}
            {!eventsError && eventsLoading && <div className="loading-state">Chargement…</div>}
            {!eventsError && !eventsLoading && anomalyEvents.length === 0 && (
              <div className="empty-state"><div className="empty-state-sub">Aucune anomalie signalée sur cette période.</div></div>
            )}
            {!eventsError && !eventsLoading && anomalyEvents.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ligne</th>
                    <th>Banc</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Détail</th>
                    <th>Commentaire (planification)</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyEvents.map(an => (
                    <tr key={an.id}>
                      <td><AlertTriangle size={14} color="var(--orange)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(an.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{an.area || '—'}</td>
                      <td>{an.subarea || '—'}</td>
                      <td>{an.barcode}</td>
                      <td><span className="badge badge-orange">{an.anomaly_type}</span></td>
                      <td className="text-sm text-gray">{an.commentaire || '—'}</td>
                      <td className="text-sm text-gray">{an.assignment_commentaire || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
