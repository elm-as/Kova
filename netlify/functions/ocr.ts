type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue }

type OcrRequestBody = {
  // Accept either a full data URL (preferred) or a bare base64 string.
  dataUrl?: string
  base64?: string
  // Optional OCR parameters (kept minimal; defaults are sensible).
  language?: string
  ocrEngine?: 1 | 2 | 3
  // Nouveau : support multi-engines dans une seule requete
  engines?: (1 | 2 | 3)[]
  // Nouveau : hints de pretraitement pour optimiser l'OCR
  preprocessHints?: {
    deskew?: boolean
    denoise?: boolean
    grayscale?: boolean
    threshold?: number
    contrast?: number
  }
}

type OcrEngineResponse = {
  engine: 1 | 2 | 3
  text: string
  ocrExitCode: number | null
  processingTimeMs: string | null
  errorMessage?: string
  isErrored: boolean
}

import { checkRateLimit, rateLimitResponse, getClientIp } from './shared/rate-limit'

function getEnv(name: string): string | undefined {
  return process.env[name]
}

function json(statusCode: number, body: JsonValue) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function normalizeDataUrl(body: OcrRequestBody): string | null {
  if (typeof body.dataUrl === 'string' && body.dataUrl.startsWith('data:')) {
    return body.dataUrl
  }

  if (typeof body.base64 === 'string' && body.base64.length > 0) {
    // Assume PDF by default.
    return `data:application/pdf;base64,${body.base64}`
  }

  return null
}

/**
 * Appelle l'API OCR.space pour un engine donne.
 * Inclut une logique de retry (max 2 tentatives).
 */
async function callOcrApi(
  dataUrl: string,
  apiKey: string,
  engine: 1 | 2 | 3,
  language: string,
  endpoint: string,
): Promise<OcrEngineResponse> {
  const form = new FormData()
  form.append('base64Image', dataUrl)
  form.append('language', language)
  form.append('OCREngine', String(engine))
  form.append('isOverlayRequired', 'false')
  // Demander la creation d'un PDF avec overlay pour l'engine 2
  form.append('isCreateSearchablePdf', 'false')
  // Filtrer le texte pour eliminer les tableaux (optionnel)
  form.append('detectOrientation', 'true')
  form.append('scale', 'true')

  const maxRetries = 2
  let lastError = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: apiKey,
        },
        body: form,
      })

      const upstreamText = await resp.text()

      if (!resp.ok) {
        lastError = `HTTP ${resp.status}: ${upstreamText.substring(0, 300)}`
        // Si erreur 429 (rate limit) ou 5xx, on retente apres un delai
        if (resp.status === 429 || resp.status >= 500) {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
        }
        return {
          engine,
          text: '',
          ocrExitCode: resp.status,
          processingTimeMs: null,
          errorMessage: lastError,
          isErrored: true,
        }
      }

      const data = JSON.parse(upstreamText) as Record<string, unknown>

      if (data?.IsErroredOnProcessing) {
        const errorMsg = typeof data?.ErrorMessage === 'string'
          ? data.ErrorMessage
          : 'Unknown OCR error'

        // Si l'erreur est potentiellement transitoire, retenter
        if (attempt < maxRetries && (
          errorMsg.toLowerCase().includes('timeout') ||
          errorMsg.toLowerCase().includes('busy') ||
          errorMsg.toLowerCase().includes('temporary')
        )) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
          continue
        }

        return {
          engine,
          text: '',
          ocrExitCode: typeof data?.OCRExitCode === 'number' ? data.OCRExitCode : null,
          processingTimeMs: null,
          errorMessage: errorMsg,
          isErrored: true,
        }
      }

      const parsedResults = Array.isArray(data?.ParsedResults) ? data.ParsedResults as Array<Record<string, unknown>> : []
      const text = parsedResults
        .map((r: Record<string, unknown>) => (typeof r?.ParsedText === 'string' ? r.ParsedText : ''))
        .filter(Boolean)
        .join('\n')
        .trim()

      const processingTime = typeof data?.ProcessingTimeInMilliseconds === 'string'
        ? data.ProcessingTimeInMilliseconds
        : String(data?.ProcessingTimeInMilliseconds ?? '')

      return {
        engine,
        text,
        ocrExitCode: typeof data?.OCRExitCode === 'number' ? data.OCRExitCode : null,
        processingTimeMs: processingTime || null,
        isErrored: false,
      }
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
  }

  return {
    engine,
    text: '',
    ocrExitCode: null,
    processingTimeMs: null,
    errorMessage: lastError,
    isErrored: true,
  }
}

