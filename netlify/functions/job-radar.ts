import { aggregateJobRadar } from '../../server/job-radar/aggregator';
import type { JobMarket } from '../../server/job-radar/types';
import { checkRateLimit, getClientIp, rateLimitResponse } from './shared/rate-limit';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const rl = checkRateLimit(getClientIp(event), 30, 60_000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetAt);
  }

  const qs = event.queryStringParameters ?? {};
  const rawMarket = String(qs.market || 'all');
  const market: 'all' | JobMarket =
    rawMarket === 'ci_africa' || rawMarket === 'tech_remote' ? rawMarket : 'all';
  const query = typeof qs.q === 'string' ? qs.q.slice(0, 120) : '';
  const refresh = qs.refresh === '1' || qs.refresh === 'true';

  try {
    const data = await aggregateJobRadar({ market, query, refresh });
    return json(200, data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Job Radar aggregation failed';
    return json(500, { error: message });
  }
};
