import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp, rateLimitResponse } from './shared/rate-limit';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

const SALT_ROUNDS = 12;

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // Protect bcrypt CPU budget against brute-force / DoS
  const rl = checkRateLimit(getClientIp(event), 15, 60_000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetAt);
  }

  let body: { action?: string; password?: string; hash?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { action, password, hash } = body;
  if (!action) {
    return json(400, { error: 'Missing action (hash | verify)' });
  }

  if (action === 'hash') {
    if (!password || typeof password !== 'string') {
      return json(400, { error: 'Missing password' });
    }
    if (password.length > 72) {
      return json(400, { error: 'Password too long (max 72 bytes for bcrypt)' });
    }
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    return json(200, { hash: hashed });
  }

  if (action === 'verify') {
    if (!password || !hash) {
      return json(400, { error: 'Missing password or hash' });
    }
    const match = await bcrypt.compare(password, hash);
    return json(200, { match });
  }

  return json(400, { error: `Unknown action: ${action}` });
};
