import { Position, Candidate, Language, ScoreWeights, DEFAULT_SCORE_WEIGHTS, SCORE_CATEGORY_MAP, SCORE_WEIGHT_KEYS } from '@/lib/types'
import { llm } from '@/lib/llmClient'
import { getLLMModel } from '@/lib/llmModels'
import { defendPrompt, sanitizeShortText, validateScoreSanity, type DefenseScanResult } from '@/lib/promptDefense'

/** Read saved score weights from localStorage (set by SettingsView via useKV). */
export function getStoredWeights(): ScoreWeights {
  try {
    const raw = localStorage.getItem('local-kv:ats:score-weights')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Validate shape
      if (SCORE_WEIGHT_KEYS.every(k => typeof parsed[k] === 'number')) return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_SCORE_WEIGHTS
}

/**
 * ─── PROMPT DEFENSE LAYER ───
 * Applique la protection anti-reverse-prompting sur le texte candidat.
 * La fonction defendPrompt() applique 3 couches :
 *   1. Nettoyage des caractères invisibles (zero-width, homoglyphes...)
 *   2. Détection par patterns regex (>100 patterns malveillants)
 *   3. Encadrement fort (delimiter guards) qui dit au LLM de ne pas obéir
 * Retourne le scan de défense pour audit trail + le texte assaini.
 */

// ─── Cache & helpers ─────────────────────────────────────────────────────────
/**
 * Simple in-memory analysis cache to avoid re-analyzing identical CV+position pairs.
 * Key: hash of (profileText + positionRequirements). TTL: 30 minutes.
 */
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000

async function getCacheKey(profileText: string, requirements: string): Promise<string> {
  const input = `${profileText}|||${requirements}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getCachedAnalysis(key: string): AnalysisResult | null {
  const entry = analysisCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    analysisCache.delete(key)
    return null
  }
  return entry.result
}

function setCachedAnalysis(key: string, result: AnalysisResult) {
  analysisCache.set(key, { result, timestamp: Date.now() })
}

interface AnalysisResult {
  score: number
  scoreBreakdown: Array<{
    category: string
    score: number
    reasoning: string
  }>
  strengths: string[]
  weaknesses: string[]
  overallAssessment: string
}

interface AlternativePosition {
  positionId: string
  positionTitle: string
  reasoning: string
}

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STOPWORDS_FR = new Set([
  'de','la','le','les','des','du','un','une','et','ou','a','au','aux','en','dans','sur','pour','avec','sans','ce','cet','cette','ces','son','sa','ses','leur','leurs','plus','moins','tres','trop','qui','que','quoi','dont','comme','par','se','d','l','y','est','etre','avoir'
])

const STOPWORDS_EN = new Set([
  'the','a','an','and','or','to','of','in','on','for','with','without','this','that','these','those','is','are','was','were','be','been','being','have','has','had','as','by','from','at','it','its','their','them','we','you','your'
])

function extractKeywords(text: string, language: Language) {
  const stop = language === 'en' ? STOPWORDS_EN : STOPWORDS_FR
  const words = normalizeText(text)
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const keywords = new Set(
    words
      .filter((w) => w.length >= 4)
      .filter((w) => !stop.has(w))
  )
  return [...keywords]
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/**
 * Detect implicit competency signals from the candidate profile text.
 * Each signal can only be attributed to ONE category (no double-counting).
 * Scoring is progressive (not binary) based on signal intensity.
 * Priority: Production Readiness > Technical Skills. POE is LLM-only.
 */
function detectImplicitInferenceBonuses(profileText: string): {
  devops: boolean
  backend: boolean
  architecture: boolean
  bonuses: Record<string, number>
  reasons: string[]
  noSalariedExperience: boolean
} {
  const text = profileText.toLowerCase()

  // DevOps implicite: project deployed in production
  const deploymentSignals = [
    'netlify', 'vercel', 'railway', 'fly.io', 'heroku', 'aws', 'azure', 'gcp',
    'google cloud', 'docker', 'kubernetes', 'ci/cd', 'github actions', 'gitlab ci',
    'deployed', 'production', 'déployé', 'en ligne', 'live',
    'hosting', 'hébergement',
  ]
  const hasDeployment = deploymentSignals.some(s => text.includes(s))

  // Backend implicite: Supabase/Firebase + auth + business logic
  const baasSignals = ['supabase', 'firebase', 'pocketbase', 'appwrite']
  const authSignals = ['auth', 'authentication', 'login', 'connexion', 'inscription', 'registration', 'jwt', 'oauth', 'rls', 'row level security']
  const businessLogicSignals = ['api', 'crud', 'database', 'base de données', 'logique métier', 'business logic', 'trigger', 'function', 'edge function', 'webhook', 'stripe', 'payment', 'paiement']
  const hasBaas = baasSignals.some(s => text.includes(s))
  const hasAuth = authSignals.some(s => text.includes(s))
  const hasBusinessLogic = businessLogicSignals.some(s => text.includes(s))
  const hasBackend = hasBaas && hasAuth && hasBusinessLogic

  // Architecture implicite: multi-module project (frontend + backend/BaaS + DB)
  const frontendSignals = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'frontend', 'front-end', 'tailwind']
  const backendSignals = [...baasSignals, 'node', 'express', 'fastify', 'django', 'flask', 'spring', 'laravel', 'backend', 'back-end', 'server', 'serveur', 'api rest', 'graphql']
  const dbSignals = ['postgresql', 'postgres', 'mysql', 'mongodb', 'sqlite', 'database', 'base de données', 'supabase', 'firebase', 'prisma', 'drizzle']
  const hasFrontend = frontendSignals.some(s => text.includes(s))
  const hasBackendModule = backendSignals.some(s => text.includes(s))
  const hasDB = dbSignals.some(s => text.includes(s))
  const hasArchitecture = hasFrontend && hasBackendModule && hasDB

  // Detect absence of salaried experience (with project density escape hatch)
  const salariedSignals = ['cdi', 'cdd', 'salarié', 'employé', 'entreprise', 'société', 'poste', 'employed', 'company', 'full-time', 'part-time', 'freelance', 'ans d\'expérience', 'years of experience', 'stage en entreprise', 'alternance']
  const hasProjectDensity = (text.match(/projet|project/g) || []).length >= 3
  const noSalariedExperience = !salariedSignals.some(s => text.includes(s)) && !hasProjectDensity

  // Each signal assigned to ONE category only (no double-counting).
  // POE is LLM-only — never boosted programmatically.
  // Progressive scoring based on signal intensity.
  const bonuses: Record<string, number> = {}
  const reasons: string[] = []

  if (hasDeployment) {
    // DevOps signal → Production Readiness only (progressive 0-10)
    let devopsScore = 0
    if (hasDeployment) devopsScore += 5
    if (text.includes('production') || text.includes('déployé')) devopsScore += 3
    if (text.includes('ci/cd') || text.includes('github actions') || text.includes('gitlab ci')) devopsScore += 2
    bonuses['Production Readiness'] = devopsScore
    reasons.push(`DevOps implicite : Production Readiness +${devopsScore}`)
  }

  if (hasBackend) {
    // Backend signal → Technical Skills only (progressive 0-10, POE stays LLM-only)
    let backendScore = 0
    if (hasBaas) backendScore += 4
    if (hasAuth) backendScore += 3
    if (hasBusinessLogic) backendScore += 3
    bonuses['Technical Skills'] = (bonuses['Technical Skills'] || 0) + backendScore
    reasons.push(`Backend implicite : Technical Skills +${backendScore}`)
  }

  if (hasArchitecture) {
    // Architecture signal → Technical Skills only (progressive 0-10)
    let archScore = 0
    if (hasFrontend) archScore += 3
    if (hasBackendModule) archScore += 3
    if (hasDB) archScore += 4
    // Merge with any existing Technical Skills bonus (from backend), still capped later at 30%
    bonuses['Technical Skills'] = Math.min((bonuses['Technical Skills'] || 0) + archScore, 10)
    reasons.push(`Architecture implicite : Technical Skills +${archScore} (fusionné, max 10)`)
  }

  return { devops: hasDeployment, backend: hasBackend, architecture: hasArchitecture, bonuses, reasons, noSalariedExperience }
}

/**
 * Apply implicit inference bonuses to an analysis result.
 *
 * Rules:
 * 1. Each signal used in ONE category only (no double-counting)
 * 2. Bonus ≤ 30% of the category's base score
 * 3. Category hard caps: Professional Experience ≤ 80 without salaried experience,
 *    Career Trajectory ≤ 85
 * 4. No salaried experience → single global penalty of -12 on final score (not per-category)
 * 5. Saturation at 100 is logged in reasoning
 */
function applyImplicitInferenceBonuses(result: AnalysisResult, profileText: string, weights: ScoreWeights): AnalysisResult {
  const { bonuses, reasons, noSalariedExperience } = detectImplicitInferenceBonuses(profileText)

  const hasAnyBonus = reasons.length > 0 || noSalariedExperience
  if (!hasAnyBonus) return result

  // Map French category names to English for bonus lookup
  const frToEn: Record<string, string> = {
    'Compétences techniques': 'Technical Skills',
    'Expérience professionnelle': 'Professional Experience',
    'Formation & certifications': 'Education & Certifications',
    'Adéquation culturelle & soft skills': 'Cultural Fit & Soft Skills',
    'Trajectoire & potentiel': 'Career Trajectory & Growth',
    'Maturité production': 'Production Readiness',
    "Preuve d'exécution": 'Proof of Execution',
  }

  // Hard caps per category (English names)
  const categoryCaps: Record<string, number> = {
    'Professional Experience': noSalariedExperience ? 80 : 100,
    'Career Trajectory & Growth': 85,
  }

  const updated = { ...result, scoreBreakdown: result.scoreBreakdown.map(item => {
    const enCategory = frToEn[item.category] || item.category
    const baseScore = item.score
    let newScore = baseScore
    let reasonSuffix = ''

    // Apply bonus capped at 30% of base score
    const rawBonus = bonuses[enCategory] || 0
    if (rawBonus > 0) {
      const maxBonus = Math.round(baseScore * 0.30)
      const effectiveBonus = Math.min(rawBonus, maxBonus)
      newScore = baseScore + effectiveBonus
      if (effectiveBonus > 0) {
        reasonSuffix += ` [Inférence: +${effectiveBonus}, plafonné 30% de ${baseScore}]`
      }
    }

    // Apply hard cap
    const cap = categoryCaps[enCategory]
    if (cap !== undefined && newScore > cap) {
      reasonSuffix += ` [Cap ${cap} appliqué${noSalariedExperience && enCategory === 'Professional Experience' ? ': pas d\'exp. salariée' : ''}]`
      newScore = cap
    }

    newScore = clamp(newScore, 0, 100)

    // Trace saturation
    if (newScore === 100 && baseScore < 100) {
      reasonSuffix += ' [Capped at 100]'
    }

    if (newScore === baseScore && !reasonSuffix) return item
    return {
      ...item,
      score: newScore,
      reasoning: item.reasoning + reasonSuffix,
    }
  })}

  // Recalculate weighted score
  const categoryScoreMap: Record<string, number> = {}
  for (const item of updated.scoreBreakdown) {
    categoryScoreMap[item.category] = item.score
  }
  const weightMap: [keyof ScoreWeights, string][] = SCORE_WEIGHT_KEYS.map(k => [k, SCORE_CATEGORY_MAP[k]])
  let weightedTotal = 0
  let weightSum = 0
  for (const [wKey, catName] of weightMap) {
    const catScore = categoryScoreMap[catName]
    if (typeof catScore === 'number') {
      weightedTotal += catScore * weights[wKey]
      weightSum += weights[wKey]
    }
  }
  if (weightSum > 0) {
    updated.score = Math.round(weightedTotal / weightSum)
  }

  // Apply global penalty ONCE on final score (not per-category)
  if (noSalariedExperience) {
    updated.score = clamp(updated.score - 12, 0, 100)
  }

  // Keep overallAssessment clean — no inference details appended
  return updated
}

function analyzeCandidateLocally(
  candidate: Candidate,
  position: Position,
  language: Language
): AnalysisResult {
  const isEnglish = language === 'en'
  const requirementsText = `${position.title}\n${position.requirements || ''}\n${position.description || ''}`
  const profileText = candidate.profileText || ''

  const reqKeywords = extractKeywords(requirementsText, language)
  const profileNorm = normalizeText(profileText)

  const matched = reqKeywords.filter((k) => profileNorm.includes(k))
  const ratio = reqKeywords.length > 0 ? matched.length / reqKeywords.length : 0

  // Score de base: 40..95 selon la correspondance, + bonus stage.
  const internshipBonus = position.isInternship ? 10 : 0
  const score = clamp(Math.round(40 + ratio * 55 + internshipBonus), 20, 98)

  const topStrengths = matched.slice(0, 6)
  const missing = reqKeywords.filter((k) => !matched.includes(k)).slice(0, 5)

  const strengths =
    topStrengths.length > 0
      ? topStrengths.map((k) => (isEnglish ? `Mentions: ${k}` : `Mentionne : ${k}`))
      : [isEnglish ? 'Profile provided but few direct requirement matches found.' : 'Profil fourni mais peu de correspondances directes avec les exigences.']

  const weaknesses = [
    ...(missing.length > 0
      ? [isEnglish ? `Missing/unclear on: ${missing.join(', ')}` : `Peu clair / absent sur : ${missing.join(', ')}`]
      : []),
    isEnglish
      ? 'Local dev analysis (heuristic). Run with Spark LLM for a full assessment.'
      : "Analyse en mode dev local (heuristique). Utilisez Spark LLM pour une évaluation complète.",
  ].slice(0, 5)

  const scoreBreakdown = [
    {
      category: isEnglish ? 'Technical Skills' : 'Compétences techniques',
      score: clamp(score - 3, 0, 100),
      reasoning: isEnglish
        ? `Heuristic match: ${matched.length}/${reqKeywords.length} requirement keywords found in profile.`
        : `Correspondance heuristique : ${matched.length}/${reqKeywords.length} mots-clés d'exigences trouvés dans le profil.`,
    },
    {
      category: isEnglish ? 'Professional Experience' : 'Expérience professionnelle',
      score: clamp(score - 5, 0, 100),
      reasoning: isEnglish
        ? 'Estimated from profile text only (no LLM). Includes project-based experience.'
        : 'Estimé uniquement à partir du texte du profil (sans LLM). Inclut l\'expérience par projets.',
    },
    {
      category: isEnglish ? 'Education & Certifications' : 'Formation & certifications',
      score: clamp(score - 4, 0, 100),
      reasoning: isEnglish
        ? 'Estimated from profile text only (no LLM).'
        : 'Estimé uniquement à partir du texte du profil (sans LLM).',
    },
    {
      category: isEnglish ? 'Cultural Fit & Soft Skills' : 'Adéquation culturelle & soft skills',
      score: clamp(score - 8, 0, 100),
      reasoning: isEnglish
        ? 'Not reliably assessable without LLM; conservative scoring.'
        : 'Difficile à évaluer sans LLM ; score conservateur.',
    },
    {
      category: isEnglish ? 'Career Trajectory & Growth' : 'Trajectoire & potentiel',
      score: clamp(score - 6, 0, 100),
      reasoning: isEnglish
        ? (position.isInternship
            ? 'Internship: potential weighted more heavily (heuristic).'
            : 'Heuristic estimate from profile text.')
        : (position.isInternship
            ? 'Stage : le potentiel est davantage valorisé (heuristique).'
            : 'Estimation heuristique à partir du texte du profil.'),
    },
    {
      category: isEnglish ? 'Production Readiness' : 'Maturité production',
      score: clamp(score - 10, 0, 100),
      reasoning: isEnglish
        ? 'Not reliably assessable without LLM; requires evidence of deployment, users, monitoring.'
        : 'Difficile à évaluer sans LLM ; nécessite des preuves de déploiement, utilisateurs, monitoring.',
    },
    {
      category: isEnglish ? 'Proof of Execution' : 'Preuve d\'exécution',
      score: clamp(score - 12, 0, 100),
      reasoning: isEnglish
        ? 'Not reliably assessable without LLM; requires evidence of accessible projects, real complexity, architecture coherence.'
        : 'Difficile à évaluer sans LLM ; nécessite des preuves de projets accessibles, complexité réelle, cohérence d\'architecture.',
    },
  ]

  const overallAssessment = isEnglish
    ? `Local heuristic score: ${score}/100. ${matched.length > 0 ? `Main matches: ${matched.slice(0, 4).join(', ')}.` : 'Few direct matches detected.'} Use Spark LLM for a detailed evaluation.`
    : `Score heuristique local : ${score}/100. ${matched.length > 0 ? `Principales correspondances : ${matched.slice(0, 4).join(', ')}.` : 'Peu de correspondances directes détectées.'} Utilisez Spark LLM pour une évaluation détaillée.`

  return applyImplicitInferenceBonuses({ score, scoreBreakdown, strengths, weaknesses, overallAssessment }, profileText, DEFAULT_SCORE_WEIGHTS)
}

