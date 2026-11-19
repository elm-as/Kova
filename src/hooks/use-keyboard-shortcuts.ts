import { useEffect } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const s of shortcuts) {
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey
        if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          s.handler()
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export function formatShortcut(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  parts.push(shortcut.key.toUpperCase())
  return parts.join('+')
}
