import { createContext, useContext, useState } from 'react'
import { getSession, setSession, clearSession } from './auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession())

  async function signIn(userId, pin) {
    try {
      const res = await fetch('/.netlify/functions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin }),
      })
      const body = await res.json()
      if (!res.ok) return { error: body.error || 'Connexion refusée.' }
      setSession(body)
      setSessionState(body)
      return { error: null }
    } catch (e) {
      return { error: e.message }
    }
  }

  function signOut() {
    clearSession()
    setSessionState(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: false,
        signIn,
        signOut,
        role: session?.role === 'technicien' ? 'technicien' : session ? 'admin' : null,
        technicienName: session?.technicien_name || null,
        name: session?.name || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
