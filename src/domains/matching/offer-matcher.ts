import type { CandidateProfile } from '../candidate-space/candidate-profile-types';
import type { JobOffer } from '../job-radar/job-radar-types';
import { extractRecognizedSkills, normalizeSkill, normalizeText } from './skill-normalizer';

export type MatchVerdict = 'apply_now' | 'apply_with_tweaks' | 'stretch';

export interface ScoreBreakdown {
  skills: number;
  roleAlignment: number;
  seniority: number;
  locationAndMode: number;
  language: number;
}

export interface OfferMatchAnalysis {
  offer: JobOffer;
  score: number;
  verdict: MatchVerdict;
  verdictLabel: string;
  breakdown: ScoreBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  highlightsToEmphasize: string[];
  gapAdvice: string[];
}

const ROLE_SYNONYMS: Record<string, string[]> = {
  developpeur: ['developer', 'engineer', 'software', 'web', 'frontend', 'backend', 'fullstack', 'informatique', 'informaticien'],
  developer: ['developpeur', 'engineer', 'software', 'web', 'frontend', 'backend', 'fullstack', 'informatique'],
  fullstack: ['full', 'stack', 'frontend', 'backend', 'web', 'react', 'node', 'software', 'engineer', 'developer'],
  data: ['analytics', 'analyst', 'scientist', 'machine', 'learning', 'python', 'sql', 'bi', 'engineer'],
  engineer: ['ingenieur', 'developer', 'developpeur', 'software', 'backend', 'frontend', 'fullstack', 'devops'],
  ingenieur: ['engineer', 'developer', 'developpeur', 'architecte', 'informatique', 'logiciel'],
  mobile: ['flutter', 'android', 'ios', 'kotlin', 'swift', 'react'],
  comptable: ['comptabilite', 'finance', 'audit', 'gestion', 'controleur'],
  commercial: ['vente', 'sales', 'business', 'account', 'client'],
};

