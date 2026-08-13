import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) return <div className="loading-state">Chargement…</div>
  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}
