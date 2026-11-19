import type { CandidateProfile, PreferredWorkMode } from './candidate-profile-types';
import { extractRecognizedSkills } from '../matching/skill-normalizer';

export interface CvIdentityExtractionResult {
  profile: CandidateProfile;
  source: 'llm' | 'local';
}

const CITY_PATTERNS = [
  /\b(Abidjan|Bouaké|Yamoussoukro|Daloa|San-Pédro|Korhogo|Grand-Bassam|Cocody|Plateau|Marcory|Yopougon)(?:[,\s]+(?:Côte d['’]Ivoire|CI))?\b/i,
  /\b(Dakar|Sénégal|Douala|Yaoundé|Cameroun|Lomé|Togo|Cotonou|Bénin|Bamako|Mali|Ouagadougou|Burkina Faso|Casablanca|Rabat|Maroc|Tunis|Tunisie)\b/i,
  /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Bruxelles|Genève|Montréal|Québec|Londres|London|Berlin)\b/i,
];

function extractLocalLocation(text: string, fallback: string): string {
  for (const pattern of CITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = match[0].trim();
      if (/abidjan|daloa|bouak|yamoussoukro|cocody|plateau|marcory|yopougon/i.test(value) && !/ivoire/i.test(value)) {
        return `${value}, Côte d'Ivoire`;
      }
      return value;
    }
  }
  return fallback;
}

function estimateYearsFromText(text: string): number {
  const explicit = text.match(/(\d{1,2})\s*\+?\s*(ans|années|years?)\s*(d['’]exp|of exp|exp)/i);
  if (explicit) return Math.min(35, Number(explicit[1]));

  const years = [...text.matchAll(/\b(20[0-2]\d)\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 2000 && y <= new Date().getFullYear());

  if (years.length >= 2) {
    const span = Math.max(...years) - Math.min(...years);
    if (span >= 1 && span <= 30) return span;
  }
  return 2;
}

function extractLocalIdentity(cvText: string, base: CandidateProfile): CandidateProfile {
  const cleanText = cvText.replace(/\r/g, '').trim();
  const lines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const nameCandidate =
    lines.find(
      (line) =>
        line.length >= 4 &&
        line.length <= 48 &&
        !/[@\d/\\]|curriculum|resume|cv\b|profil|contact|t[ée]l|adresse/i.test(line) &&
        line.split(/\s+/).length >= 2 &&
        line.split(/\s+/).length <= 5,
    ) || base.fullName;

  const nameIdx = lines.indexOf(nameCandidate);
  const headlineCandidate =
    lines
      .slice(Math.max(0, nameIdx + 1), Math.max(0, nameIdx + 7))
      .find(
        (line) =>
          line.length >= 8 &&
          line.length <= 85 &&
          !/[@+]|http|www\.|\d{4}\s*-|abidjan|paris|dakar|contact|profil\s*$/i.test(line),
      ) || base.headline;

  const detectedSkills = extractRecognizedSkills(cleanText);
  const languages: string[] = [];
  if (/fran[çc]ais|french/i.test(cleanText)) languages.push('Français');
  if (/anglais|english/i.test(cleanText)) languages.push('Anglais');
  if (/espagnol|spanish/i.test(cleanText)) languages.push('Espagnol');
  if (/allemand|german/i.test(cleanText)) languages.push('Allemand');

  const highlights = lines
    .filter((line) => /^[-•*▪]/.test(line) || /\d+\s*(%|k€|M€|fcfa|utilisateurs|projets|clients|ans)/i.test(line))
    .map((line) => line.replace(/^[-•*▪]\s*/, '').trim())
    .filter((line) => line.length >= 22 && line.length <= 180)
    .slice(0, 5);

  const preferredWorkMode: PreferredWorkMode = /remote|t[ée]l[ée]travail|full.?remote/i.test(cleanText)
    ? 'remote'
    : /hybride|hybrid/i.test(cleanText)
      ? 'hybrid'
      : base.preferredWorkMode;

  return {
    ...base,
    fullName: nameCandidate,
    headline: headlineCandidate,
    targetRoles: [headlineCandidate],
    location: extractLocalLocation(cleanText, base.location),
    preferredWorkMode,
    yearsExperience: estimateYearsFromText(cleanText),
    skills: detectedSkills.length > 0 ? detectedSkills.slice(0, 18) : base.skills,
    highlights: highlights.length > 0 ? highlights : base.highlights,
    languages: languages.length > 0 ? languages : ['Français'],
    rawCvText: cleanText.slice(0, 12_000),
    updatedAt: new Date().toISOString(),
  };
}

interface RawLlmIdentity {
  fullName?: unknown;
  headline?: unknown;
  targetRoles?: unknown;
  location?: unknown;
  yearsExperience?: unknown;
  preferredWorkMode?: unknown;
  languages?: unknown;
  skills?: unknown;
  highlights?: unknown;
}

function toStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, maxItems);
}

/**
 * Extracts complete structured candidate identity from raw CV text using Groq /api/llm (JSON mode),
 * with deterministic local fallback if the server LLM is unavailable.
 */
export async function extractCandidateIdentityFromCv(
  cvText: string,
  baseProfile: CandidateProfile,
): Promise<CvIdentityExtractionResult> {
  const localProfile = extractLocalIdentity(cvText, baseProfile);
  const snippet = cvText.replace(/\r/g, '').trim().slice(0, 8_000);
  if (snippet.length < 30) {
    return { profile: localProfile, source: 'local' };
  }

  const prompt = [
    'Tu es un extracteur de CV strict et factuel. N’invente AUCUNE donnée absente du CV.',
    'Retourne UNIQUEMENT un objet JSON valide avec ces clés exactes :',
    '- "fullName": string (nom et prénom complets du candidat tels qu’écrits dans le CV)',
    '- "headline": string (intitulé professionnel exact ou poste principal visé, court et précis)',
    '- "targetRoles": string[] (2 à 4 intitulés de postes correspondants)',
    '- "location": string (ville et pays du candidat, ex: "Abidjan, Côte d’Ivoire")',
    '- "yearsExperience": number (entier >= 0 estimé à partir des expériences du CV)',
    '- "preferredWorkMode": "any" | "remote" | "hybrid" | "onsite"',
    '- "languages": string[] (langues parlées, ex: ["Français", "Anglais"])',
    '- "skills": string[] (8 à 16 compétences clés réelles du CV, techniques et/ou métier)',
    '- "highlights": string[] (3 à 5 réalisations ou expériences concrètes et chiffrées du CV, 1 phrase chacune)',
    '',
    'TEXTE DU CV :',
    snippet,
  ].join('\n');

  try {
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, jsonMode: true }),
    });
    if (!resp.ok) return { profile: localProfile, source: 'local' };

    const payload = (await resp.json()) as { content?: string };
    if (!payload.content) return { profile: localProfile, source: 'local' };

    const parsed = JSON.parse(payload.content) as RawLlmIdentity;
    const rawMode = String(parsed.preferredWorkMode ?? '').toLowerCase();
    const preferredWorkMode: PreferredWorkMode =
      rawMode === 'remote' || rawMode === 'hybrid' || rawMode === 'onsite' ? rawMode : 'any';

    const skills = toStringArray(parsed.skills, 18);
    const highlights = toStringArray(parsed.highlights, 6);
    const targetRoles = toStringArray(parsed.targetRoles, 4);
    const languages = toStringArray(parsed.languages, 5);
    const yearsNum = Number(parsed.yearsExperience);

    const headline =
      typeof parsed.headline === 'string' && parsed.headline.trim().length >= 3
        ? parsed.headline.trim()
        : localProfile.headline;

    return {
      source: 'llm',
      profile: {
        ...localProfile,
        fullName:
          typeof parsed.fullName === 'string' && parsed.fullName.trim().length >= 2
            ? parsed.fullName.trim()
            : localProfile.fullName,
        headline,
        targetRoles: targetRoles.length > 0 ? targetRoles : [headline],
        location:
          typeof parsed.location === 'string' && parsed.location.trim().length >= 2
            ? parsed.location.trim()
            : localProfile.location,
        preferredWorkMode,
        yearsExperience: Number.isFinite(yearsNum) && yearsNum >= 0 ? Math.min(40, Math.round(yearsNum)) : localProfile.yearsExperience,
        skills: skills.length > 0 ? skills : localProfile.skills,
        highlights: highlights.length > 0 ? highlights : localProfile.highlights,
        languages: languages.length > 0 ? languages : localProfile.languages,
        rawCvText: cvText.slice(0, 12_000),
        updatedAt: new Date().toISOString(),
      },
    };
  } catch {
    return { profile: localProfile, source: 'local' };
  }
}
