import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const sess = data?.session ?? null
        const u = sess?.user ?? null
        if (mounted) {
          setSession(sess)
          setUser(u)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }
    fetchSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
    })
    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return { session, user, loading }
}
