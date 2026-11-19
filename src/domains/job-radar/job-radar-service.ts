import type { JobMarket, JobRadarResponse } from './job-radar-types';

export interface FetchRadarOptions {
  market: 'all' | JobMarket;
  query?: string;
  refresh?: boolean;
}

/**
 * Fetches live aggregated job offers from Kova's /api/job-radar endpoint.
 */
export async function fetchJobRadarOffers(
  options: FetchRadarOptions,
  signal?: AbortSignal,
): Promise<JobRadarResponse> {
  const params = new URLSearchParams();
  params.set('market', options.market);
  if (options.query?.trim()) params.set('q', options.query.trim());
  if (options.refresh) params.set('refresh', '1');

  const response = await fetch(`/api/job-radar?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Impossible de charger le radar (${response.status})${details ? `: ${details.slice(0, 120)}` : ''}`);
  }

  return (await response.json()) as JobRadarResponse;
}
