import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
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

const ACTIONS = ['Pré-diagnostic', 'Diagnostic', 'Réparation', 'Contrôle qualité', 'Validation']

function EditableRow({ device, technicienNames, onSave }) {
  const [technicien, setTechnicien] = useState(device.technicien || '')
  const [action, setAction] = useState(device.action || '')
  const [commentaire, setCommentaire] = useState(device.commentaire || '')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  async function persist(fields) {
    setSaving(true)
    try {
      await onSave(device.barcode, fields)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
    } catch (e) {
      alert("Échec de l'enregistrement : " + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td className="font-bold">{device.area || '—'}</td>
      <td>{device.subarea || '—'}</td>
      <td>{device.barcode}</td>
      <td>{device.service_sub_category_name || '—'}</td>
      <td>{device.brand_name || '—'}</td>
      <td><StatusBadge statut={device.status} /></td>
      <td>
        <select
          className="form-input"
          value={technicien}
          onChange={e => { setTechnicien(e.target.value); persist({ technicien: e.target.value, action, commentaire }) }}
        >
          <option value="">—</option>
          {technicienNames.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td>
        <select
          className="form-input"
          value={action}
          onChange={e => { setAction(e.target.value); persist({ technicien, action: e.target.value, commentaire }) }}
        >
          <option value="">—</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </td>
      <td>
        <input
          className="form-input"
          style={{ minWidth: 180 }}
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          onBlur={() => persist({ technicien, action, commentaire })}
          placeholder="Commentaire…"
        />
      </td>
      <td style={{ width: 24 }}>
        {saving && <RefreshCw size={13} className="spin text-gray" />}
        {!saving && savedFlash && <span className="text-sm" style={{ color: 'var(--green)' }}>✓</span>}
      </td>
    </tr>
  )
}

export default function Planification() {
  const { devices, technicians, loading, error, reload, saveAssignment } = usePlanningData()

  const [search, setSearch] = useState('')
  const [ligneFilter, setLigneFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')

  const lignes = useMemo(
    () => [...new Set(devices.map(d => d.area).filter(Boolean))].sort(),
    [devices]
  )
  const statuts = useMemo(
    () => [...new Set(devices.map(d => d.status).filter(Boolean))].sort(),
    [devices]
  )
  const technicienNames = useMemo(
    () => [...new Set(technicians.map(t => t.name).filter(Boolean))].sort(),
    [technicians]
  )

  const filtered = useMemo(() => {
    return devices.filter(d => {
      if (ligneFilter && d.area !== ligneFilter) return false
      if (technicienFilter && d.technicien !== technicienFilter) return false
      if (statutFilter && d.status !== statutFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [d.barcode, d.area, d.subarea, d.brand_name, d.service_sub_category_name, d.commentaire]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [devices, ligneFilter, technicienFilter, statutFilter, search])

  const assigned = devices.filter(d => d.technicien).length

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Planification</h2>
        <p className="page-subtitle">Unités en cours sur les lignes de test et de réparation</p>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Unités en atelier</div>
            <div className="stat-value">{devices.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Affectées à un technicien</div>
            <div className="stat-value">{assigned}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lignes actives</div>
            <div className="stat-value">{lignes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Techniciens réparation</div>
            <div className="stat-value">{technicians.length}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Unités ({filtered.length})</span>
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
                {technicienNames.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                {statuts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-icon" onClick={reload} title="Rafraîchir">
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">Aucune unité trouvée</div>
                <div className="empty-state-sub">Ajuste les filtres, ou vérifie que la fonction serveur est bien configurée (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).</div>
              </div>
            )}
            {!error && !loading && filtered.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Banc</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Marque</th>
                    <th>Statut</th>
                    <th>Technicien</th>
                    <th>Action</th>
                    <th>Commentaire</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <EditableRow key={d.barcode} device={d} technicienNames={technicienNames} onSave={saveAssignment} />
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
