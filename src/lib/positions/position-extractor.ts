import { Position, TargetLevel, Language } from '@/lib/types'
import { llm } from '@/lib/llmClient'
import { extractTextFromFile } from '@/lib/fileUtils'

export interface ExtractedPositionDraft {
  title: string
  description: string
  requirements: string
  openings: number
  isInternship: boolean
  targetLevel: TargetLevel
  contractType?: string
  location?: string
  keySkills: string[]
  confidence: number
  sourceSummary?: string
}

export interface JobSourceInput {
  file?: File | null
  text?: string
}

/**
 * Convertit un fichier en DataURL Base64 pour l'envoi OCR.
 */
async function convertFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'))
    reader.readAsDataURL(file)
  })
}

/**
 * Extrait le texte d'une image d'affiche de poste via l'API OCR.
 */
async function extractTextFromImageFile(file: File): Promise<string> {
  const dataUrl = await convertFileToDataUrl(file)
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, ocrEngine: 2, language: 'fre' }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Échec de l'OCR (${response.status}): ${errorText.substring(0, 150)}`)
  }

  const result = await response.json() as { text?: string }
  const rawText = result?.text?.trim() || ''

  if (rawText.length < 15) {
    throw new Error("L'affiche ne contient pas assez de texte lisible pour l'analyse. Vérifiez la netteté de l'image.")
  }

  return rawText
}

/**
 * Extrait le texte brut depuis une source : texte direct, image d'affiche ou document.
 */
export async function extractTextFromJobSource(input: JobSourceInput): Promise<string> {
  if (input.text && input.text.trim().length >= 15) {
    return input.text.trim()
  }

  if (!input.file) {
    throw new Error("Veuillez fournir une affiche ou un texte d'annonce.")
  }

  const file = input.file
  const fileName = file.name.toLowerCase()
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/.test(fileName)

  if (isImage) {
    return extractTextFromImageFile(file)
  }

  const documentResult = await extractTextFromFile(file)
  if (!documentResult.text || documentResult.text.trim().length < 15) {
    throw new Error('Le document fourni ne contient pas assez de texte lisible.')
  }

  return documentResult.text.trim()
}

/**
 * Fallback heuristique pour extraire les sections si le LLM est indisponible.
 */
function parsePositionWithHeuristics(rawText: string): ExtractedPositionDraft {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const fullLower = rawText.toLowerCase()

  const detectedTitle = lines.find((line) => {
    const l = line.toLowerCase()
    return /^(poste|titre|recherche|recrutement|offre)\s*[:\-]/i.test(l) ||
      (line.length >= 5 && line.length <= 70 && !/^(nous|notre|date|contact|email)/i.test(l))
  })?.replace(/^(poste|titre|offre)\s*[:\-]\s*/i, '').trim() || lines[0] || 'Poste sans titre'

  const isInternship = /\b(stage|stagiaire|internship|alternance|contrat pro)\b/i.test(fullLower)
  const isJunior = /\b(junior|débutant|0-2 ans|bac\+2|bac\+3)\b/i.test(fullLower)
  const isSenior = /\b(senior|lead|expert|responsable|directeur|5\+ ans|7\+ ans)\b/i.test(fullLower)
  const targetLevel: TargetLevel = isJunior ? 'junior' : isSenior ? 'senior' : 'mid'

  const openingsMatch = rawText.match(/(\d+)\s*(postes?|ouvertures?|places?|recrutements?)/i)
  const openings = openingsMatch ? Math.max(1, parseInt(openingsMatch[1], 10)) : 1

  return {
    title: detectedTitle,
    description: lines.slice(0, 10).join('\n'),
    requirements: lines.slice(10, 25).join('\n') || lines.join('\n'),
    openings,
    isInternship,
    targetLevel,
    contractType: isInternship ? 'Stage' : 'CDI',
    keySkills: ['Polyvalence', 'Organisation'],
    confidence: 0.65,
    sourceSummary: 'Extraction heuristique locale (mode de secours)',
  }
}

/**
 * Analyse et structure le texte d'une annonce ou affiche avec l'IA.
 */
export async function extractPositionWithAi(
  rawText: string,
  language: Language = 'fr'
): Promise<ExtractedPositionDraft> {
  const prompt = `Tu es un expert RH et ATS. Analyse le texte suivant issu d'une affiche d'emploi ou d'un message d'annonce de recrutement (reçu par WhatsApp, LinkedIn, email ou affiche scannée).

Extrais et structure fidèlement les sections requises en JSON strict.

TEXTE SOURCE DE L'ANNONCE :
"""
${rawText.slice(0, 6000)}
"""

Réponds UNIQUEMENT avec un objet JSON respectant scrupuleusement cette structure :
{
  "title": "Intitulé officiel et concis du poste (ex: Développeur React Fullstack, Responsable Logistique...)",
  "description": "Description claire et professionnelle des missions principales et responsabilités du poste. Utilise des tirets '-' pour lister les missions de manière structurée.",
  "requirements": "Qualifications, profil recherché, formations exigées, années d'expérience et compétences indispensables. Utilise des tirets '-' pour aérer.",
  "openings": 1,
  "isInternship": false,
  "targetLevel": "junior" | "mid" | "senior",
  "contractType": "CDI" | "CDD" | "Stage" | "Alternance" | "Freelance" | "Autre",
  "location": "Ville ou pays (ou 'Télétravail' si mentionné, sinon vide)",
  "keySkills": ["Compétence 1", "Compétence 2", "Compétence 3"]
}

Règles impératives :
- targetLevel doit valoir 'junior', 'mid' ou 'senior'.
- isInternship doit être true si stage, alternance ou contrat d'apprentissage.
- openings doit être un entier >= 1 (1 si non spécifié).
- Réponds en ${language === 'en' ? 'Anglais' : language === 'es' ? 'Espagnol' : 'Français'}.
- Zéro texte hors du JSON.`

  try {
    const rawJson = await llm(prompt, undefined, true)
    const cleanedJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanedJson) as Partial<ExtractedPositionDraft>

    if (!parsed.title || !parsed.description) {
      throw new Error('Réponse IA incomplète')
    }

    const safeLevel: TargetLevel = parsed.targetLevel === 'junior' || parsed.targetLevel === 'senior'
      ? parsed.targetLevel
      : 'mid'

    return {
      title: parsed.title.trim(),
      description: parsed.description.trim(),
      requirements: (parsed.requirements || parsed.description).trim(),
      openings: typeof parsed.openings === 'number' && parsed.openings > 0 ? parsed.openings : 1,
      isInternship: Boolean(parsed.isInternship),
      targetLevel: safeLevel,
      contractType: parsed.contractType || 'CDI',
      location: parsed.location || '',
      keySkills: Array.isArray(parsed.keySkills) ? parsed.keySkills.slice(0, 8) : [],
      confidence: 0.95,
      sourceSummary: 'Analyse IA réussie et structurée',
    }
  } catch (error) {
    console.warn('[position-extractor] Fallback heuristique activé:', error)
    return parsePositionWithHeuristics(rawText)
  }
}

/**
 * Construit un objet Position complet à partir du draft extrait.
 */
export function buildPositionFromDraft(
  draft: ExtractedPositionDraft,
  companyId: string
): Position {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 9)

  return {
    id: `pos_${timestamp}_${randomSuffix}`,
    companyId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    requirements: draft.requirements.trim(),
    openings: draft.openings > 0 ? draft.openings : 1,
    createdAt: timestamp,
    status: 'active',
    isInternship: draft.isInternship,
    targetLevel: draft.targetLevel,
  }
}
