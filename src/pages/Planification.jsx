import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { StatusBadge, formatSince, sinceClass } from '../TaskCard'
import { RefreshCw, Search, CheckCircle2, AlertTriangle } from 'lucide-react'

const ZONE_TYPES = ['Zone attente validation', 'Zone qualité', 'Zone bancs', 'Autres zones']
const ACTIONS = ['Pré-diagnostic', 'Diagnostic', 'Réparation', 'Contrôle qualité', 'Validation']

function zoneTypeOf(area) {
  if (!area) return 'Autres zones'
  if (area === 'Zone attente validation') return 'Zone attente validation'
  if (area === 'Zone qualité') return 'Zone qualité'
  if (area.startsWith('Ligne')) return 'Zone bancs'
  return 'Autres zones'
}

// Évite d'afficher deux fois la même info : dans les zones sans vrais
// "bancs" (Zone qualité, Zone attente validation...), subarea vaut souvent
// la même chose que area — dans ce cas on n'affiche rien en Banc.
function subareaDisplay(device) {
  if (!device.subarea) return '—'
  if (device.subarea === device.area) return '—'
  return device.subarea
}

function TacheStatusBadge({ device }) {
  if (device.task_done) {
    return <span className="badge badge-green"><CheckCircle2 size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Réalisée</span>
  }
  if (device.last_anomaly) {
    return <span className="badge badge-orange"><AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{device.last_anomaly}</span>
  }
  return <span className="text-sm text-gray">—</span>
}

function EditableRow({ device, technicienNames, onSave, checked, onToggleCheck }) {
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
    <tr className={checked ? 'row-selected' : ''}>
      <td className="td-checkbox">
        <input type="checkbox" checked={checked} onChange={() => onToggleCheck(device.barcode)} />
      </td>
      <td className="font-bold col-narrow">{device.area || '—'}</td>
      <td className="col-narrow">{subareaDisplay(device)}</td>
      <td>{device.barcode}</td>
      <td>{device.service_sub_category_name || '—'}</td>
      <td>{device.brand_name || '—'}</td>
      <td><StatusBadge statut={device.status} /></td>
      <td className={`text-sm ${sinceClass(device.status_since)}`}>{formatSince(device.status_since)}</td>
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
          style={{ minWidth: 130 }}
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          onBlur={() => persist({ technicien, action, commentaire })}
          placeholder="Commentaire…"
        />
      </td>
      <td className="text-sm text-gray" style={{ minWidth: 140 }}>{device.tech_commentaire || '—'}</td>
      <td><TacheStatusBadge device={device} /></td>
      <td style={{ width: 20 }}>
        {saving && <RefreshCw size={12} className="spin text-gray" />}
        {!saving && savedFlash && <span style={{ color: 'var(--green)' }}>✓</span>}
      </td>
    </tr>
  )
}

