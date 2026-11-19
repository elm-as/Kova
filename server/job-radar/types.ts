export type JobMarket = 'ci_africa' | 'tech_remote';

export type JobWorkMode = 'remote' | 'hybrid' | 'onsite';

export type JobSourceId = 'emploi_ci' | 'educarriere' | 'remotive' | 'arbeitnow' | 'jobicy';

export interface JobOffer {
  id: string;
  source: JobSourceId;
  sourceLabel: string;
  market: JobMarket;
  title: string;
  company: string;
  location: string;
  workMode: JobWorkMode;
  contractType: string;
  experienceLevel: string;
  salary: string | null;
  skills: string[];
  summary: string;
  url: string;
  publishedAt: string;
  language: 'fr' | 'en';
}

export interface SourceHealth {
  source: JobSourceId;
  label: string;
  market: JobMarket;
  status: 'ok' | 'degraded';
  count: number;
  latencyMs: number;
  error?: string;
}

export interface JobRadarQuery {
  market?: 'all' | JobMarket;
  query?: string;
  refresh?: boolean;
}

export interface JobRadarResponse {
  offers: JobOffer[];
  sources: SourceHealth[];
  cachedAt: string;
  totalBeforeFilter: number;
}