function tokenizeSignificantWords(text: string): string[] {
  const stopWords = new Set([
    'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'pour', 'avec', 'un', 'une',
    'the', 'and', 'for', 'with', 'h/f', 'f/h', 'cdi', 'cdd', 'poste', 'senior', 'junior',
  ]);
  return normalizeText(text)
    .split(/[^a-z0-9+]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function expandRoleTerms(words: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const word of words) {
    expanded.add(word);
    for (const syn of ROLE_SYNONYMS[word] ?? []) expanded.add(syn);
  }
  return expanded;
}

function computeRoleScore(profile: CandidateProfile, offer: JobOffer): number {
  const baseWords = tokenizeSignificantWords(
    `${profile.headline} ${profile.targetRoles.join(' ')} ${profile.skills.slice(0, 6).join(' ')}`,
  );
  const profileTerms = expandRoleTerms(baseWords);
  const offerTerms = tokenizeSignificantWords(offer.title);
  if (profileTerms.size === 0 || offerTerms.length === 0) return 20;

  const hits = offerTerms.filter((term) => profileTerms.has(term)).length;
  if (hits === 0) return 15;
  const ratio = hits / Math.min(offerTerms.length, 3);
  return Math.round(Math.min(100, 48 + ratio * 52));
}

function computeSeniorityScore(years: number, experienceLabel: string): number {
  const lower = experienceLabel.toLowerCase();
  if (/senior|lead|staff|principal|5\s*ans|10\s*ans/.test(lower)) {
    return years >= 5 ? 95 : years >= 3 ? 72 : 45;
  }
  if (/junior|stage|intern|debutant|assistant/.test(normalizeText(lower))) {
    return years <= 3 ? 95 : 80;
  }
  return years >= 2 ? 88 : 70;
}

function computeLocationScore(profile: CandidateProfile, offer: JobOffer): number {
  if (offer.workMode === 'remote') {
    return profile.preferredWorkMode === 'onsite' ? 72 : 98;
  }

  const userLoc = normalizeText(profile.location);
  const offerLoc = normalizeText(offer.location);
  const sameCountryOrCity =
    (userLoc.includes('abidjan') && (offerLoc.includes('abidjan') || offerLoc.includes('ivoire'))) ||
    (userLoc.includes('ivoire') && offerLoc.includes('ivoire')) ||
    (userLoc.length > 3 && offerLoc.includes(userLoc.split(',')[0]));

  if (sameCountryOrCity) return 96;
  if (profile.preferredWorkMode === 'remote') return 35;
  return 55;
}

function computeLanguageScore(profile: CandidateProfile, offer: JobOffer): number {
  const langs = profile.languages.map((l) => normalizeText(l));
  if (offer.language === 'fr') {
    return langs.some((l) => l.includes('fran') || l.includes('french')) ? 100 : 45;
  }
  return langs.some((l) => l.includes('ang') || l.includes('eng')) ? 96 : 45;
}

function selectProfileHighlights(
  profile: CandidateProfile,
  offer: JobOffer,
  matchedSkills: string[],
  roleScore: number,
): string[] {
  if (matchedSkills.length === 0 && roleScore < 45) {
    return [
      `Cette offre sort de votre cœur de métier (« ${profile.headline} ») : ne postulez que si vous ciblez une reconversion.`,
    ];
  }

  const offerWords = expandRoleTerms(
    tokenizeSignificantWords(`${offer.title} ${offer.summary} ${offer.skills.join(' ')}`),
  );
  const scoredHighlights = profile.highlights
    .map((item) => {
      const words = tokenizeSignificantWords(item);
      const overlap = words.filter((w) => offerWords.has(w)).length;
      return { item, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  const recommendations: string[] = [];
  if (matchedSkills.length > 0) {
    recommendations.push(
      `Placez en tête de CV vos réalisations chiffrées sur : ${matchedSkills.slice(0, 5).join(', ')}.`,
    );
  }
  for (const entry of scoredHighlights.slice(0, 2)) {
    recommendations.push(`Valorisez cette preuve concrète : « ${entry.item} ».`);
  }
  if (offer.workMode === 'remote') {
    recommendations.push('Mettez en avant votre autonomie en remote, votre documentation et vos livraisons asynchrones.');
  }
  return recommendations.slice(0, 4);
}

function buildGapAdvice(missingSkills: string[], offer: JobOffer, score: number): string[] {
  const advice: string[] = [];
  if (missingSkills.length > 0) {
    advice.push(
      `Compétences citées dans l’annonce mais absentes de votre profil : ${missingSkills.slice(0, 4).join(', ')}.`,
    );
  }
  if (offer.language === 'en') {
    advice.push('Préparez un CV et un court message d’accroche en anglais professionnel.');
  }
  if (score < 72 && advice.length < 2) {
    advice.push(`Ajustez l’intitulé de votre CV pour coller au poste (« ${offer.title} »).`);
  }
  return advice;
}

/**
 * Pure deterministic Stage-1 matching engine scoring a live job offer against a candidate profile.
 */
export function scoreOfferForProfile(
  offer: JobOffer,
  profile: CandidateProfile,
): OfferMatchAnalysis {
  const profileSkillsMap = new Map<string, string>();
  for (const s of profile.skills) {
    profileSkillsMap.set(normalizeSkill(s), s);
  }

  const offerSkillPool = Array.from(
    new Set([
      ...offer.skills.map(normalizeSkill),
      ...extractRecognizedSkills(`${offer.title} ${offer.summary}`),
    ]),
  ).filter((s) => s.length >= 2);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of offerSkillPool) {
    if (profileSkillsMap.has(skill)) {
      matchedSkills.push(profileSkillsMap.get(skill)!);
    } else {
      missingSkills.push(skill);
    }
  }

  const roleAlignment = computeRoleScore(profile, offer);
  const skillsScore =
    offerSkillPool.length === 0
      ? Math.min(45, roleAlignment)
      : Math.round(
          Math.min(100, (matchedSkills.length / Math.min(offerSkillPool.length, 4)) * 100),
        );

  const breakdown: ScoreBreakdown = {
    skills: skillsScore,
    roleAlignment,
    seniority: computeSeniorityScore(profile.yearsExperience, offer.experienceLevel),
    locationAndMode: computeLocationScore(profile, offer),
    language: computeLanguageScore(profile, offer),
  };

  let score = Math.round(
    breakdown.skills * 0.44 +
      breakdown.roleAlignment * 0.32 +
      breakdown.locationAndMode * 0.11 +
      breakdown.seniority * 0.07 +
      breakdown.language * 0.06,
  );

  // Prevent irrelevant offers with zero domain & skill overlap from inflating via location/language
  if (matchedSkills.length === 0 && roleAlignment < 40) {
    score = Math.min(score, 34);
  }

  const verdict: MatchVerdict =
    score >= 72 ? 'apply_now' : score >= 50 ? 'apply_with_tweaks' : 'stretch';

  const verdictLabel =
    verdict === 'apply_now'
      ? 'Postuler maintenant'
      : verdict === 'apply_with_tweaks'
        ? 'Postuler avec ajustements'
        : 'Hors cible prioritaire';

  return {
    offer,
    score,
    verdict,
    verdictLabel,
    breakdown,
    matchedSkills: matchedSkills.slice(0, 8),
    missingSkills: missingSkills.slice(0, 8),
    highlightsToEmphasize: selectProfileHighlights(profile, offer, matchedSkills, roleAlignment),
    gapAdvice: buildGapAdvice(missingSkills, offer, score),
  };
}