export async function analyzeCandidateWithAI(
  candidate: Candidate,
  position: Position,
  language: Language,
  weights?: ScoreWeights
): Promise<AnalysisResult & { promptDefense?: DefenseScanResult }> {
  // ─── PROMPT DEFENSE ─── Apply before anything else
  const defense = defendPrompt(candidate.profileText, candidate.name)
  // Tronquer à 6500 caractères max pour éviter d'exploser le quota de tokens par minute (TPM 8000)
  const MAX_PROFILE_CHARS = 6500
  const safeProfileText = defense.sanitized.length > MAX_PROFILE_CHARS
    ? defense.sanitized.substring(0, MAX_PROFILE_CHARS) + '\n[... CV synthétisé pour respecter les quotas de tokens]'
    : defense.sanitized
  const safeName = sanitizeShortText(candidate.name)
  const safeEmail = sanitizeShortText(candidate.email)
  const safeTitle = sanitizeShortText(position.title)
  const safeRequirements = sanitizeShortText(position.requirements.substring(0, 800))
  const safeDescription = sanitizeShortText(position.description?.substring(0, 400) || '')

  // Check cache first (key uses ORIGINAL text — defense is deterministic so same input = same defense)
  const effectiveWeights = weights || DEFAULT_SCORE_WEIGHTS
  const cacheKey = await getCacheKey(
    candidate.profileText,
    JSON.stringify({ req: position.requirements, weights: effectiveWeights, level: position.targetLevel || 'mid', intern: position.isInternship || false })
  )
  const cached = getCachedAnalysis(cacheKey)
  if (cached) {
    return { ...cached, promptDefense: defense }
  }

  const isEnglish = language === 'en'
  const targetLang = isEnglish ? 'ENGLISH' : 'FRENCH'
  const isInternship = position.isInternship || false
  const targetLevel = position.targetLevel || 'mid'
  
  const positionSummary = `${safeTitle}\nRequirements: ${safeRequirements}${safeDescription ? '\nDescription: ' + safeDescription : ''}`
  
  const internshipGuidance = isInternship 
    ? `\n\n⚠️ IMPORTANT - THIS IS AN INTERNSHIP POSITION:
- Significantly reduce penalties for lack of experience or professional gaps
- Focus on potential, learning ability, academic achievements, and relevant projects
- Weaknesses related to experience should be viewed as learning opportunities, not red flags
- Value enthusiasm, adaptability, and foundational knowledge
- Be more forgiving of skill gaps that can be learned during the internship
- Scores should generally be 10-15 points higher than for a regular position with same profile`
    : ''

  const targetLevelGuidance = `\n\n═══ TARGET SENIORITY LEVEL: ${targetLevel.toUpperCase()} ═══
${targetLevel === 'junior' ? `This position targets JUNIOR candidates.
- POTENTIAL > EXPERIENCE: Weight learning velocity, curiosity, and project initiative far more than years of experience.
- Do NOT penalize for lack of salaried experience if the candidate shows real project output.
- Academic projects, personal projects, and certifications carry MORE weight than for mid/senior roles.
- A junior with deployed personal projects is STRONGER than a junior with only coursework.
- Expected experience: 0-2 years (including project-based). Adjust Professional Experience scoring accordingly.`
: targetLevel === 'senior' ? `This position targets SENIOR candidates.
- EXPERIENCE > POTENTIAL: Require strong evidence of production-grade work, team leadership, and architectural decisions.
- Expect 5+ years of relevant experience (salaried or equivalent project-based).
- Look for: mentoring evidence, code review experience, system design, scaling challenges solved.
- Personal projects alone are insufficient — need evidence of professional-grade collaboration.
- Score more strictly on Production Readiness and Proof of Execution.`
: `This position targets MID-LEVEL candidates.
- Balance experience and potential equally.
- Expect 2-5 years of relevant experience (salaried or project-based combined).
- Value both professional experience AND strong personal/open-source portfolio.
- Look for evidence of growing autonomy and increasing project complexity.`}`

  const weightInstructions = `
═══ CATEGORY WEIGHTS (for overall score) ═══
The recruiter has configured these weights for the final score calculation:
- Technical Skills: ${effectiveWeights.technicalSkills}%
- Professional Experience: ${effectiveWeights.professionalExperience}%
- Education & Certifications: ${effectiveWeights.educationCertifications}%
- Cultural Fit & Soft Skills: ${effectiveWeights.culturalFitSoftSkills}%
- Career Trajectory & Growth: ${effectiveWeights.careerTrajectoryGrowth}%
- Production Readiness: ${effectiveWeights.productionReadiness}%
- Proof of Execution (POE): ${effectiveWeights.proofOfExecution}%

The "score" field MUST be the weighted average of all 7 category scores using these weights.`

  const analysisPrompt = `You are a senior technical recruiter and engineering manager with deep hands-on experience in software development AND talent assessment. You evaluate candidates from a PRODUCTION-ORIENTED perspective, not an academic one. Respond ONLY in ${targetLang}.

CORE PRINCIPLES:
- Be evidence-based. Do not invent facts. If the profile text comes from OCR, expect noise; rely only on clear evidence.
- If something is missing/unclear, state it explicitly in reasoning and adjust confidence downward.
- Output ONLY valid JSON (no markdown, no extra text).
- PRODUCTION OVER THEORY: A candidate who has shipped real products is more valuable than one with only coursework.

═══ ANTI-BIAS & OBJECTIVITY RULES — MANDATORY ═══
You MUST evaluate candidates objectively. Subjective judgments are FORBIDDEN. Follow these rules strictly:

1. FORBIDDEN LANGUAGE — NEVER use these in reasoning or assessment:
   - Personality adjectives: "sympathique", "nice", "charismatique", "charming", "driven", "passionate"
   - Appearance-related comments (even implicit)
   - Assumptions about personal life, age, family situation
   - Gut feelings: "I feel", "seems like", "gives the impression", "donne l'impression"
   - Cultural stereotypes or nationality assumptions
   - Gender-coded language: "rockstar", "ninja", "aggressive", "bossy", "nurturing"

2. MANDATORY FOCUS — Evaluate ONLY these VERIFIABLE dimensions:
   ✓ Technical skills (frameworks, languages, tools — evidenced by projects or experience)
   ✓ Professional experience (duration, complexity, responsibilities — from CV text)
   ✓ Education & certifications (institutions, degrees, completion dates — from CV text)
   ✓ Concrete achievements (metrics, deployments, users, contributions — cited from CV)
   ✓ Motivation signals (career choices, learning trajectory, side projects — inferred from FACTS, not tone)
   ✓ Skill progression (increasing complexity over time — from chronological evidence)

3. MOTIVATION EVALUATION — HOW TO ASSESS WITHOUT SUBJECTIVITY:
   - "Side projects in domain X" → motivation signal (objective fact)
   - "Self-taught technology Y" → learning initiative (objective fact)
   - "Career switch from A to B with relevant training" → deliberate growth (objective fact)
   - "3 projects deployed in 12 months" → execution velocity (objective metric)
   - Do NOT say "passionné par le code" — say "Démontre un engagement via 5 projets personnels déployés"

4. WEAKNESSES — MUST be skill/experience gaps, NOT personality critiques:
   ✓ "Aucune expérience avec [technologie requise]" — skill gap
   ✓ "Pas de preuve de déploiement en production" — evidence gap  
   ✓ "Formation dans un domaine non lié au poste" — qualification gap
   ✗ "Manque de dynamisme" — subjective
   ✗ "Ne semble pas motivé" — subjective
   ✗ "CV peu soigné" — subjective (say "CV contains formatting artifacts from OCR" if applicable)

5. STRENGTHS — MUST cite concrete evidence:
   ✓ "3 ans d'expérience en React dont 2 projets avec >1000 utilisateurs" — evidence-backed
   ✓ "Migration PostgreSQL → architecture microservices documentée" — evidence-backed
   ✗ "Excellent communicant" — unverifiable from CV alone
   ✗ "Très bon leadership" — unverifiable from CV alone

6. CONFIDENCE CALIBRATION:
   - If a claim in the CV cannot be verified (no links, no repos, no employer name), mention it:
     "Claimed [skill] — non vérifiable (pas de lien/repo/employeur cité)"
   - Adjust confidence scores DOWN when evidence is thin
   - Never inflate scores to be "encouraging" or deflate them based on personal impression

═══ 3-STEP CV ANALYSIS METHODOLOGY ═══
You MUST apply this systematic 3-step methodology for every candidate evaluation:

▶ STEP 1 — RAPID SCAN & ELIMINATION FILTER:
First, scan the CV for MINIMUM VIABLE CRITERIA. Eliminate immediately if ALL of these fail:
- Job title/intitulé matches the position domain (not exact match, but domain overlap)
- Total experience duration (salaried + project-based) is within 50% of target seniority
- Education level meets the position's minimum threshold
- Geographic location is compatible (remote allowed unless explicitly stated otherwise)
- At least 3 keyword overlaps between CV skills and position requirements
State in overallAssessment: "Step 1 — Scan rapide: [PASS/FAIL] — [brief reason]"

▶ STEP 2 — DEEP ANALYSIS:
If the CV passes Step 1, perform a chronological deep analysis:
- Career progression: Is there evidence of increasing responsibility, team size, project complexity?
- Skill coherence: Do the claimed skills align with the described experience? (flag inconsistencies)
- Technology depth: Superficial keyword mentions vs genuine hands-on evidence (deployments, repos, metrics)
- Gap analysis: What is EXPLICITLY missing vs the position requirements? (distinguish "missing" from "not mentioned")
- Project quality over quantity: 1 well-described deployed project > 5 vague mentions
State in overallAssessment: "Step 2 — Analyse approfondie: [key findings in 1 sentence]"

▶ STEP 3 — EVALUATION GRID:
Create a structured comparison grid in your mind (not in JSON), evaluating:
1. Technical skills match → score 0-100 (Technical Skills category)
2. Professional experience quality → score 0-100 (Professional Experience category)
3. Education & certifications adequacy → score 0-100 (Education category)
4. Cultural fit & soft skills indicators → score 0-100 (Cultural Fit category)
5. Career trajectory & growth potential → score 0-100 (Career Trajectory category)
6. Production readiness evidence → score 0-100 (Production Readiness category)
7. Proof of execution (concrete deliverables) → score 0-100 (POE category)

For each criterion, assign a weight based on the position's requirements.
The OVERALL score MUST be the weighted average of all 7 category scores.
State in overallAssessment: "Step 3 — Grille d'évaluation: [weighted score] / 100"

CRITICAL: The overallAssessment field MUST be a concise, actionable verdict in clean professional language. Do NOT include methodology markers (no "Step 1/2/3", no scores, no formulas).

═══ EXPERIENCE REQUALIFICATION RULES ═══
Traditional HR scoring undervalues non-salaried experience. Apply these rules silently in your scoring:

1. PERSONAL/SIDE PROJECTS COUNT AS EXPERIENCE:
   - A deployed, publicly accessible project (with URL, users, or GitHub repo) = semi-professional experience.
   - Building and maintaining a full-stack app solo demonstrates MORE autonomy than many junior salaried roles.

2. SIMULATED PROFESSIONAL EXPERIENCE:
   Projects with deployment + users + real business logic = simulated professional experience.
   Apply these multipliers internally when converting project-based work to experience equivalent:
   - Simple project (static site, basic CRUD): 0.5x experience equivalent
   - Complex project (auth, payments, multi-role, API integrations): 1.0x experience equivalent
   - Multi-module project (microservices, mobile+web, admin dashboard): 1.2x experience equivalent

3. DO NOT penalize candidates for lacking "X years of salaried experience" if they demonstrate:
   - Real projects with production deployment
   - Technical complexity and architectural decisions
   - End-to-end ownership (design → build → deploy → maintain)

═══ TECHNOLOGY EQUIVALENCE RULES ═══
When the job requires technology X but the candidate uses equivalent technology Y, award PARTIAL CREDIT automatically (apply silently in your scoring):

- Supabase / Firebase / PocketBase → Backend (Node.js-like): +70% credit
- Firebase / Supabase Auth → Authentication expertise: +80% credit
- Deployed on Netlify/Vercel/Railway/Fly.io → DevOps/CI-CD: +60% credit
- React ↔ Vue ↔ Angular ↔ Svelte: +80% cross-framework credit
- PostgreSQL ↔ MySQL ↔ MongoDB: +70% cross-DB credit
- REST ↔ GraphQL: +75% cross-API credit
- Docker/containers → Infrastructure: +70% credit
- Payment integration (Stripe, etc.) → Security awareness: +60% credit

═══ TECHNICAL INFERENCE RULES ═══
Infer technical skills from project context, not just explicit keyword mentions. Apply silently in scoring:

- Supabase/Firebase usage → backend understanding (DB design, auth, APIs, RLS)
- REST API or GraphQL implementation → server-side development capability
- TypeScript + React/Vue/Angular → modern frontend proficiency
- Git + collaboration tools → team-ready workflow
- Authentication implementation → security fundamentals
- Deployed live app with real URL → DevOps + CI/CD awareness

═══ IMPLICIT INFERENCE SCORING — GLOBAL RULE ═══
If a candidate has delivered a COMPLETE FUNCTIONAL SYSTEM, implicit competencies may receive a MODEST bonus. Apply internally, do NOT mention the bonus mechanism in reasoning.

⚠️ CRITICAL CONSTRAINTS — MANDATORY (apply silently):
- Inference ≠ Proof. "Can probably do" ≠ "confirmed mastery".
- Total implicit bonus per category ≤ 30% of that category's BASE score.
- Each implicit signal can only boost ONE category (no double-counting from the same project evidence).
- Professional Experience HARD CAP: ≤ 80 without salaried/freelance experience.
- Career Trajectory HARD CAP: ≤ 85.
- If NO salaried experience detected: apply -10 to -15 global friction across all categories.

Signal priority (assign each signal to the HIGHEST priority category only):
1. Proof of Execution (highest priority)
2. Production Readiness
3. Technical Skills (lowest priority)

1. IMPLICIT DevOps (assign to Production Readiness ONLY):
   IF project deployed in production → modest bonus to Production Readiness (max +10 raw, capped at 30% of base).

2. IMPLICIT Backend (assign to Proof of Execution ONLY):
   IF Supabase/Firebase + auth + business logic → modest bonus to Proof of Execution (max +10 raw, capped at 30% of base).

3. IMPLICIT Architecture (assign to Technical Skills ONLY):
   IF multi-module project (frontend + backend + DB) → modest bonus to Technical Skills (max +10 raw, capped at 30% of base).

═══ MARKET CALIBRATION ═══
Use this reference to ensure scores are realistic:
- 90+: Senior confirmed (5+ years production, team leadership, system design)
- 80-89: Solid mid-level (2-5 years, production experience, growing autonomy)
- 70-79: Advanced junior (0-2 years salaried, strong projects, deployed apps)
- <70: Junior (learning phase, limited production evidence)

═══ PRODUCTION READINESS EVALUATION ═══
Evaluate:
- Has the candidate deployed anything to production?
- Are there real users or is it demo-only?
- Evidence of monitoring, error handling, logging, or performance optimization?
- Evidence of iterative improvement (v2, bug fixes, feature additions)?
- Security awareness (auth, input validation, HTTPS, env vars)?

═══ PROOF OF EXECUTION (POE) — CRITICAL CATEGORY ═══
This is a dedicated category that measures CONCRETE EVIDENCE of real execution, not claims.
POE answers: "Did this person actually BUILD and SHIP something?"

Evaluate based on 3 dimensions:
1. ACCESSIBLE PROJECTS (40% of POE):
   - Are projects publicly accessible (live URL, GitHub repo, app store)?
   - Can someone verify the work exists?
   - Score: 0 if no links/evidence, 50 if GitHub only, 80 if live deployed, 100 if live + users

2. REAL COMPLEXITY (30% of POE):
   - Is the project technically non-trivial? (auth, payments, multi-user, APIs, real-time)
   - Does it solve a real problem vs. tutorial copy-paste?
   - Score: 0-30 for tutorials/clones, 40-60 for adapted projects, 70-100 for original complex apps

3. ARCHITECTURE COHERENCE (30% of POE):
   - Is the tech stack appropriate for the problem?
   - Evidence of good practices (separation of concerns, security, testing)?
   - Score: estimate from project descriptions and tech choices

JOB POSITION:
${positionSummary}${internshipGuidance}${targetLevelGuidance}

CANDIDATE PROFILE:
Name: ${safeName}
Email: ${safeEmail}

${safeProfileText}
${weightInstructions}

ANALYSIS INSTRUCTIONS:
1. Evaluate the candidate across 7 key categories with precise scores (0-100)
2. For each category, write the reasoning as clean, professional prose a hiring manager would read. NEVER mention multipliers, percentages, formulas, caps, inference tags, or methodology notes. Describe what the candidate has and what's missing in plain language.
3. Apply TECHNICAL INFERENCE silently: deduce skills from project context
4. Apply TECHNOLOGY EQUIVALENCE silently: award partial credit for equivalent technologies
5. Apply EXPERIENCE REQUALIFICATION silently: deployed projects = simulated professional experience
6. Apply PROOF OF EXECUTION silently: score based on accessible projects, real complexity, architecture coherence
7. Apply IMPLICIT INFERENCE SCORING silently: credit DevOps/Backend/Architecture bonuses
8. Identify 4-6 concrete strengths that directly match the position requirements
9. Identify 3-5 specific areas for improvement or concerns${isInternship ? ' (remember: for internships, focus on growth potential)' : ''}
10. Provide a comprehensive overall assessment (2-3 sentences) that balances strengths and weaknesses — clean, actionable, no methodology jargon

SCORING GUIDELINES${isInternship ? ' FOR INTERNSHIP' : ''} (target: ${targetLevel}):
- 90-100: Exceptional fit, exceeds all requirements${isInternship ? ' with outstanding potential' : ''}, production-proven
- 80-89: Strong fit, meets all key requirements, has real-world project evidence
- 70-79: Good fit, meets most requirements, some production experience
- 60-69: Adequate fit, meets basic requirements but limited real-world evidence
- 50-59: Marginal fit, mostly theoretical knowledge, limited hands-on evidence
- Below 50: Poor fit, does not meet core requirements

Return ONLY valid JSON in this exact format (all text in ${targetLang}):
{
  "score": <number 0-100>,
  "scoreBreakdown": [
    {"category": "Technical Skills", "score": <0-100>, "reasoning": "<specific evidence + inferred skills + tech equivalence applied>"},
    {"category": "Professional Experience", "score": <0-100>, "reasoning": "<salaried + project-based experience, requalified per rules, state multipliers>"},
    {"category": "Education & Certifications", "score": <0-100>, "reasoning": "<specific evidence from profile>"},
    {"category": "Cultural Fit & Soft Skills", "score": <0-100>, "reasoning": "<specific evidence from profile>"},
    {"category": "Career Trajectory & Growth", "score": <0-100>, "reasoning": "<autonomy, complexity progression, learning velocity>"},
    {"category": "Production Readiness", "score": <0-100>, "reasoning": "<deployment evidence, real users, stability, monitoring, security awareness>"},
    {"category": "Proof of Execution", "score": <0-100>, "reasoning": "<accessible projects (40%), real complexity (30%), architecture coherence (30%)>"}
  ],
  "strengths": ["<concrete strength 1>", "<concrete strength 2>", "<concrete strength 3>", "<concrete strength 4>"],
  "weaknesses": ["<specific concern 1>", "<specific concern 2>", "<specific concern 3>"],
  "overallAssessment": "<2-3 phrase professional verdict summarizing the candidate. Focus on: key strengths, main gaps, and a clear recommendation (hire / interview / reject). Do NOT include technical details about scoring methodology, inference bonuses, hard caps, or friction. Keep it concise and actionable.>"
}`

  try {
    const analysisModel = getLLMModel('analysis')
    const analysisResult = await llm(analysisPrompt, analysisModel, true)

    // Extract JSON from potential markdown code fences
    let jsonText = analysisResult.trim()
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim()
    }

    let analysis: any
    try {
      analysis = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', jsonText.substring(0, 500))
      throw new Error('LLM response is not valid JSON')
    }

    if (typeof analysis.score !== 'number' || !analysis.scoreBreakdown || !Array.isArray(analysis.strengths) || !Array.isArray(analysis.weaknesses)) {
      console.error('Invalid analysis structure received:', JSON.stringify(analysis).substring(0, 500))
      throw new Error('Invalid analysis response structure')
    }

    // Recalculate weighted score (don't trust LLM arithmetic)
    const categoryScoreMap: Record<string, number> = {}
    for (const item of analysis.scoreBreakdown) {
      categoryScoreMap[item.category] = item.score
    }
    const weightMap: [keyof ScoreWeights, string][] = SCORE_WEIGHT_KEYS.map(k => [k, SCORE_CATEGORY_MAP[k]])
    let weightedTotal = 0
    let weightSum = 0
    for (const [wKey, catName] of weightMap) {
      const catScore = categoryScoreMap[catName]
      if (typeof catScore === 'number') {
        weightedTotal += catScore * effectiveWeights[wKey]
        weightSum += effectiveWeights[wKey]
      }
    }
    if (weightSum > 0) {
      analysis.score = Math.round(weightedTotal / weightSum)
    }

    // Apply implicit inference bonuses (programmatic safety net on top of LLM prompt rules)
    let finalAnalysis = applyImplicitInferenceBonuses(analysis, candidate.profileText, effectiveWeights)

    // ─── POST-ANALYSIS SCORE SANITY CHECK ───
    // Even with prompt defense, verify the LLM didn't get manipulated
    const sanityCheck = validateScoreSanity(
      finalAnalysis.score,
      candidate.profileText,
      isInternship
    )
    if (sanityCheck.suspicious) {
      finalAnalysis = {
        ...finalAnalysis,
        score: sanityCheck.cappedScore,
        overallAssessment: finalAnalysis.overallAssessment + 
          ` [Score plafonné: ${sanityCheck.originalScore}→${sanityCheck.cappedScore}]`,
      }
      // Ajouter la détection au scan de défense
      if (defense.riskLevel === 'none' || defense.riskLevel === 'low') {
        defense.riskLevel = 'medium'
        defense.suspiciousCount++
        defense.detections.push(sanityCheck.reason)
        defense.modified = true
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(defense as any).riskReason = sanityCheck.reason
      }
    }

    // Cache the result
    setCachedAnalysis(cacheKey, finalAnalysis)

    return { ...finalAnalysis, promptDefense: defense }
  } catch (error) {
    console.error('AI Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to analyze candidate: ${message}`)
  }
}

