import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { CalendarClock, Users, Menu, X, Wrench, LogOut, KeyRound, ClipboardList, UserCog, AlertTriangle } from 'lucide-react'

const navItems = [
  { to: '/planification', label: 'Planification', icon: <CalendarClock size={16} /> },
  { to: '/taches', label: 'Tâches', icon: <ClipboardList size={16} /> },
  { to: '/suivi-technicien', label: 'Suivi technicien', icon: <UserCog size={16} /> },
  { to: '/anomalies', label: 'Anomalies', icon: <AlertTriangle size={16} /> },
  { to: '/collaborateurs', label: 'Collaborateurs', icon: <Users size={16} /> },
  { to: '/acces', label: 'Accès', icon: <KeyRound size={16} /> },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const closeSidebar = () => setSidebarOpen(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={closeSidebar} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div>
            <h1><Wrench size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Doneo<span>.</span></h1>
            <p>Atelier réparation</p>
          </div>
          <button className="sidebar-close" onClick={closeSidebar}><X size={18} /></button>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Suivi atelier</span>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={handleSignOut}>
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-topbar">
          <button className="btn-menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <span className="mobile-topbar-logo">Doneo<span>.</span></span>
          <div style={{ width: 32 }} />
        </div>
        <Outlet />
      </main>
    </div>
  )
}
