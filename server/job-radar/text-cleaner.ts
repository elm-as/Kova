import crypto from 'node:crypto';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&eacute;': 'é',
  '&egrave;': 'è',
  '&ecirc;': 'ê',
  '&agrave;': 'à',
  '&ccedil;': 'ç',
  '&ocirc;': 'ô',
  '&ucirc;': 'û',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&ndash;': '-',
  '&mdash;': '-',
};

const KNOWN_SKILLS = [
  'python', 'typescript', 'javascript', 'react', 'next.js', 'node.js', 'vue', 'angular',
  'rust', 'c++', 'go', 'java', 'kotlin', 'swift', 'flutter', 'dart', 'php', 'laravel', 'symfony',
  'sql', 'postgresql', 'mysql', 'mongodb', 'supabase', 'redis', 'duckdb', 'graphql', 'rest api',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd', 'linux', 'git',
  'machine learning', 'data science', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'power bi',
  'excel', 'tableau', 'nlp', 'llm', 'devops', 'cybersécurité', 'sécurité', 'figma', 'ui/ux',
  'comptabilité', 'finance', 'audit', 'gestion de projet', 'agile', 'scrum', 'marketing digital',
  'commercial', 'vente', 'ressources humaines', 'logistique', 'supply chain', 'juridique',
  'erp', 'sap', 'sage', 'odoo', 'crm', 'salesforce', 'anglais', 'français',
];

/**
 * Strips HTML markup and decodes common HTML entities into clean single-line text.
 */
export function cleanHtmlText(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&[a-z0-9#]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity);
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncates text cleanly without cutting mid-word.
 */
export function summarizeText(text: string, maxChars = 280): string {
  const clean = cleanHtmlText(text);
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 120 ? lastSpace : maxChars).trim()}…`;
}

/**
 * Extracts normalized technical and corporate skills mentioned in title/description/tags.
 */
export function extractOfferSkills(text: string, explicitTags: string[] = []): string[] {
  const lowered = text.toLowerCase();
  const collected = new Set<string>();

  for (const tag of explicitTags) {
    const cleaned = cleanHtmlText(tag);
    if (cleaned.length >= 2 && cleaned.length <= 36) collected.add(cleaned);
  }

  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9à-ÿ])${escaped}($|[^a-z0-9à-ÿ])`, 'i');
    if (regex.test(lowered)) collected.add(skill);
  }

  return Array.from(collected).slice(0, 12);
}

/**
 * Computes a deterministic fingerprint for deduplicating offers across sources.
 */
export function buildOfferFingerprint(title: string, company: string, location: string): string {
  const normalized = `${title}|${company}|${location}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9|]/g, '');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 14);
}
