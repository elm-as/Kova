const SKILL_ALIASES: Record<string, string> = {
  reactjs: 'react',
  'react.js': 'react',
  nextjs: 'next.js',
  nodejs: 'node.js',
  ts: 'typescript',
  js: 'javascript',
  postgres: 'postgresql',
  psql: 'postgresql',
  cpp: 'c++',
  'c++17': 'c++',
  golang: 'go',
  k8s: 'kubernetes',
  ml: 'machine learning',
  ai: 'ia',
  'artificial intelligence': 'ia',
  'intelligence artificielle': 'ia',
  'data analytics': 'data science',
  'analyse de données': 'data science',
  'powerbi': 'power bi',
  'ux/ui': 'ui/ux',
  'project management': 'gestion de projet',
  'chef de projet': 'gestion de projet',
  accounting: 'comptabilité',
  comptable: 'comptabilité',
  sales: 'commercial',
  vente: 'commercial',
  hr: 'ressources humaines',
  rh: 'ressources humaines',
  cybersecurity: 'cybersécurité',
  security: 'sécurité',
};

const SKILL_CATALOG = [
  'python', 'typescript', 'javascript', 'react', 'next.js', 'node.js', 'vue', 'angular',
  'rust', 'c++', 'go', 'java', 'kotlin', 'swift', 'flutter', 'dart', 'php', 'laravel', 'symfony',
  'sql', 'postgresql', 'mysql', 'mongodb', 'supabase', 'redis', 'duckdb', 'graphql', 'rest api',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd', 'linux', 'git',
  'machine learning', 'data science', 'ia', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas',
  'power bi', 'excel', 'tableau', 'nlp', 'llm', 'devops', 'cybersécurité', 'sécurité', 'figma', 'ui/ux',
  'comptabilité', 'finance', 'audit', 'gestion de projet', 'agile', 'scrum', 'marketing digital',
  'commercial', 'ressources humaines', 'logistique', 'supply chain', 'juridique', 'erp', 'sap', 'sage', 'odoo', 'crm',
];

/**
 * Strips accents and lowercases strings for reliable FR/EN matching.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps a raw skill string to its canonical form.
 */
export function normalizeSkill(raw: string): string {
  const clean = normalizeText(raw).replace(/[()]/g, '');
  return SKILL_ALIASES[clean] ?? clean;
}

/**
 * Extracts recognized technical and corporate skills from free-form text (CV or offer).
 */
export function extractRecognizedSkills(text: string): string[] {
  const lowered = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of SKILL_CATALOG) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9à-ÿ])${escaped}($|[^a-z0-9à-ÿ])`, 'i');
    if (pattern.test(lowered)) found.add(skill);
  }

  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9à-ÿ])${escaped}($|[^a-z0-9à-ÿ])`, 'i');
    if (pattern.test(lowered)) found.add(canonical);
  }

  return Array.from(found);
}
