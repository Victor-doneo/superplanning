import { useMemo, useState } from 'react'
import { usePlanningData } from '../usePlanningData'
import { StatusBadge, formatSince, sinceClass } from '../TaskCard'
import { useColumnWidths, ResizableTh } from '../ResizableTable'
import DeviceModal from '../DeviceModal'
import { RefreshCw, Search, CheckCircle2, AlertTriangle, Send, Star } from 'lucide-react'

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

const COLUMNS = [
  { key: 'checkbox', label: '', width: 32 },
  { key: 'priority', label: '', width: 32 },
  { key: 'ligne', label: 'Ligne', width: 90 },
  { key: 'banc', label: 'Banc', width: 80 },
  { key: 'barcode', label: 'Code-barres', width: 100 },
  { key: 'type', label: 'Type', width: 140 },
  { key: 'marque', label: 'Marque', width: 100 },
  { key: 'statut', label: 'Statut', width: 130 },
  { key: 'depuis', label: 'Depuis', width: 70 },
  { key: 'technicien', label: 'Technicien', width: 130 },
  { key: 'action', label: 'Action', width: 130 },
  { key: 'commentaire', label: 'Commentaire', width: 150 },
  { key: 'tech_commentaire', label: 'Comm. technicien', width: 150 },
  { key: 'anomalie', label: 'Anomalie / Tâche', width: 130 },
  { key: 'validate', label: '', width: 90 },
  { key: 'saveflag', label: '', width: 24 },
]

// Valeur utilisée pour trier, par colonne. Les colonnes absentes de cette
// liste (case à cocher, boutons...) ne sont pas triables.
const SORT_ACCESSORS = {
  ligne: d => d.area || '',
  banc: d => (d.subarea === d.area ? '' : d.subarea || ''),
  barcode: d => d.barcode || '',
  type: d => d.service_sub_category_name || '',
  marque: d => d.brand_name || '',
  statut: d => d.status || '',
  depuis: d => (d.status_since ? new Date(d.status_since).getTime() : 0),
  technicien: d => d.technicien || '',
  action: d => d.action || '',
  commentaire: d => d.commentaire || '',
  tech_commentaire: d => d.tech_commentaire || '',
}

