import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Doneo] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. ' +
    'Crée un fichier .env (voir .env.example).'
  )
}

// Ce client sert UNIQUEMENT à l'authentification (supabase.auth.*).
// Il n'est jamais utilisé pour lire des tables directement depuis le
// navigateur — toutes les lectures de données passent par la fonction
// serveur /.netlify/functions/planning (clé service_role, jamais exposée ici).
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
