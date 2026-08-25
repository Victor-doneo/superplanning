import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from './auth'

function withPendingFlag(d) {
  return {
    ...d,
    pending_validation:
      (d.draft_technicien || null) !== (d.technicien || null) ||
      (d.draft_action || null) !== (d.action || null) ||
      (d.draft_commentaire || null) !== (d.commentaire || null),
  }
}

export function usePlanningData() {
  const [devices, setDevices] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await authedFetch('/.netlify/functions/planning')
      setDevices(body.devices || [])
      setTechnicians(body.technicians || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const saveAssignment = useCallback(async (barcode, fields) => {
    await authedFetch('/.netlify/functions/assign', {
      method: 'POST',
      body: JSON.stringify({ barcode, ...fields }),
    })
    setDevices(prev => prev.map(d => (d.barcode === barcode ? withPendingFlag({ ...d, ...fields }) : d)))
  }, [])

  // "Valider les tâches" : publie le brouillon d'un ou plusieurs appareils.
  const validateBarcodes = useCallback(async (barcodes) => {
    const body = await authedFetch('/.netlify/functions/validate', {
      method: 'POST',
      body: JSON.stringify({ barcodes }),
    })
    setDevices(prev => prev.map(d => {
      if (!barcodes.includes(d.barcode)) return d
      const actionOrCommentChanged =
        (d.action || null) !== (d.draft_action || null) || (d.commentaire || null) !== (d.draft_commentaire || null)
      return withPendingFlag({
        ...d,
        technicien: d.draft_technicien,
        action: d.draft_action,
        commentaire: d.draft_commentaire,
        tech_commentaire: actionOrCommentChanged ? null : d.tech_commentaire,
      })
    }))
    return body
  }, [])

  return { devices, technicians, loading, error, reload: load, saveAssignment, validateBarcodes }
}
