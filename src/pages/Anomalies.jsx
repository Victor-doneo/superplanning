import { useCallback, useEffect, useMemo, useState } from 'react'
import { authedFetch } from '../auth'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await authedFetch('/.netlify/functions/anomalies-log')
      setAnomalies(body.anomalies || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const types = useMemo(() => [...new Set(anomalies.map(a => a.type))].sort(), [anomalies])
  const techniciens = useMemo(() => [...new Set(anomalies.map(a => a.technicien).filter(Boolean))].sort(), [anomalies])

  const filtered = anomalies.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false
    if (technicienFilter && a.technicien !== technicienFilter) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Anomalies</h2>
        <p className="page-subtitle">Anomalies remontées aujourd'hui, tous techniciens confondus</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Aujourd'hui ({filtered.length})</span>
            <div className="flex gap-2 items-center">
              <select className="form-input" value={technicienFilter} onChange={e => setTechnicienFilter(e.target.value)}>
                <option value="">Tous les techniciens</option>
                {techniciens.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">Tous les types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="btn btn-icon" onClick={load} title="Rafraîchir">
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">Aucune anomalie aujourd'hui</div>
                <div className="empty-state-sub">Les anomalies signalées par les techniciens apparaîtront ici.</div>
              </div>
            )}
            {!error && !loading && filtered.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Technicien</th>
                    <th>Ligne</th>
                    <th>Banc</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id}>
                      <td><AlertTriangle size={14} color="var(--orange)" style={{ verticalAlign: 'middle', marginRight: 6 }} />{new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="font-bold">{a.technicien || '—'}</td>
                      <td>{a.area || '—'}</td>
                      <td>{a.subarea || '—'}</td>
                      <td>{a.barcode}</td>
                      <td><span className="badge badge-orange">{a.type}</span></td>
                      <td className="text-sm text-gray">{a.commentaire || '—'}</td>
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
