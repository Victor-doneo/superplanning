import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { RefreshCw } from 'lucide-react'

export default function Collaborateurs() {
  const [techs, setTechs] = useState([])
  const [planning, setPlanning] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: t, error: e1 }, { data: p, error: e2 }] = await Promise.all([
      supabase.from('technicians').select('*').order('name'),
      supabase.from('planning').select('technicien, statut, ligne'),
    ])
    if (e1 || e2) {
      setError((e1 || e2).message)
    } else {
      setTechs(t || [])
      setPlanning(p || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const countFor = (name) => planning.filter(p => p.technicien === name).length
  const lignesFor = (name) => [...new Set(planning.filter(p => p.technicien === name).map(p => p.ligne).filter(Boolean))]

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Collaborateurs</h2>
        <p className="page-subtitle">Techniciens et leur charge actuelle sur les lignes</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Équipe atelier ({techs.length})</span>
            <button className="btn btn-icon" onClick={load} title="Rafraîchir">
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
                    <th>Rôle</th>
                    <th>Postes affectés</th>
                    <th>Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {techs.map(t => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.name}</td>
                      <td>{t.role || '—'}</td>
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
