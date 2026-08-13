import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { RefreshCw, Search } from 'lucide-react'

const STATUS_COLORS = {
  'Mise en test': 'blue',
  'En attente de mise en test': 'orange',
  'Attente pièces': 'orange',
  'Contrôle qualité': 'green',
  'Restitution partenaire': 'gray',
  'Appareil à démonter': 'red',
}

function StatusBadge({ statut }) {
  if (!statut) return <span className="badge badge-gray">—</span>
  const color = STATUS_COLORS[statut] || 'gray'
  return <span className={`badge badge-${color}`}>{statut}</span>
}

export default function Planification() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [ligneFilter, setLigneFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('planning')
      .select('*')
      .order('zone_rdn', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const lignes = useMemo(
    () => [...new Set(rows.map(r => r.ligne).filter(Boolean))].sort(),
    [rows]
  )
  const techniciens = useMemo(
    () => [...new Set(rows.map(r => r.technicien).filter(Boolean))].sort(),
    [rows]
  )
  const statuts = useMemo(
    () => [...new Set(rows.map(r => r.statut).filter(Boolean))].sort(),
    [rows]
  )

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (ligneFilter && r.ligne !== ligneFilter) return false
      if (technicienFilter && r.technicien !== technicienFilter) return false
      if (statutFilter && r.statut !== statutFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [r.barcode, r.zone_rdn, r.marque, r.type_appareil, r.commentaire]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, ligneFilter, technicienFilter, statutFilter, search])

  const occupied = rows.filter(r => r.barcode).length

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Planification</h2>
        <p className="page-subtitle">Postes de ligne, unités en cours et technicien affecté</p>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Postes suivis</div>
            <div className="stat-value">{rows.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Postes occupés</div>
            <div className="stat-value">{occupied}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lignes actives</div>
            <div className="stat-value">{lignes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Techniciens mobilisés</div>
            <div className="stat-value">{techniciens.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Postes de ligne ({filtered.length})</span>
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
              <div className="search-box">
                <Search size={14} />
                <input
                  className="form-input search-input"
                  placeholder="Rechercher (code-barres, marque, type...)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="form-input" value={ligneFilter} onChange={e => setLigneFilter(e.target.value)}>
                <option value="">Toutes les lignes</option>
                {lignes.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select className="form-input" value={technicienFilter} onChange={e => setTechnicienFilter(e.target.value)}>
                <option value="">Tous les techniciens</option>
                {techniciens.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                {statuts.map(s => <option key={s} value={s}>{s}</option>)}
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
                <div className="empty-state-title">Aucun poste trouvé</div>
                <div className="empty-state-sub">Ajuste les filtres ou vérifie que les données ont été importées (voir supabase_seed.sql).</div>
              </div>
            )}
            {!error && !loading && filtered.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Marque</th>
                    <th>Statut</th>
                    <th>Technicien</th>
                    <th>Action</th>
                    <th>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="font-bold">{r.zone_rdn}</td>
                      <td>{r.barcode || '—'}</td>
                      <td>{r.type_appareil || '—'}</td>
                      <td>{r.marque || '—'}</td>
                      <td><StatusBadge statut={r.statut} /></td>
                      <td>{r.technicien || '—'}</td>
                      <td>{r.action || '—'}</td>
                      <td className="text-sm text-gray" style={{ maxWidth: 260 }}>{r.commentaire || '—'}</td>
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
