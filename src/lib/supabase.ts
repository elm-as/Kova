import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && isValidHttpUrl(supabaseUrl)
)

let _supabase: SupabaseClient | null = null

if (isSupabaseConfigured) {
  try {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  } catch (error) {
    console.error('[Supabase] Échec de l\'initialisation:', error)
    _supabase = null
  }
}

export const supabase = _supabase

type SupabaseConnectionStatus = {
  ok: boolean
  error?: string
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!supabase) {
    return {
      ok: false,
      error: 'Variables VITE_SUPABASE_URL et/ou VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY manquantes.',
    }
  }

  const { error } = await supabase
    .from('kv_store')
    .select('key', { count: 'exact', head: true })
    .limit(1)

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return { ok: true }
}