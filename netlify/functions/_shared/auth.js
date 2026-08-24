// Utilitaires partagés par les fonctions serveur pour l'authentification
// par PIN (jeton signé maison, sans Supabase Auth).
//
// Variable d'environnement requise (Netlify uniquement) :
//   JWT_SECRET   (chaîne aléatoire longue, gardée secrète)

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function signToken(claims) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET manquant côté serveur.')
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '12h' })
}

export function verifyToken(event) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET manquant côté serveur.')
  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function requireAuth(event) {
  const claims = verifyToken(event)
  if (!claims) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Session invalide ou expirée, merci de vous reconnecter.' }) } }
  }
  return { claims }
}

export function requireAdmin(event) {
  const result = requireAuth(event)
  if (result.error) return result
  if (result.claims.role !== 'admin') {
    return { error: { statusCode: 403, body: JSON.stringify({ error: 'Réservé aux administrateurs.' }) } }
  }
  return result
}
