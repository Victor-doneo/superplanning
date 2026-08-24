import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function usePlanningData() {
  const [devices, setDevices] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Session expirée, merci de vous reconnecter.')
        setLoading(false)
        return
      }
      const res = await fetch('/.netlify/functions/planning', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`)
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
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Session expirée, merci de vous reconnecter.')

    const res = await fetch('/.netlify/functions/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ barcode, ...fields }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`)

    // Mise à jour optimiste locale, sans tout recharger
    setDevices(prev => prev.map(d => (d.barcode === barcode ? { ...d, ...fields } : d)))
  }, [])

  return { devices, technicians, loading, error, reload: load, saveAssignment }
}