export default function Planification() {
  const { devices, technicians, loading, error, reload, saveAssignment } = usePlanningData()

  const [search, setSearch] = useState('')
  const [ligneFilter, setLigneFilter] = useState('')
  const [zoneTypeFilter, setZoneTypeFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkTechnicien, setBulkTechnicien] = useState('')
  const [bulkAction, setBulkAction] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const lignes = useMemo(
    () => [...new Set(devices.map(d => d.area).filter(Boolean))].sort(),
    [devices]
  )
  const zoneTypesPresent = useMemo(
    () => ZONE_TYPES.filter(zt => devices.some(d => zoneTypeOf(d.area) === zt)),
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
    return devices
      .filter(d => {
        if (zoneTypeFilter && zoneTypeOf(d.area) !== zoneTypeFilter) return false
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
      .sort((a, b) => (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr'))
  }, [devices, zoneTypeFilter, ligneFilter, technicienFilter, statutFilter, search])

  const assigned = devices.filter(d => d.technicien).length
  const enZoneBancs = devices.filter(d => zoneTypeOf(d.area) === 'Zone bancs').length

  function toggleCheck(barcode) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(barcode)) next.delete(barcode); else next.add(barcode)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => (prev.size === filtered.length ? new Set() : new Set(filtered.map(d => d.barcode))))
  }

  async function applyBulk() {
    if (selected.size === 0) return
    setBulkSaving(true)
    try {
      const fields = {}
      if (bulkTechnicien) fields.technicien = bulkTechnicien
      if (bulkAction) fields.action = bulkAction
      if (Object.keys(fields).length === 0) { alert('Choisissez un technicien et/ou une action à appliquer.'); return }
      for (const barcode of selected) {
        await saveAssignment(barcode, fields)
      }
      setSelected(new Set())
      setBulkTechnicien('')
      setBulkAction('')
    } catch (e) {
      alert("Échec de l'affectation groupée : " + e.message)
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Planification</h2>
        <p className="page-subtitle">Unités en cours sur les lignes de test et de réparation</p>
      </div>

      <div className="page-body">
        <div className="stats-grid stats-grid-compact">
          <div className="stat-card stat-card-compact">
            <div className="stat-label">Unités</div>
            <div className="stat-value">{devices.length}</div>
          </div>
          <div className="stat-card stat-card-compact">
            <div className="stat-label">En zone bancs</div>
            <div className="stat-value">{enZoneBancs}</div>
          </div>
          <div className="stat-card stat-card-compact">
            <div className="stat-label">Affectées</div>
            <div className="stat-value">{assigned}</div>
          </div>
          <div className="stat-card stat-card-compact">
            <div className="stat-label">Lignes actives</div>
            <div className="stat-value">{lignes.length}</div>
          </div>
          <div className="stat-card stat-card-compact">
            <div className="stat-label">Techniciens</div>
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
                  placeholder="Rechercher…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="form-input" value={zoneTypeFilter} onChange={e => { setZoneTypeFilter(e.target.value); setLigneFilter('') }}>
                <option value="">Tous les types de zone</option>
                {zoneTypesPresent.map(zt => <option key={zt} value={zt}>{zt}</option>)}
              </select>
              <select className="form-input" value={ligneFilter} onChange={e => setLigneFilter(e.target.value)}>
                <option value="">Toutes les lignes</option>
                {lignes
                  .filter(l => !zoneTypeFilter || zoneTypeOf(l) === zoneTypeFilter)
                  .map(l => <option key={l} value={l}>{l}</option>)}
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

          {selected.size > 0 && (
            <div className="bulk-toolbar">
              <span className="text-sm font-bold">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</span>
              <select className="form-input" value={bulkTechnicien} onChange={e => setBulkTechnicien(e.target.value)}>
                <option value="">Affecter à…</option>
                {technicienNames.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" value={bulkAction} onChange={e => setBulkAction(e.target.value)}>
                <option value="">Action…</option>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button className="btn btn-primary" onClick={applyBulk} disabled={bulkSaving}>
                {bulkSaving ? 'Application…' : 'Appliquer'}
              </button>
              <button className="btn" onClick={() => setSelected(new Set())}>Annuler la sélection</button>
            </div>
          )}

          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">Aucune unité trouvée</div>
                <div className="empty-state-sub">Ajuste les filtres, ou vérifie que la fonction serveur est bien configurée.</div>
              </div>
            )}
            {!error && !loading && filtered.length > 0 && (
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th className="td-checkbox">
                      <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleAll} />
                    </th>
                    <th>Ligne</th>
                    <th>Banc</th>
                    <th>Code-barres</th>
                    <th>Type</th>
                    <th>Marque</th>
                    <th>Statut</th>
                    <th>Depuis</th>
                    <th>Technicien</th>
                    <th>Action</th>
                    <th>Commentaire</th>
                    <th>Comm. technicien</th>
                    <th>Anomalie / Tâche</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <EditableRow
                      key={d.barcode}
                      device={d}
                      technicienNames={technicienNames}
                      onSave={saveAssignment}
                      checked={selected.has(d.barcode)}
                      onToggleCheck={toggleCheck}
                    />
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
