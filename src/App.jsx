import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import RequireAuth from './RequireAuth'
import Layout from './Layout.jsx'
import Login from './pages/Login.jsx'
import Planification from './pages/Planification.jsx'
import Collaborateurs from './pages/Collaborateurs.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/planification" replace />} />
            <Route path="/planification" element={<Planification />} />
            <Route path="/collaborateurs" element={<Collaborateurs />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
