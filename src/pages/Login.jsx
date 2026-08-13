import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { Wrench } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/planification" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError("Identifiants incorrects, ou compte non créé pour cette application.")
    setLoading(false)
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <Wrench size={22} />
          <span>Doneo<span className="accent">.</span> Réparation</span>
        </div>
        <p className="login-sub">Planification atelier</p>

        <label className="form-label">Email</label>
        <input
          className="form-input w-full"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label className="form-label">Mot de passe</label>
        <input
          className="form-input w-full"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