export async function findAlternativePositions(
  candidate: Candidate,
  currentPosition: Position,
  otherPositions: Position[],
  currentScore: number,
  language: Language
): Promise<AlternativePosition[] | undefined> {
  if (otherPositions.length === 0 || currentScore >= 75 || currentScore < 40) {
    return undefined
  }

  const isEnglish = language === 'en'
  const targetLang = isEnglish ? 'ENGLISH' : 'FRENCH'
  
  const otherPositionsSummary = otherPositions
    .slice(0, 6)
    .map((p) => `- ${sanitizeShortText(p.title)}: ${sanitizeShortText(p.requirements.substring(0, 250))}`)
    .join('\n')
  
  // Appliquer la défense anti-prompt au texte candidat
  const defenseAlt = defendPrompt(candidate.profileText, candidate.name)
  const candidateSkillsSummary = defenseAlt.sanitized.substring(0, 1200)
  
  const alternativesPrompt = `The candidate scored ${currentScore}/100 for "${currentPosition.title}". Analyze if they might be a significantly better fit for other open positions. Respond in ${targetLang}.

IMPORTANT:
- Be evidence-based and conservative. Do not invent facts.
- If the profile text comes from OCR, expect noise; rely only on clear evidence.
- Output ONLY valid JSON (no markdown, no extra text).

CANDIDATE KEY QUALIFICATIONS:
${candidateSkillsSummary}

OTHER OPEN POSITIONS:
${otherPositionsSummary}

EVALUATION CRITERIA:
- Only suggest positions where the candidate would likely score at least 15 points higher
- Focus on matching core skills and experience, not just keywords
- Consider career trajectory and growth potential
- Be selective - quality over quantity

Return ONLY valid JSON in this format (text in ${targetLang}):
{
  "alternatives": [
    {
      "positionTitle": "<exact position title from list above>",
      "estimatedScore": <realistic number 0-100>,
      "reasoning": "<specific reasons why this position is a significantly better fit>"
    }
  ]
}

If no positions offer a significantly better match (15+ points higher), return an empty array.`

  try {
    const fastModel = getLLMModel('fast')
    const alternativesResult = await llm(alternativesPrompt, fastModel, true)

    let jsonText = alternativesResult.trim()
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim()
    }

    const alternativesData = JSON.parse(jsonText)
    
    if (!alternativesData.alternatives || !Array.isArray(alternativesData.alternatives)) {
      return undefined
    }

    if (alternativesData.alternatives.length === 0) {
      return undefined
    }

    const matchedAlternatives = alternativesData.alternatives
      .map((alt: any) => {
        const pos = otherPositions.find(
          (p) => p.title === alt.positionTitle || 
                 p.title.toLowerCase().includes(alt.positionTitle.toLowerCase()) ||
                 alt.positionTitle.toLowerCase().includes(p.title.toLowerCase())
        )
        
        if (!pos) return null
        
        return {
          positionId: pos.id,
          positionTitle: pos.title,
          reasoning: alt.reasoning,
        }
      })
      .filter((alt: any) => alt !== null)

    return matchedAlternatives.length > 0 ? matchedAlternatives : undefined
  } catch (error) {
    console.error('Alternative positions analysis error (non-critical):', error)
    return undefined
  }
}

export function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).length
  return Math.ceil(words * 1.3)
}

export function validateAnalysisInput(
  name: string,
  email: string,
  profileText: string
): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Name is required' }
  }
  
  if (!email.trim() || !email.includes('@')) {
    return { valid: false, error: 'Valid email is required' }
  }
  
  if (!profileText.trim()) {
    return { valid: false, error: 'Profile text is required' }
  }
  
  if (profileText.trim().length < 50) {
    return { valid: false, error: 'Profile text is too short (minimum 50 characters)' }
  }
  
  const tokenEstimate = estimateTokenCount(profileText)
  if (tokenEstimate > 6000) {
    return { valid: false, error: 'Profile text is too long and will be optimized automatically' }
  }
  
  return { valid: true }
}
