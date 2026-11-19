function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

function getEnv(name: string): string | undefined {
  return process.env[name]
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  let body: { companyId?: string; licenseType?: string; expiryDate?: number }
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { companyId, licenseType, expiryDate } = body

  if (!companyId || !licenseType || !expiryDate) {
    return json(400, { error: 'Missing companyId, licenseType, or expiryDate' })
  }

  const now = Date.now()
  const isExpired = expiryDate < now
  const daysRemaining = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)))

  // Server-side validation — cannot be bypassed by client clock manipulation
  return json(200, {
    valid: !isExpired,
    isExpired,
    daysRemaining,
    licenseType,
    serverTime: now,
  })
}
