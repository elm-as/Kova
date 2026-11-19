import { useEffect } from 'react'
import { useKV } from '@/lib/kv'

export type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useKV<Theme>('app-theme', 'system')

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    const currentTheme = theme || 'system'

    const applyTheme = () => {
      root.classList.remove('light', 'dark')
      if (currentTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(currentTheme)
      }
    }

    applyTheme()

    if (currentTheme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme()
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  return { theme, setTheme }
}
