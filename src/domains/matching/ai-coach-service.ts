import type { CandidateProfile } from '../candidate-space/candidate-profile-types';
import type { OfferMatchAnalysis } from './offer-matcher';

export interface AiApplicationCoachPlan {
  source: 'llm' | 'local';
  pitch: string;
  cvAdjustments: string[];
  interviewQuestions: string[];
}

function buildDeterministicCoachPlan(
  analysis: OfferMatchAnalysis,
  profile: CandidateProfile,
): AiApplicationCoachPlan {
  const { offer, matchedSkills, missingSkills } = analysis;
  const topSkills = matchedSkills.slice(0, 4).join(', ') || profile.skills.slice(0, 3).join(', ');
  const leadHighlight = profile.highlights[0] || `une expérience opérationnelle de ${profile.yearsExperience} ans`;

  const pitch =
    offer.language === 'en'
      ? `Hello ${offer.company} team, I am applying for the ${offer.title} role. With ${profile.yearsExperience} years of experience centered on ${topSkills}, I recently delivered ${leadHighlight}. I would value the opportunity to bring this execution rigor to your team.`
      : `Bonjour l'équipe ${offer.company}, je candidate au poste de ${offer.title}. Fort de ${profile.yearsExperience} ans d'expérience autour de ${topSkills}, j'ai notamment piloté ${leadHighlight}. Je serais ravi d'échanger sur la manière dont mon profil peut accélérer vos priorités actuelles.`;

  const cvAdjustments = [
    ...analysis.highlightsToEmphasize,
    missingSkills.length > 0
      ? `Préparez une réponse honnête sur ${missingSkills.slice(0, 2).join(' et ')} en montrant un projet connexe rapide à transférer.`
      : 'Chiffrez vos résultats récents (délais réduits, volumes traités, impact métier) dès le tiers supérieur du CV.',
  ].slice(0, 4);

  const interviewQuestions = [
    `Comment votre expérience sur ${matchedSkills[0] || profile.skills[0] || 'votre cœur de métier'} s'applique-t-elle concrètement aux enjeux de ${offer.company} ?`,
    `Décrivez un projet complexe que vous avez mené en autonomie du cadrage à la mise en production.`,
    missingSkills[0]
      ? `Comment monteriez-vous rapidement en compétence sur ${missingSkills[0]} durant les 30 premiers jours ?`
      : `Quel indicateur de qualité ou de performance suivez-vous pour prouver l'impact de votre travail ?`,
  ];

  return {
    source: 'local',
    pitch,
    cvAdjustments,
    interviewQuestions,
  };
}

/**
 * Generates an on-demand tailored application coaching kit via Kova's /api/llm proxy,
 * falling back cleanly to a structured deterministic strategy if no LLM key is active.
 */
export async function generateApplicationCoachPlan(
  analysis: OfferMatchAnalysis,
  profile: CandidateProfile,
): Promise<AiApplicationCoachPlan> {
  const prompt = [
    `Tu es un coach carrière senior rigoureux. Réponds UNIQUEMENT en JSON valide avec les clés: "pitch" (string, 3-4 phrases percutantes), "cvAdjustments" (array de 3-4 conseils concrets sur ce qu'il faut mettre en avant dans le CV), "interviewQuestions" (array de 3 questions probables en entretien).`,
    `Langue de sortie: ${analysis.offer.language === 'en' ? 'English' : 'Français'}.`,
    `OFFRE: ${analysis.offer.title} chez ${analysis.offer.company} (${analysis.offer.location}, ${analysis.offer.contractType}).`,
    `RÉSUMÉ OFFRE: ${analysis.offer.summary}`,
    `COMPÉTENCES MATCHÉES: ${analysis.matchedSkills.join(', ') || 'Aucune explicite'}.`,
    `ÉCARTS: ${analysis.missingSkills.join(', ') || 'Aucun majeur'}.`,
    `PROFIL CANDIDAT: ${profile.headline}, ${profile.yearsExperience} ans d'exp. Compétences: ${profile.skills.join(', ')}. Réalisations: ${profile.highlights.join(' | ')}.`,
  ].join('\n');

  try {
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, jsonMode: true }),
    });
    if (!resp.ok) return buildDeterministicCoachPlan(analysis, profile);

    const payload = (await resp.json()) as { content?: string };
    if (!payload.content) return buildDeterministicCoachPlan(analysis, profile);

    const parsed = JSON.parse(payload.content) as Partial<AiApplicationCoachPlan>;
    if (!parsed.pitch || !Array.isArray(parsed.cvAdjustments) || !Array.isArray(parsed.interviewQuestions)) {
      return buildDeterministicCoachPlan(analysis, profile);
    }

    return {
      source: 'llm',
      pitch: String(parsed.pitch),
      cvAdjustments: parsed.cvAdjustments.map(String).slice(0, 4),
      interviewQuestions: parsed.interviewQuestions.map(String).slice(0, 3),
    };
  } catch {
    return buildDeterministicCoachPlan(analysis, profile);
  }
}
