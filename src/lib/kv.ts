import { useCallback, useEffect, useState } from "react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

const LOCAL_PREFIX = "local-kv:"
const REMOTE_TABLE = "kv_store"

function storageKey(key: string) {
  return `${LOCAL_PREFIX}${key}`
}

function readLocal<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined
  const raw = window.localStorage.getItem(storageKey(key))
  if (raw == null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    // Back-compat in case a value was stored as plain text.
    return raw as unknown as T
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey(key), JSON.stringify(value))
}

function deleteLocal(key: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(storageKey(key))
}

async function readRemote<T>(key: string): Promise<T | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined

  const { data, error } = await supabase
    .from(REMOTE_TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle()

  // 404 / PGRST116 means the table doesn't exist yet — treat as empty
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('404') || (error as any).status === 404) {
      return undefined
    }
    throw error
  }
  return (data?.value as T | undefined) ?? undefined
}

async function writeRemote<T>(key: string, value: T): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return

  const { error } = await supabase
    .from(REMOTE_TABLE)
    .upsert({ key, value }, { onConflict: "key" })

  // Silently ignore if table doesn't exist
  if (error && error.code !== 'PGRST116' && !(error as any).message?.includes('404')) throw error
}

async function deleteRemote(key: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return

  const { error } = await supabase.from(REMOTE_TABLE).delete().eq("key", key)
  // Silently ignore if table doesn't exist
  if (error && error.code !== 'PGRST116' && !(error as any).message?.includes('404')) throw error
}

/**
 * KV persisté.
 * - En runtime Spark: utilise le KV Spark.
 * - En dev local (et environnements sans KV Spark): fallback sur localStorage.
 */
export function useKV<T = string>(
  key: string,
  initialValue?: NoInfer<T>
): readonly [
  T | undefined,
  (newValue: T | ((oldValue?: T) => T)) => void,
  () => void,
] {
  const [value, setValue] = useState<T | undefined>(initialValue)
  const [isHydrating, setIsHydrating] = useState(true)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const localValue = readLocal<T>(key)
      if (localValue !== undefined) {
        setValue(localValue)
      } else {
        setValue(initialValue)
      }

      if (!isSupabaseConfigured || !supabase) {
        if (localValue === undefined && initialValue !== undefined) {
          writeLocal(key, initialValue as T)
        }
        if (!cancelled) setIsHydrating(false)
        return
      }

      try {
        const remoteValue = await readRemote<T>(key)

        if (remoteValue !== undefined) {
          writeLocal(key, remoteValue)
          if (!cancelled) setValue(remoteValue)
        } else if (localValue !== undefined) {
          await writeRemote(key, localValue)
        } else if (initialValue !== undefined) {
          writeLocal(key, initialValue as T)
          await writeRemote(key, initialValue as T)
        }
      } catch {
        if (localValue === undefined && initialValue !== undefined) {
          writeLocal(key, initialValue as T)
          if (!cancelled) setValue(initialValue)
        }
      } finally {
        if (!cancelled) setIsHydrating(false)
      }
    }

    hydrate()

    return () => {
      cancelled = true
    }
    // Intentionally not depending on initialValue to mimic Spark behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey(key)) return
      if (e.newValue == null) {
        setValue(undefined)
        return
      }
      try {
        setValue(JSON.parse(e.newValue) as T)
      } catch {
        setValue(e.newValue as unknown as T)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [key])

  const deleteValue = useCallback(() => {
    deleteLocal(key)
    if (isSupabaseConfigured && supabase) {
      deleteRemote(key).catch(() => undefined)
    }
    setValue(undefined)
  }, [key])

  const userSetValue = useCallback(
    (newValue: T | ((oldValue?: T) => T)) => {
      setValue((current) => {
        const next =
          typeof newValue === "function"
            ? (newValue as (oldValue?: T) => T)(current)
            : newValue
        writeLocal(key, next)
        if (isSupabaseConfigured && supabase && !isHydrating) {
          writeRemote(key, next).catch(() => undefined)
        }
        return next
      })
    },
    [isHydrating, key]
  )

  return [value, userSetValue, deleteValue] as const
}

export async function kvGet<T = unknown>(key: string): Promise<T | undefined> {
  const local = readLocal<T>(key)

  if (!isSupabaseConfigured || !supabase) {
    return local
  }

  try {
    const remote = await readRemote<T>(key)
    if (remote !== undefined) {
      writeLocal(key, remote)
      return remote
    }
    return local
  } catch {
    return local
  }
}

export async function kvSet<T = unknown>(key: string, value: T): Promise<void> {
  writeLocal(key, value)
  if (!isSupabaseConfigured || !supabase) return
  await writeRemote(key, value)
}
