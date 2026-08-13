import { useMemo } from 'react'
import { usePlanningData } from '../usePlanningData'
import { RefreshCw } from 'lucide-react'

export default function Collaborateurs() {
  const { devices, technicians, loading, error, reload } = usePlanningData()

  const countFor = (name) => devices.filter(d => d.technicien === name).length
  const lignesFor = (name) => [...new Set(devices.filter(d => d.technicien === name).map(d => d.area).filter(Boolean))]

  const sorted = useMemo(
    () => [...technicians].sort((a, b) => a.name.localeCompare(b.name)),
    [technicians]
  )

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Collaborateurs</h2>
        <p className="page-subtitle">Techniciens de l'atelier réparation et leur charge actuelle</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Équipe atelier ({sorted.length})</span>
            <button className="btn btn-icon" onClick={reload} title="Rafraîchir">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Unités affectées</th>
                    <th>Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(t => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.name}</td>
                      <td>{countFor(t.name)}</td>
                      <td className="text-sm text-gray">{lignesFor(t.name).join(', ') || '—'}</td>
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
