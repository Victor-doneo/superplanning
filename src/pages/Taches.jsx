import { useEffect, useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { useAuth } from '../AuthContext'
import { authedFetch } from '../auth'
import TaskCard from '../TaskCard'
import DateRangePicker, { todayISODate } from '../DateRangePicker'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function Taches() {
  const { devices, loading, error, reload, saveAssignment } = usePlanningData()
  const { name } = useAuth()
  const [showDone, setShowDone] = useState(false)
  const [range, setRange] = useState({ from: todayISODate(), to: todayISODate() })

  const mine = useMemo(
    () => devices
      .filter(d => d.technicien === name)
      .filter(d => showDone || !d.task_done)
      .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr')),
    [devices, name, showDone]
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

        {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
        {!error && loading && <div className="loading-state">Chargement…</div>}
        {!error && !loading && mine.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">Aucune tâche</div>
            <div className="empty-state-sub">Aucun appareil ne vous est actuellement affecté personnellement.</div>
          </div>
        )}
        <div className="tasks-grid" style={{ marginBottom: 24 }}>
          {!error && !loading && mine.map(d => (
            <TaskCard key={d.barcode} device={d} onSave={saveAssignment} />
          ))}
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Mon historique</span>
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {doneEvents.map(ev => (
                    <tr key={ev.id}>
                      <td><CheckCircle2 size={14} color="var(--green)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{ev.area || '—'}</td>
                      <td>{ev.subarea && ev.subarea !== ev.area ? ev.subarea : '—'}</td>
                      <td>{ev.barcode}</td>
                      <td>{ev.action || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {anomalyEvents.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Mes anomalies signalées</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyEvents.map(an => (
                    <tr key={an.id}>
                      <td><AlertTriangle size={14} color="var(--orange)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(an.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{an.barcode}</td>
                      <td><span className="badge badge-orange">{an.anomaly_type}</span></td>
                      <td className="text-sm text-gray">{an.commentaire || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
