import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { usePlanningData } from '../usePlanningData'
import { RefreshCw, Trash2, UserPlus } from 'lucide-react'

async function authedFetch(path, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Session expirée, merci de vous reconnecter.')
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`)
  return body
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function Acces() {
  const { technicians } = usePlanningData()
  const technicienNames = useMemo(
    () => [...new Set(technicians.map(t => t.name).filter(Boolean))].sort(),
    [technicians]
  )

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(genPassword())
  const [role, setRole] = useState('technicien')
  const [technicienName, setTechnicienName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [justCreated, setJustCreated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await authedFetch('/.netlify/functions/manage-users')
      setUsers(body.users || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setJustCreated(null)
    try {
      await authedFetch('/.netlify/functions/manage-users', {
        method: 'POST',
        body: JSON.stringify({ email, password, role, technicien_name: role === 'technicien' ? technicienName : null }),
      })
      setJustCreated({ email, password })
      setEmail('')
      setPassword(genPassword())
      setTechnicienName('')
      load()
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Supprimer le compte ${u.email} ?`)) return
    try {
      await authedFetch('/.netlify/functions/manage-users', { method: 'DELETE', body: JSON.stringify({ id: u.id }) })
      load()
    } catch (e) {
      alert('Échec : ' + e.message)
    }
  }

  async function handleRoleChange(u, newRole, newTechnicienName) {
    try {
      await authedFetch('/.netlify/functions/manage-users', {
        method: 'PATCH',
        body: JSON.stringify({ id: u.id, role: newRole, technicien_name: newTechnicienName }),
      })
      load()
    } catch (e) {
      alert('Échec : ' + e.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Accès</h2>
        <p className="page-subtitle">Créer et gérer les comptes de connexion (admin / technicien)</p>
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title"><UserPlus size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Créer un compte</span>
          </div>
          <form onSubmit={handleCreate} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input w-full" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@doneo.co" />
            </div>
            <div>
              <label className="form-label">Mot de passe</label>
              <div className="flex gap-2 items-center">
                <input className="form-input w-full" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="btn" onClick={() => setPassword(genPassword())}>Générer</button>
              </div>
            </div>
            <div>
              <label className="form-label">Rôle</label>
              <select className="form-input w-full" value={role} onChange={e => setRole(e.target.value)}>
                <option value="technicien">Technicien (voit uniquement ses appareils)</option>
                <option value="admin">Admin (accès complet)</option>
              </select>
            </div>
            {role === 'technicien' && (
              <div>
                <label className="form-label">Nom du technicien (doit correspondre à users.name)</label>
                <select className="form-input w-full" required value={technicienName} onChange={e => setTechnicienName(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {technicienNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            {createError && <div className="login-error">{createError}</div>}
            {justCreated && (
              <div className="login-error" style={{ background: 'var(--green-light)', color: '#065f46' }}>
                Compte créé : <b>{justCreated.email}</b> / mot de passe : <b>{justCreated.password}</b><br />
                Transmettez-le à la personne concernée — il ne sera plus affiché ensuite.
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Comptes existants ({users.length})</span>
            <button className="btn btn-icon" onClick={load} title="Rafraîchir">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Technicien</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="font-bold">{u.email}</td>
                      <td>
                        <select
                          className="form-input"
                          value={u.role}
                          onChange={e => handleRoleChange(u, e.target.value, u.technicien_name)}
                        >
                          <option value="admin">Admin</option>
                          <option value="technicien">Technicien</option>
                        </select>
                      </td>
                      <td>
                        {u.role === 'technicien' ? (
                          <select
                            className="form-input"
                            value={u.technicien_name || ''}
                            onChange={e => handleRoleChange(u, 'technicien', e.target.value)}
                          >
                            <option value="">—</option>
                            {technicienNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        ) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-icon" onClick={() => handleDelete(u)} title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
