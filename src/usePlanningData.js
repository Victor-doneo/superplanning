import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from './auth'

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
    setDevices(prev => prev.map(d => (d.barcode === barcode ? { ...d, ...fields } : d)))
  }, [])

  return { devices, technicians, loading, error, reload: load, saveAssignment }
}
