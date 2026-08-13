import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './Layout.jsx'
import Planification from './pages/Planification.jsx'
import Collaborateurs from './pages/Collaborateurs.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/planification" replace />} />
        <Route path="/planification" element={<Planification />} />
        <Route path="/collaborateurs" element={<Collaborateurs />} />
      </Route>
    </Routes>
  )
}
