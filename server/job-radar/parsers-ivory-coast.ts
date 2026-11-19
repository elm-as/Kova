import type { JobOffer } from './types';
import { buildOfferFingerprint, cleanHtmlText, extractOfferSkills, summarizeText } from './text-cleaner';

const USER_AGENT = 'KovaJobRadar/1.0 (+https://elmas.solutions)';

async function fetchTextWithTimeout(url: string, timeoutMs = 9_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractMetaStrong(cardHtml: string, labelPattern: RegExp): string {
  const match = cardHtml.match(labelPattern);
  return match ? cleanHtmlText(match[1]) : '';
}

function parseEmploiCiCard(cardHtml: string): JobOffer | null {
  const hrefMatch = cardHtml.match(/data-href="([^"]+)"/i) || cardHtml.match(/<h3>\s*<a[^>]*href="([^"]+)"/i);
  const titleMatch = cardHtml.match(/<h3>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
  if (!hrefMatch || !titleMatch) return null;

  const rawUrl = hrefMatch[1].startsWith('http') ? hrefMatch[1] : `https://www.emploi.ci${hrefMatch[1]}`;
  const title = cleanHtmlText(titleMatch[1]);
  if (title.length < 4) return null;

  const companyMatch = cardHtml.match(/class="[^"]*card-job-company[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  const company = companyMatch ? cleanHtmlText(companyMatch[1]) : 'Entreprise confidentielle';

  const descMatch = cardHtml.match(/class="card-job-description"[^>]*>([\s\S]*?)<\/div>/i);
  const summary = descMatch ? summarizeText(descMatch[1].replace(/\+plus/gi, ''), 260) : title;

  const contractType = extractMetaStrong(cardHtml, /Contrat propos[ée]\s*:\s*<strong>([\s\S]*?)<\/strong>/i) || 'CDI / CDD';
  const region = extractMetaStrong(cardHtml, /R[ée]gion de\s*:\s*<strong>([\s\S]*?)<\/strong>/i) || "Abidjan, Côte d'Ivoire";
  const experienceLevel = extractMetaStrong(cardHtml, /Niveau d['’]exp[ée]rience\s*:\s*<strong>([\s\S]*?)<\/strong>/i) || 'Tous niveaux';
  const rawSkills = extractMetaStrong(cardHtml, /Comp[ée]tences cl[ée]s\s*:\s*<strong>([\s\S]*?)<\/strong>/i);
  const explicitSkills = rawSkills ? rawSkills.split(/\s*-\s*|,/).map((s) => s.trim()).filter(Boolean) : [];

  const timeMatch = cardHtml.match(/<time[^>]*datetime="([^"]+)"/i);
  const publishedAt = timeMatch ? timeMatch[1] : new Date().toISOString().slice(0, 10);
  const isRemote = /t[ée]l[ée]travail|remote|distance/i.test(`${title} ${summary} ${region}`);
  const isHybrid = /hybride|hybrid/i.test(`${title} ${summary}`);

  return {
    id: `emploi_ci-${buildOfferFingerprint(title, company, region)}`,
    source: 'emploi_ci',
    sourceLabel: 'Emploi.ci',
    market: 'ci_africa',
    title,
    company,
    location: region.includes("Côte d'Ivoire") || region === 'International' ? region : `${region}, Côte d'Ivoire`,
    workMode: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'onsite',
    contractType,
    experienceLevel,
    salary: null,
    skills: extractOfferSkills(`${title} ${summary}`, explicitSkills),
    summary,
    url: rawUrl,
    publishedAt,
    language: 'fr',
  };
}

/**
 * Fetches live job listings from Emploi.ci public search pages (polite GET, no anti-bot bypass).
 */
export async function fetchEmploiCiOffers(query?: string): Promise<JobOffer[]> {
  const baseUrl = query?.trim()
    ? `https://www.emploi.ci/recherche-jobs-cote-ivoire?query=${encodeURIComponent(query.trim())}`
    : 'https://www.emploi.ci/recherche-jobs-cote-ivoire';

  const html = await fetchTextWithTimeout(baseUrl);
  const chunks = html.split(/<div class="card card-job/i).slice(1);
  const offers: JobOffer[] = [];

  for (const chunk of chunks) {
    const parsed = parseEmploiCiCard(`<div class="card card-job${chunk.slice(0, 3200)}`);
    if (parsed) offers.push(parsed);
  }
  return offers;
}

/**
 * Fetches live Côte d'Ivoire job listings from Educarriere public listings page.
 */
export async function fetchEducarriereOffers(): Promise<JobOffer[]> {
  const html = await fetchTextWithTimeout('https://emploi.educarriere.ci/');
  const linkRegex = /href="(https:\/\/emploi\.educarriere\.ci\/offre-[^"]+)"[^>]*>([\s\S]{4,220}?)<\/a>/gi;
  const seenUrls = new Set<string>();
  const offers: JobOffer[] = [];

  for (const match of html.matchAll(linkRegex)) {
    const url = match[1];
    const title = cleanHtmlText(match[2]);
    if (seenUrls.has(url) || title.length < 5 || /^voir\+/i.test(title)) continue;
    seenUrls.add(url);

    const contextWindow = html.slice(Math.max(0, (match.index ?? 0) - 80), (match.index ?? 0) + 520);
    const contractMatch = contextWindow.match(/\b(CDI|CDD|Stage|Consultant|Intérim|Freelance)\b/i);
    const cityMatch = contextWindow.match(/\b(Abidjan|Bouaké|Yamoussoukro|San-Pédro|Daloa|Korhogo|Côte d['’]Ivoire)\b/i);
    const location = cityMatch ? `${cityMatch[1]}, Côte d'Ivoire` : "Abidjan, Côte d'Ivoire";

    offers.push({
      id: `educarriere-${buildOfferFingerprint(title, 'Educarriere CI', location)}`,
      source: 'educarriere',
      sourceLabel: 'Educarriere.ci',
      market: 'ci_africa',
      title,
      company: 'Recruteur Educarriere CI',
      location,
      workMode: /remote|distance|t[ée]l[ée]travail/i.test(title) ? 'remote' : 'onsite',
      contractType: contractMatch ? contractMatch[1] : 'Emploi / Stage',
      experienceLevel: /stage|junior|assistant/i.test(title) ? 'Junior / Stage' : 'Confirmé',
      salary: null,
      skills: extractOfferSkills(title),
      summary: `Offre publiée sur Educarriere Côte d'Ivoire (${location}) : ${title}. Consultez la fiche officielle pour les modalités complètes de candidature.`,
      url,
      publishedAt: new Date().toISOString().slice(0, 10),
      language: 'fr',
    });

    if (offers.length >= 24) break;
  }

  return offers;
}
