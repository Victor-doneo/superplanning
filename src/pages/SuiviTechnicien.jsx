import { useEffect, useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { authedFetch } from '../auth'
import TaskCard from '../TaskCard'
import DateRangePicker, { todayISODate } from '../DateRangePicker'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function SuiviTechnicien() {
  const { devices, technicians, loading, error, reload } = usePlanningData()
  const [selected, setSelected] = useState('')
  const [range, setRange] = useState({ from: todayISODate(), to: todayISODate() })

  const technicienNames = useMemo(
    () => [...new Set(technicians.map(t => t.name).filter(Boolean))].sort(),
    [technicians]
  )

  const tasks = useMemo(
    () => devices
      .filter(d => d.technicien === selected)
      .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr')),
    [devices, selected]
  )

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState(null)

  useEffect(() => {
    if (!selected) { setEvents([]); return }
    setEventsLoading(true)
    setEventsError(null)
    authedFetch(`/.netlify/functions/events-log?technicien=${encodeURIComponent(selected)}&from=${range.from}&to=${range.to}`)
      .then(body => setEvents(body.events || []))
      .catch(e => setEventsError(e.message))
      .finally(() => setEventsLoading(false))
  }, [selected, range])

  const doneEvents = events.filter(e => e.event_type === 'task_done')
  const anomalyEvents = events.filter(e => e.event_type === 'anomaly')

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Suivi technicien</h2>
        <p className="page-subtitle">Tâches en cours et historique, par technicien</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
          <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— Choisir un technicien —</option>
            {technicienNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
          <button className="btn btn-icon" onClick={reload} title="Rafraîchir">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {!selected && (
          <div className="empty-state">
            <div className="empty-state-title">Choisissez un technicien</div>
            <div className="empty-state-sub">Sélectionnez un nom dans la liste ci-dessus pour voir ses tâches.</div>
          </div>
        )}

        {selected && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">Tâches en cours ({tasks.length})</span>
              </div>
              <div className="tasks-grid" style={{ padding: 20 }}>
                {error && <div className="empty-state-sub">{error}</div>}
                {!error && tasks.length === 0 && (
                  <div className="empty-state-sub">Aucune tâche en cours pour {selected}.</div>
                )}
                {!error && tasks.map(d => (
                  <TaskCard key={d.barcode} device={d} readOnly />
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Réalisées ({doneEvents.length})</span>
              </div>
              <div className="table-wrapper">
                {eventsError && <div className="empty-state"><div className="empty-state-sub">{eventsError}</div></div>}
                {!eventsError && eventsLoading && <div className="loading-state">Chargement…</div>}
                {!eventsError && !eventsLoading && doneEvents.length === 0 && (
                  <div className="empty-state"><div className="empty-state-sub">Aucune tâche réalisée sur cette période pour {selected}.</div></div>
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
                        <th>Commentaire admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doneEvents.map(ev => (
                        <tr key={ev.id}>
                          <td><CheckCircle2 size={14} color="var(--green)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{ev.area || '—'}</td>
                          <td>{ev.subarea && ev.subarea !== ev.area ? ev.subarea : '—'}</td>
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

            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">Anomalies signalées ({anomalyEvents.length})</span>
              </div>
              <div className="table-wrapper">
                {eventsError && <div className="empty-state"><div className="empty-state-sub">{eventsError}</div></div>}
                {!eventsError && eventsLoading && <div className="loading-state">Chargement…</div>}
                {!eventsError && !eventsLoading && anomalyEvents.length === 0 && (
                  <div className="empty-state"><div className="empty-state-sub">Aucune anomalie signalée sur cette période pour {selected}.</div></div>
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
                        <th>Commentaire admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalyEvents.map(an => (
                        <tr key={an.id}>
                          <td><AlertTriangle size={14} color="var(--orange)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(an.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{an.area || '—'}</td>
                          <td>{an.subarea && an.subarea !== an.area ? an.subarea : '—'}</td>
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
          </>
        )}
      </div>
    </>
  )
}
