import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from '../auth'
import { RefreshCw } from 'lucide-react'

export default function Pins() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await authedFetch('/.netlify/functions/pins')
      setPeople(body.people || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Accès</h2>
        <p className="page-subtitle">
          Vue en lecture seule — les codes PIN sont gérés dans votre autre outil (table collaborateurs)
        </p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Personnes ({people.length})</span>
            <button className="btn btn-icon" onClick={load} title="Rafraîchir">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && people.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">Aucune personne trouvée</div>
                <div className="empty-state-sub">Aucun compte avec le rôle "Réparation" ou "Admin réparation" dans votre table users.</div>
              </div>
            )}
            {!error && !loading && people.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Rôle</th>
                    <th>Statut PIN</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(p => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.name}</td>
                      <td>{p.role === 'admin' ? 'Admin' : 'Technicien'}</td>
                      <td>
                        {p.has_pin
                          ? <span className="badge badge-green">PIN défini</span>
                          : <span className="badge badge-gray">Aucun PIN</span>}
                      </td>
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
