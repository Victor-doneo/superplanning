// Gestion légère du jeton de session (PIN), sans Supabase Auth.
const STORAGE_KEY = 'doneo_session'

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token) return null
    return parsed
  } catch {
    return null
  }
}

export function setSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

// Petit utilitaire pour tous les appels aux fonctions serveur authentifiées.
export async function authedFetch(path, options = {}) {
  const session = getSession()
  if (!session?.token) throw new Error('Session expirée, merci de vous reconnecter.')
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    clearSession()
    window.location.href = '/login'
    throw new Error('Session expirée, merci de vous reconnecter.')
  }
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`)
  return body
}
