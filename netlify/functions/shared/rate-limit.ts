/**
 * Simple in-memory rate limiter for Netlify Functions.
 * Uses a sliding window approach per IP address.
 * Note: Each function instance has its own memory, so this provides
 * per-instance rate limiting. For stricter limits, use a shared store (Redis/KV).
 */

const requestCounts = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of requestCounts) {
    if (entry.resetAt < now) {
      requestCounts.delete(key)
    }
  }
}

export function checkRateLimit(
  ip: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup()

  const now = Date.now()
  const key = ip
  const entry = requestCounts.get(key)

  if (!entry || entry.resetAt < now) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

export function rateLimitResponse(resetAt: number) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
    },
    body: JSON.stringify({
      error: 'Too many requests. Please try again later.',
    }),
  }
}

export function getClientIp(event: any): string {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    event.headers['x-real-ip'] ||
    'unknown'
  )
}
