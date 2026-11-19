import type { JobOffer } from './types';
import { buildOfferFingerprint, cleanHtmlText, extractOfferSkills, summarizeText } from './text-cleaner';

const USER_AGENT = 'KovaJobRadar/1.0 (+https://elmas.solutions)';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 9_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

/**
 * Fetches live global remote tech offers from Remotive's official public JSON API.
 */
export async function fetchRemotiveOffers(query?: string): Promise<JobOffer[]> {
  const url = query?.trim()
    ? `https://remotive.com/api/remote-jobs?limit=25&search=${encodeURIComponent(query.trim())}`
    : 'https://remotive.com/api/remote-jobs?limit=25';

  const payload = await fetchJsonWithTimeout<{ jobs?: RemotiveJob[] }>(url);
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

  return jobs.slice(0, 25).map((job) => {
    const title = cleanHtmlText(job.title || '');
    const company = cleanHtmlText(job.company_name || 'Remote Company');
    const location = cleanHtmlText(job.candidate_required_location || 'Worldwide Remote');
    const summary = summarizeText(job.description || title, 260);
    const tags = Array.isArray(job.tags) ? job.tags : [];

    return {
      id: `remotive-${job.id || buildOfferFingerprint(title, company, location)}`,
      source: 'remotive',
      sourceLabel: 'Remotive',
      market: 'tech_remote',
      title,
      company,
      location,
      workMode: 'remote',
      contractType: cleanHtmlText(job.job_type || 'Full-time').replace(/_/g, ' '),
      experienceLevel: /senior|staff|lead|principal/i.test(title) ? 'Senior' : /junior|intern/i.test(title) ? 'Junior' : 'Confirmé',
      salary: job.salary?.trim() ? cleanHtmlText(job.salary) : null,
      skills: extractOfferSkills(`${title} ${summary}`, tags),
      summary,
      url: job.url,
      publishedAt: (job.publication_date || new Date().toISOString()).slice(0, 10),
      language: 'en',
    };
  });
}

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location: string;
  created_at: number;
}

/**
 * Fetches live European & Remote tech listings from Arbeitnow's official public API.
 */
export async function fetchArbeitnowOffers(): Promise<JobOffer[]> {
  const payload = await fetchJsonWithTimeout<{ data?: ArbeitnowJob[] }>('https://www.arbeitnow.com/api/job-board-api');
  const jobs = Array.isArray(payload.data) ? payload.data : [];

  return jobs
    .filter((j) => j.remote || /engineer|developer|data|product|devops|full.?stack|frontend|backend/i.test(j.title))
    .slice(0, 20)
    .map((job) => {
      const title = cleanHtmlText(job.title);
      const company = cleanHtmlText(job.company_name || 'Tech Company');
      const location = cleanHtmlText(job.location || (job.remote ? 'Remote EU' : 'Europe'));
      const summary = summarizeText(job.description || title, 260);
      const pubDate = job.created_at ? new Date(job.created_at * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

      return {
        id: `arbeitnow-${buildOfferFingerprint(title, company, location)}`,
        source: 'arbeitnow',
        sourceLabel: 'Arbeitnow',
        market: 'tech_remote',
        title,
        company,
        location,
        workMode: job.remote ? 'remote' : 'hybrid',
        contractType: job.job_types?.[0] || 'CDI / Full-time',
        experienceLevel: /senior|lead|staff/i.test(title) ? 'Senior' : /junior|working student/i.test(title) ? 'Junior' : 'Confirmé',
        salary: null,
        skills: extractOfferSkills(`${title} ${summary}`, job.tags ?? []),
        summary,
        url: job.url,
        publishedAt: pubDate,
        language: /entwickler|m\/w\/d|teilzeit/i.test(title) ? 'en' : 'en',
      };
    });
}

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  jobLevel?: string;
  jobType?: string[];
  jobIndustry?: string[];
  jobExcerpt?: string;
  pubDate?: string;
  annualSalaryMin?: string;
  annualSalaryMax?: string;
  salaryCurrency?: string;
}

/**
 * Fetches live global remote listings from Jobicy public v2 JSON API (with direct attribution).
 */
export async function fetchJobicyOffers(query?: string): Promise<JobOffer[]> {
  const url = query?.trim()
    ? `https://jobicy.com/api/v2/remote-jobs?count=18&tag=${encodeURIComponent(query.trim())}`
    : 'https://jobicy.com/api/v2/remote-jobs?count=18';

  const payload = await fetchJsonWithTimeout<{ jobs?: JobicyJob[] }>(url);
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

  return jobs.map((job) => {
    const title = cleanHtmlText(job.jobTitle || '');
    const company = cleanHtmlText(job.companyName || 'Remote Team');
    const location = cleanHtmlText(job.jobGeo || 'Anywhere');
    const summary = summarizeText(job.jobExcerpt || title, 260);
    const salary =
      job.annualSalaryMin && job.annualSalaryMax
        ? `${job.annualSalaryMin}–${job.annualSalaryMax} ${job.salaryCurrency || 'USD'}`
        : null;

    return {
      id: `jobicy-${job.id || buildOfferFingerprint(title, company, location)}`,
      source: 'jobicy',
      sourceLabel: 'Jobicy',
      market: 'tech_remote',
      title,
      company,
      location,
      workMode: 'remote',
      contractType: job.jobType?.[0] || 'Full-time',
      experienceLevel: cleanHtmlText(job.jobLevel || 'Confirmé'),
      salary,
      skills: extractOfferSkills(`${title} ${summary}`, job.jobIndustry ?? []),
      summary,
      url: job.url,
      publishedAt: (job.pubDate || new Date().toISOString()).slice(0, 10),
      language: 'en',
    };
  });
}