function SortIndicator({ active, dir }) {
  if (!active) return null
  return <span className="sort-indicator">{dir === 'asc' ? '▲' : '▼'}</span>
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

function EditableRow({ device, technicienNames, onSave, onValidate, checked, onToggleCheck, onOpenSummary }) {
  // On édite le BROUILLON (draft_*), invisible du technicien tant que non validé.
  const [technicien, setTechnicien] = useState(device.draft_technicien || '')
  const [action, setAction] = useState(device.draft_action || '')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
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

  async function handleValidate() {
    setValidating(true)
    try {
      await onValidate([device.barcode])
    } catch (e) {
      alert('Échec de la validation : ' + e.message)
    } finally {
      setValidating(false)
    }
  }

  return (
    <tr className={checked ? 'row-selected' : (device.pending_validation ? 'row-pending' : '')}>
      <td className="td-checkbox">
        <input type="checkbox" checked={checked} onChange={() => onToggleCheck(device.barcode)} />
      </td>
      <td className="td-checkbox">
        <button
          className={`btn-priority${device.draft_priority ? ' btn-priority-active' : ''}`}
          onClick={() => persist({ draft_technicien: technicien, draft_action: action, draft_priority: !device.draft_priority })}
          title={device.draft_priority ? 'Retirer la priorité' : 'Marquer prioritaire'}
        >
          <Star size={14} fill={device.draft_priority ? 'currentColor' : 'none'} />
        </button>
      </td>
      <td className="font-bold td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{device.area || '—'}</td>
      <td className="td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{subareaDisplay(device)}</td>
      <td className="td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{device.barcode}</td>
      <td className="td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{device.service_sub_category_name || '—'}</td>
      <td className="td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{device.brand_name || '—'}</td>
      <td className="clickable-row" onClick={() => onOpenSummary(device)}><StatusBadge statut={device.status} /></td>
      <td className={`text-sm clickable-row ${sinceClass(device.status_since)}`} onClick={() => onOpenSummary(device)}>{formatSince(device.status_since)}</td>
      <td>
        <select
          className="form-input"
          value={technicien}
          onChange={e => { setTechnicien(e.target.value); persist({ draft_technicien: e.target.value, draft_action: action }) }}
        >
          <option value="">—</option>
          {technicienNames.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td>
        <select
          className="form-input"
          value={action}
          onChange={e => { setAction(e.target.value); persist({ draft_technicien: technicien, draft_action: e.target.value }) }}
        >
          <option value="">—</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </td>
      <td className="td-truncate clickable-row comment-preview" onClick={() => onOpenSummary(device, true)}>
        {device.draft_commentaire || <span className="text-gray">Ajouter un commentaire…</span>}
      </td>
      <td className="text-sm text-gray td-truncate clickable-row" onClick={() => onOpenSummary(device)}>{device.tech_commentaire || '—'}</td>
      <td className="clickable-row" onClick={() => onOpenSummary(device)}><TacheStatusBadge device={device} /></td>
      <td>
        {device.pending_validation && (
          <button className="btn btn-validate" onClick={handleValidate} disabled={validating} title="Envoyer au technicien">
            <Send size={12} />
            {validating ? '…' : 'Valider'}
          </button>
        )}
      </td>
      <td style={{ width: 20 }}>
        {saving && <RefreshCw size={12} className="spin text-gray" />}
        {!saving && savedFlash && <span style={{ color: 'var(--green)' }}>✓</span>}
      </td>
    </tr>
  )
}

export default function Planification() {
  const { devices, technicians, loading, error, reload, saveAssignment, validateBarcodes } = usePlanningData()
  const { widths, startDrag } = useColumnWidths('doneo_planif_cols_v2', COLUMNS)

  const [search, setSearch] = useState('')
  const [ligneFilter, setLigneFilter] = useState('')
  const [zoneTypeFilter, setZoneTypeFilter] = useState('')
  const [technicienFilter, setTechnicienFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [sortConfig, setSortConfig] = useState({ key: 'ligne', dir: 'asc' })
  const [bulkTechnicien, setBulkTechnicien] = useState('')
  const [bulkAction, setBulkAction] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkValidating, setBulkValidating] = useState(false)
  const [summaryDevice, setSummaryDevice] = useState(null)
  const [summaryFocusComment, setSummaryFocusComment] = useState(false)

  function openSummary(device, focusComment = false) {
    setSummaryDevice(device)
    setSummaryFocusComment(focusComment)
  }
  const liveSummaryDevice = summaryDevice ? (devices.find(d => d.barcode === summaryDevice.barcode) || summaryDevice) : null

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
      .sort((a, b) => {
        const accessor = SORT_ACCESSORS[sortConfig.key]
        if (!accessor) return 0
        const va = accessor(a)
        const vb = accessor(b)
        let cmp
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb
        } else {
          cmp = String(va).localeCompare(String(vb), 'fr')
        }
        // Tri secondaire stable par Ligne puis Banc, pour un ordre prévisible
        if (cmp === 0 && sortConfig.key !== 'ligne') {
          cmp = (a.area || '').localeCompare(b.area || '', 'fr') || (a.subarea || '').localeCompare(b.subarea || '', 'fr')
        }
        return sortConfig.dir === 'asc' ? cmp : -cmp
      })
  }, [devices, zoneTypeFilter, ligneFilter, technicienFilter, statutFilter, search, sortConfig])

  function handleSort(key) {
    if (!SORT_ACCESSORS[key]) return
    setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const assigned = devices.filter(d => d.technicien).length
  const enZoneBancs = devices.filter(d => zoneTypeOf(d.area) === 'Zone bancs').length
  const distinctTechniciensAssignes = new Set(devices.map(d => d.technicien).filter(Boolean)).size
  const pendingCount = devices.filter(d => d.pending_validation).length

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
      if (bulkTechnicien) fields.draft_technicien = bulkTechnicien
      if (bulkAction) fields.draft_action = bulkAction
      if (Object.keys(fields).length === 0) { alert('Choisissez un technicien et/ou une action à appliquer.'); return }
      for (const barcode of selected) {
        await saveAssignment(barcode, fields)
      }
      setBulkTechnicien('')
      setBulkAction('')
    } catch (e) {
      alert("Échec de l'affectation groupée : " + e.message)
    } finally {
      setBulkSaving(false)
    }
  }

  async function validateSelection() {
    if (selected.size === 0) return
    setBulkValidating(true)
    try {
      await validateBarcodes([...selected])
      setSelected(new Set())
    } catch (e) {
      alert('Échec de la validation : ' + e.message)
    } finally {
      setBulkValidating(false)
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
            <div className="stat-value">{distinctTechniciensAssignes}</div>
          </div>
          <div className="stat-card stat-card-compact">
            <div className="stat-label">À valider</div>
            <div className="stat-value" style={{ color: pendingCount > 0 ? 'var(--orange)' : undefined }}>{pendingCount}</div>
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
              <button className="btn btn-validate" onClick={validateSelection} disabled={bulkValidating}>
                <Send size={13} />
                {bulkValidating ? 'Envoi…' : 'Valider les tâches'}
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
              <table className="table table-compact table-resizable">
                <colgroup>
                  {COLUMNS.map((c, i) => <col key={c.key} style={{ width: widths[i] }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <ResizableTh index={0} width={widths[0]} onStartDrag={startDrag} className="td-checkbox">
                      <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleAll} />
                    </ResizableTh>
                    <ResizableTh index={1} width={widths[1]} onStartDrag={startDrag} className="td-checkbox" title="Priorité" />
                    <ResizableTh index={2} width={widths[2]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('ligne')}>Ligne<SortIndicator active={sortConfig.key === 'ligne'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={3} width={widths[3]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('banc')}>Banc<SortIndicator active={sortConfig.key === 'banc'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={4} width={widths[4]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('barcode')}>Code-barres<SortIndicator active={sortConfig.key === 'barcode'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={5} width={widths[5]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('type')}>Type<SortIndicator active={sortConfig.key === 'type'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={6} width={widths[6]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('marque')}>Marque<SortIndicator active={sortConfig.key === 'marque'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={7} width={widths[7]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('statut')}>Statut<SortIndicator active={sortConfig.key === 'statut'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={8} width={widths[8]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('depuis')}>Depuis<SortIndicator active={sortConfig.key === 'depuis'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={9} width={widths[9]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('technicien')}>Technicien<SortIndicator active={sortConfig.key === 'technicien'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={10} width={widths[10]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('action')}>Action<SortIndicator active={sortConfig.key === 'action'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={11} width={widths[11]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('commentaire')}>Commentaire<SortIndicator active={sortConfig.key === 'commentaire'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={12} width={widths[12]} onStartDrag={startDrag}>
                      <span className="th-sort-label" onClick={() => handleSort('tech_commentaire')}>Comm. technicien<SortIndicator active={sortConfig.key === 'tech_commentaire'} dir={sortConfig.dir} /></span>
                    </ResizableTh>
                    <ResizableTh index={13} width={widths[13]} onStartDrag={startDrag}>Anomalie / Tâche</ResizableTh>
                    <th style={{ width: widths[14] }}></th>
                    <th style={{ width: widths[15] }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <EditableRow
                      key={d.barcode}
                      device={d}
                      technicienNames={technicienNames}
                      onSave={saveAssignment}
                      onValidate={validateBarcodes}
                      checked={selected.has(d.barcode)}
                      onToggleCheck={toggleCheck}
                      onOpenSummary={openSummary}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {liveSummaryDevice && (
        <DeviceModal
          device={liveSummaryDevice}
          technicienNames={technicienNames}
          onClose={() => setSummaryDevice(null)}
          onSave={saveAssignment}
          onValidate={validateBarcodes}
          focusComment={summaryFocusComment}
        />
      )}
    </>
  )
}
