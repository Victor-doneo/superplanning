import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from '../auth'
import { RefreshCw, KeyRound, Trash2 } from 'lucide-react'

function genPin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function PersonRow({ person, onSet, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [pin, setPin] = useState(genPin())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSet(person.id, pin)
      setEditing(false)
    } catch (e) {
      alert('Échec : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td className="font-bold">{person.name}</td>
      <td>{person.role === 'admin' ? 'Admin' : 'Technicien'}</td>
      <td>
        {person.locked ? (
          <span className="badge badge-red">Verrouillé</span>
        ) : person.has_pin ? (
          <span className="badge badge-green">PIN défini</span>
        ) : (
          <span className="badge badge-gray">Aucun PIN</span>
        )}
      </td>
      <td>
        {!editing ? (
          <button className="btn" onClick={() => { setPin(genPin()); setEditing(true) }}>
            <KeyRound size={13} style={{ marginRight: 4 }} />
            {person.has_pin ? 'Réinitialiser' : 'Définir'} le PIN
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              className="form-input"
              style={{ width: 90, textAlign: 'center', letterSpacing: 4, fontWeight: 700 }}
              value={pin}
              maxLength={4}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || pin.length !== 4}>
              {saving ? '…' : 'Valider'}
            </button>
            <button className="btn" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        )}
      </td>
      <td>
        {person.has_pin && (
          <button className="btn btn-icon" title="Supprimer le PIN (bloque la connexion)" onClick={() => onDelete(person.id)}>
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}

export default function Pins() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await authedFetch('/.netlify/functions/pins')
      setPeople(body.people || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSet(user_id, pin) {
    await authedFetch('/.netlify/functions/pins', { method: 'POST', body: JSON.stringify({ user_id, pin }) })
    load()
  }

  async function handleDelete(user_id) {
    if (!confirm('Supprimer ce PIN ? La personne ne pourra plus se connecter tant que vous ne lui en redéfinissez pas un.')) return
    await authedFetch('/.netlify/functions/pins', { method: 'DELETE', body: JSON.stringify({ user_id }) })
    load()
  }

  return (
    <>
      <div className="page-header">
        <h2 className="page-title">Accès</h2>
        <p className="page-subtitle">Codes PIN de connexion — basé sur les rôles déjà présents dans votre table users</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Personnes ({people.length})</span>
            <button className="btn btn-icon" onClick={load} title="Rafraîchir">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
          <div className="table-wrapper">
            {error && <div className="empty-state"><div className="empty-state-title">Erreur</div><div className="empty-state-sub">{error}</div></div>}
            {!error && loading && <div className="loading-state">Chargement…</div>}
            {!error && !loading && people.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">Personne trouvée</div>
                <div className="empty-state-sub">Aucun compte avec le rôle "Réparation" ou "Admin réparation" dans votre table users.</div>
              </div>
            )}
            {!error && !loading && people.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map(p => (
                    <PersonRow key={p.id} person={p} onSet={handleSet} onDelete={handleDelete} />
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
