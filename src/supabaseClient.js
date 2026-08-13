import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Doneo] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. ' +
    'Crée un fichier .env (voir .env.example) avec les identifiants de ton projet Supabase.'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
