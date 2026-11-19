import type { JobMarket } from '../job-radar/job-radar-types';

export type PreferredWorkMode = 'any' | 'remote' | 'hybrid' | 'onsite';

export type ApplicationStage = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface CandidateProfile {
  fullName: string;
  headline: string;
  targetRoles: string[];
  location: string;
  preferredMarket: 'all' | JobMarket;
  preferredWorkMode: PreferredWorkMode;
  yearsExperience: number;
  skills: string[];
  highlights: string[];
  languages: string[];
  rawCvText: string;
  updatedAt: string;
}

export interface TrackedApplication {
  offerId: string;
  offerTitle: string;
  company: string;
  sourceLabel: string;
  offerUrl: string;
  location: string;
  matchScore: number;
  stage: ApplicationStage;
  notes: string;
  updatedAt: string;
}

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  fullName: '',
  headline: 'Développeur Fullstack & Data Engineer',
  targetRoles: ['Développeur Fullstack', 'Data Engineer', 'Ingénieur Logiciel'],
  location: "Abidjan, Côte d'Ivoire",
  preferredMarket: 'all',
  preferredWorkMode: 'any',
  yearsExperience: 3,
  skills: ['TypeScript', 'React', 'Python', 'PostgreSQL', 'Node.js', 'SQL', 'Docker', 'Git'],
  highlights: [
    'Conception d’applications web & mobiles en production (React, TypeScript, Flutter)',
    'Pipelines Data & Machine Learning validés sans fuite (Python, SQL, DuckDB)',
    'Architectures API sécurisées avec PostgreSQL et politiques RLS strictes',
  ],
  languages: ['Français', 'Anglais'],
  rawCvText: '',
  updatedAt: new Date().toISOString(),
};
