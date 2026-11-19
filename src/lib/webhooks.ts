import { WebhookSubscription, WebhookEventType } from './types'

const STORAGE_KEY = 'webhook_subscriptions'

function getSubscriptions(): WebhookSubscription[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveSubscriptions(subs: WebhookSubscription[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
}

export function getWebhooksByCompany(companyId: string): WebhookSubscription[] {
  return getSubscriptions().filter(s => s.companyId === companyId)
}

export function addWebhook(
  companyId: string,
  url: string,
  events: WebhookEventType[],
): WebhookSubscription {
  const subs = getSubscriptions()
  const secret = crypto.randomUUID()
  const sub: WebhookSubscription = {
    id: crypto.randomUUID(),
    companyId,
    url,
    events,
    secret,
    active: true,
    createdAt: Date.now(),
    failCount: 0,
  }
  subs.push(sub)
  saveSubscriptions(subs)
  return sub
}

export function removeWebhook(id: string): void {
  const subs = getSubscriptions().filter(s => s.id !== id)
  saveSubscriptions(subs)
}

export function toggleWebhook(id: string): void {
  const subs = getSubscriptions()
  const sub = subs.find(s => s.id === id)
  if (sub) {
    sub.active = !sub.active
    saveSubscriptions(subs)
  }
}

/**
 * Dispatch a webhook event to all matching active subscriptions for a company.
 * Fires in the background — does not block the caller.
 */
export function dispatchWebhookEvent(
  companyId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): void {
  const subs = getSubscriptions().filter(
    s => s.companyId === companyId && s.active && s.events.includes(eventType),
  )
  if (subs.length === 0) return

  for (const sub of subs) {
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    })

    // HMAC-SHA256 signature for verification on receiver side
    signPayload(body, sub.secret).then(signature => {
      fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        },
        body,
      })
        .then(() => {
          updateLastTriggered(sub.id)
        })
        .catch(() => {
          incrementFailCount(sub.id)
        })
    })
  }
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function updateLastTriggered(id: string): void {
  const subs = getSubscriptions()
  const sub = subs.find(s => s.id === id)
  if (sub) {
    sub.lastTriggeredAt = Date.now()
    sub.failCount = 0
    saveSubscriptions(subs)
  }
}

function incrementFailCount(id: string): void {
  const subs = getSubscriptions()
  const sub = subs.find(s => s.id === id)
  if (sub) {
    sub.failCount += 1
    // Auto-disable after 10 consecutive failures
    if (sub.failCount >= 10) sub.active = false
    saveSubscriptions(subs)
  }
}
