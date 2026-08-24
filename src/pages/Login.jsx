import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { Wrench } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const [people, setPeople] = useState([])
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/.netlify/functions/people')
      .then(res => res.json())
      .then(body => setPeople(body.people || []))
      .catch(() => setError('Impossible de charger la liste des personnes.'))
      .finally(() => setLoadingPeople(false))
  }, [])

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId) { setError('Choisissez votre nom.'); return }
    if (!/^\d{4}$/.test(pin)) { setError('Le code PIN doit contenir 4 chiffres.'); return }
    setLoading(true)
    setError(null)
    const { error } = await signIn(userId, pin)
    if (error) setError(error)
    setLoading(false)
  }

  function pressDigit(d) {
    if (pin.length < 4) setPin(pin + d)
  }
  function backspace() {
    setPin(pin.slice(0, -1))
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <Wrench size={22} />
          <span>Doneo<span className="accent">.</span> Réparation</span>
        </div>
        <p className="login-sub">Planification atelier</p>

        <label className="form-label">Votre nom</label>
        <select
          className="form-input w-full"
          value={userId}
          onChange={e => { setUserId(e.target.value); setError(null) }}
          disabled={loadingPeople}
          autoFocus
        >
          <option value="">{loadingPeople ? 'Chargement…' : '— Choisir —'}</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label className="form-label">Code PIN (4 chiffres)</label>
        <input
          className="form-input w-full pin-display"
          value={pin}
          readOnly
          placeholder="••••"
        />

        <div className="pin-pad">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button type="button" key={d} className="pin-key" onClick={() => pressDigit(d)}>{d}</button>
          ))}
          <button type="button" className="pin-key pin-key-muted" onClick={backspace}>←</button>
          <button type="button" className="pin-key" onClick={() => pressDigit('0')}>0</button>
          <div />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
