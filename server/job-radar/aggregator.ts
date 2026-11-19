import type { JobMarket, JobOffer, JobRadarQuery, JobRadarResponse, JobSourceId, SourceHealth } from './types';
import { buildOfferFingerprint } from './text-cleaner';
import { fetchEducarriereOffers, fetchEmploiCiOffers } from './parsers-ivory-coast';
import { fetchArbeitnowOffers, fetchJobicyOffers, fetchRemotiveOffers } from './parsers-remote';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  cachedAt: string;
  offers: JobOffer[];
  sources: SourceHealth[];
}

const radarCache = new Map<string, CacheEntry>();

interface SourceRunner {
  source: JobSourceId;
  label: string;
  market: JobMarket;
  run: (query?: string) => Promise<JobOffer[]>;
}

const SOURCE_RUNNERS: SourceRunner[] = [
  { source: 'emploi_ci', label: 'Emploi.ci', market: 'ci_africa', run: fetchEmploiCiOffers },
  { source: 'educarriere', label: 'Educarriere.ci', market: 'ci_africa', run: fetchEducarriereOffers },
  { source: 'remotive', label: 'Remotive', market: 'tech_remote', run: fetchRemotiveOffers },
  { source: 'arbeitnow', label: 'Arbeitnow', market: 'tech_remote', run: fetchArbeitnowOffers },
  { source: 'jobicy', label: 'Jobicy', market: 'tech_remote', run: fetchJobicyOffers },
];

function deduplicateOffers(offers: JobOffer[]): JobOffer[] {
  const seen = new Set<string>();
  const unique: JobOffer[] = [];
  for (const offer of offers) {
    const key = buildOfferFingerprint(offer.title, offer.company, offer.source);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(offer);
  }
  return unique;
}

function matchesSearchQuery(offer: JobOffer, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return true;
  const haystack = `${offer.title} ${offer.company} ${offer.location} ${offer.summary} ${offer.skills.join(' ')}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

async function runSource(runner: SourceRunner, query?: string): Promise<{ offers: JobOffer[]; health: SourceHealth }> {
  const started = Date.now();
  try {
    const offers = await runner.run(query);
    return {
      offers,
      health: {
        source: runner.source,
        label: runner.label,
        market: runner.market,
        status: 'ok',
        count: offers.length,
        latencyMs: Date.now() - started,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur source distante';
    return {
      offers: [],
      health: {
        source: runner.source,
        label: runner.label,
        market: runner.market,
        status: 'degraded',
        count: 0,
        latencyMs: Date.now() - started,
        error: message,
      },
    };
  }
}

/**
 * Aggregates live offers across Ivory Coast / Francophone Africa and Global Tech Remote sources
 * with parallel execution, TTL caching, and deterministic deduplication.
 */
export async function aggregateJobRadar(params: JobRadarQuery = {}): Promise<JobRadarResponse> {
  const market = params.market ?? 'all';
  const query = (params.query ?? '').trim();
  const cacheKey = `${market}:${query.toLowerCase()}`;
  const existing = radarCache.get(cacheKey);

  if (!params.refresh && existing && existing.expiresAt > Date.now()) {
    const filtered = query ? existing.offers.filter((o) => matchesSearchQuery(o, query)) : existing.offers;
    return {
      offers: filtered,
      sources: existing.sources,
      cachedAt: existing.cachedAt,
      totalBeforeFilter: existing.offers.length,
    };
  }

  const runners = market === 'all' ? SOURCE_RUNNERS : SOURCE_RUNNERS.filter((r) => r.market === market);
  const results = await Promise.all(runners.map((runner) => runSource(runner, query || undefined)));

  const mergedOffers = deduplicateOffers(results.flatMap((r) => r.offers)).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  const sources = results.map((r) => r.health);
  const cachedAt = new Date().toISOString();

  radarCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    cachedAt,
    offers: mergedOffers,
    sources,
  });

  const filtered = query ? mergedOffers.filter((o) => matchesSearchQuery(o, query)) : mergedOffers;
  return {
    offers: filtered,
    sources,
    cachedAt,
    totalBeforeFilter: mergedOffers.length,
  };
}
