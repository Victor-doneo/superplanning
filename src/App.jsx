import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import RequireAuth from './RequireAuth'
import Layout from './Layout.jsx'
import Login from './pages/Login.jsx'
import Planification from './pages/Planification.jsx'
import Collaborateurs from './pages/Collaborateurs.jsx'
import MesTaches from './pages/MesTaches.jsx'
import Taches from './pages/Taches.jsx'
import SuiviTechnicien from './pages/SuiviTechnicien.jsx'
import Anomalies from './pages/Anomalies.jsx'
import Pins from './pages/Pins.jsx'

function RoleHome() {
  const { role } = useAuth()
  return <Navigate to={role === 'technicien' ? '/mes-taches' : '/planification'} replace />
}

// Empêche un compte technicien d'accéder aux écrans admin (et inversement)
// en tapant l'URL à la main.
function RequireRole({ role, children }) {
  const { role: current } = useAuth()
  if (current !== role) return <Navigate to={current === 'technicien' ? '/mes-taches' : '/planification'} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route index element={<RoleHome />} />
          <Route path="/mes-taches" element={<RequireRole role="technicien"><MesTaches /></RequireRole>} />
          <Route element={<RequireRole role="admin"><Layout /></RequireRole>}>
            <Route path="/planification" element={<Planification />} />
            <Route path="/collaborateurs" element={<Collaborateurs />} />
            <Route path="/taches" element={<Taches />} />
            <Route path="/suivi-technicien" element={<SuiviTechnicien />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/acces" element={<Pins />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