/**
 * Fusionne les resultats de plusieurs engines en un texte unique.
 * Strategie : prendre le meilleur resultat (le plus long avec le plus de mots reels).
 */
function mergeEngineResults(results: OcrEngineResponse[]): string {
  const validResults = results.filter((r) => !r.isErrored && r.text.length > 20)

  if (validResults.length === 0) {
    // Prendre le moins mauvais
    const bestOfErrors = results
      .filter((r) => r.text.length > 0)
      .sort((a, b) => b.text.length - a.text.length)
    return bestOfErrors.length > 0 ? bestOfErrors[0].text : ''
  }

  if (validResults.length === 1) {
    return validResults[0].text
  }

  // Choisir le meilleur resultat base sur la qualite du texte
  let best = validResults[0]
  let bestScore = 0

  for (const result of validResults) {
    const text = result.text
    const wordCount = text.split(/\s+/).length
    const realWords = text.split(/\s+/).filter((w) => /^[a-zA-ZÀ-ÿ\-']{2,}$/.test(w))
    const realWordRatio = wordCount > 0 ? realWords.length / wordCount : 0
    const score = text.length * 0.3 + realWordRatio * 500 + wordCount * 0.2

    if (score > bestScore) {
      bestScore = score
      best = result
    }
  }

  return best.text
}

/**
 * Genere des conseils de pretraitement pour le client,
 * bases sur l'analyse du resultat OCR.
 */
function generatePreprocessingHints(body: OcrRequestBody, results: OcrEngineResponse[]): Record<string, unknown> {
  const hints: Record<string, unknown> = {}

  // Si tous les engines ont echoue ou donne peu de texte
  const totalTextLength = results.reduce((sum, r) => sum + r.text.length, 0)
  const hasSuccess = results.some((r) => !r.isErrored && r.text.length > 50)

  if (!hasSuccess) {
    hints.shouldPreprocess = true
    hints.recommendedActions = ['increase_contrast', 'apply_grayscale', 'apply_threshold', 'deskew']
    hints.suggestedThreshold = 140
    hints.suggestedContrast = 1.3
  }

  // Si un seul engine a bien fonctionne, suggerer d'utiliser celui-la
  const workingEngines = results.filter((r) => !r.isErrored && r.text.length > 50)
  if (workingEngines.length === 1) {
    hints.recommendedEngine = workingEngines[0].engine
  }

  // Si le texte contient beaucoup de caracteres non-ASCII corrompus
  const allText = results.map((r) => r.text).join(' ')
  const nonAsciiRatio = (allText.match(/[^\x20-\x7EÀ-ÿ\s]/g) || []).length / Math.max(allText.length, 1)
  if (nonAsciiRatio > 0.1) {
    hints.hasCorruptedChars = true
    hints.shouldPreprocess = true
    hints.recommendedActions = [...(hints.recommendedActions as string[] || []), 'apply_denoise']
  }

  // Si le texte semble etre du charabia (trop de mots courts)
  const words = allText.split(/\s+/).filter((w) => w.length > 0)
  const shortWordRatio = words.filter((w) => w.length <= 2).length / Math.max(words.length, 1)
  if (shortWordRatio > 0.3 && words.length > 20) {
    hints.lowQualityText = true
    hints.shouldPreprocess = true
  }

  hints.totalEnginesUsed = results.length
  hints.successfulEngines = workingEngines.length
  hints.bestEngine = workingEngines.length > 0 ? workingEngines.sort((a, b) => b.text.length - a.text.length)[0].engine : null

  return hints
}

export const handler = async (event: Record<string, unknown>) => {
  // Gerer les requetes CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, apikey',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  // Rate limit: 15 OCR requests per minute per IP
  const ip = getClientIp(event)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetAt)
  }

  const apiKey = getEnv('OCR_SPACE_API_KEY')
  if (!apiKey) {
    return json(500, {
      error: 'OCR_SPACE_API_KEY is not set. Configure it in Netlify environment variables.',
    })
  }

  let body: OcrRequestBody
  try {
    body = event.body ? (JSON.parse(event.body as string) as OcrRequestBody) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const dataUrl = normalizeDataUrl(body)
  if (!dataUrl) {
    return json(400, { error: 'Missing dataUrl (or base64)' })
  }

  const endpoint = getEnv('OCR_SPACE_ENDPOINT') || 'https://api.ocr.space/parse/image'
  const language = body.language ?? 'auto'

  // Determiner les engines a utiliser
  // Si "engines" est fourni (tableau), on les utilise tous
  // Sinon, on utilise le engine unique (ocrEngine) ou le defaut (2)
  const engines: (1 | 2 | 3)[] = body.engines && body.engines.length > 0
    ? body.engines
    : [(body.ocrEngine ?? 2)]

  // Lancer l'OCR sur chaque engine en parallele
  const enginePromises = engines.map((engine) =>
    callOcrApi(dataUrl, apiKey, engine, language, endpoint)
  )

  const engineResults = await Promise.all(enginePromises)

  // Fusionner les resultats
  const mergedText = mergeEngineResults(engineResults)

  // Generer des hints de pretraitement
  const preprocessHints = generatePreprocessingHints(body, engineResults)

  // Calculer le temps total de traitement
  const totalTimeMs = engineResults.reduce(
    (sum, r) => sum + (r.processingTimeMs ? parseInt(r.processingTimeMs, 10) || 0 : 0),
    0,
  )

  // Statistiques
  const successfulEngines = engineResults.filter((r) => !r.isErrored && r.text.length > 20)
  const failedEngines = engineResults.filter((r) => r.isErrored || r.text.length <= 20)

  // Si tous les engines ont echoue
  if (mergedText === '' && successfulEngines.length === 0) {
    const errors = failedEngines.map((r) => ({
      engine: r.engine,
      error: r.errorMessage || 'No text extracted',
    }))

    return json(502, {
      error: 'All OCR engines failed to extract text',
      engineErrors: errors,
      preprocessHints,
      suggestion: 'Essayez de pre-traiter l\'image (augmenter le contraste, convertir en niveaux de gris, appliquer un seuil) avant de l\'envoyer a l\'OCR.',
    })
  }

  // Construire la reponse enrichie
  const response: Record<string, JsonValue> = {
    // Champ principal (retrocompatibilite)
    text: mergedText,

    // Nouveaux champs : resultats par engine
    engineResults: engineResults.map((r) => ({
      engine: r.engine,
      text: r.text,
      ocrExitCode: r.ocrExitCode,
      processingTimeMs: r.processingTimeMs,
      ...(r.isErrored ? { error: r.errorMessage } : {}),
    })),

    // Metadonnees
    mergedFromEngines: engines.length > 1,
    enginesUsed: engines,
    totalProcessingTimeMs: totalTimeMs,
    successfulEngines: successfulEngines.length,
    failedEngines: failedEngines.length,

    // Hints
    preprocessHints,

    // Stats globales
    ocrExitCode: engineResults[0]?.ocrExitCode ?? null,
    processingTimeMs: String(totalTimeMs),
  }

  return json(200, response)
}
