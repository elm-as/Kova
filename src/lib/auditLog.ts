import { AuditLogEntry } from './types'

const STORAGE_KEY = 'audit-log'
const MAX_ENTRIES = 500

function getAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAuditLog(entries: AuditLogEntry[]) {
  // Keep only the most recent entries
  const trimmed = entries.slice(-MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function logAudit(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): void {
  const log = getAuditLog()
  log.push({
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
  })
  saveAuditLog(log)
}

export function getAuditHistory(companyId?: string, limit = 100): AuditLogEntry[] {
  const log = getAuditLog()
  const filtered = companyId ? log.filter(e => e.companyId === companyId) : log
  return filtered.slice(-limit).reverse()
}

export function clearAuditLog(): void {
  localStorage.removeItem(STORAGE_KEY)
}
