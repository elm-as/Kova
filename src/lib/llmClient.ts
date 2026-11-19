type SupportedModel = string | undefined

export function llmPrompt(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce(
    (result, str, i) => result + str + (values[i] ?? ""),
    ""
  )
}

function pickLanguage(prompt: string): "fr" | "en" {
  if (/\bLanguage:\s*French\b/i.test(prompt) || /Respond in\s+FRENCH/i.test(prompt)) return "fr"
  if (/\bLanguage:\s*English\b/i.test(prompt) || /Respond in\s+ENGLISH/i.test(prompt)) return "en"
  return "fr"
}

function safeMatch(prompt: string, re: RegExp) {
  const m = prompt.match(re)
  return m?.[1]?.trim()
}

function mockQuestions(prompt: string, countRange: [number, number]) {
  const lang = pickLanguage(prompt)
  const job = safeMatch(prompt, /\bJOB:\s*(.+)\s*\n/i) || safeMatch(prompt, /\bPosition:\s*(.+)\s*\n/i)
  const topic = job ? ` (${job})` : ""

  const baseFr = [
    `Expliquez un concept clé du poste${topic} et comment vous l'appliquez.`,
    `Décrivez une situation où vous avez résolu un problème technique complexe${topic}.`,
    `Quelles méthodes utilisez-vous pour valider/évaluer votre travail${topic} ?`,
    `Comment vous assurez-vous de la qualité (tests, vérifications, relecture)${topic} ?`,
    `Donnez un exemple d'outil/technique que vous maîtrisez${topic} et pourquoi.`,
    `Comment gérez-vous un cas limite ou une contrainte inattendue${topic} ?`,
    `Si vous deviez améliorer un processus existant${topic}, que feriez-vous ?`,
    `Présentez une approche structurée pour analyser un nouveau sujet${topic}.`,
  ]

  const baseEn = [
    `Explain a key concept for the role${topic} and how you apply it.`,
    `Describe a situation where you solved a complex technical problem${topic}.`,
    `What methods do you use to validate/evaluate your work${topic}?`,
    `How do you ensure quality (tests, reviews, checks)${topic}?`,
    `Give an example of a tool/technique you master${topic} and why.`,
    `How do you handle an edge case or an unexpected constraint${topic}?`,
    `If you had to improve an existing process${topic}, what would you do?`,
    `Walk me through a structured approach to learn a new topic${topic}.`,
  ]

  const base = lang === "en" ? baseEn : baseFr
  const [min, max] = countRange
  const n = Math.min(max, Math.max(min, 6))
  return base.slice(0, n)
}

function mockFollowUps(prompt: string) {
  const lang = pickLanguage(prompt)
  const question = safeMatch(prompt, /\bQUESTION:\s*([\s\S]+?)\n\s*ANSWER:\s*/i)

  if (lang === "en") {
    return [
      question ? `Can you clarify what you mean by: "${question}"?` : "Can you clarify your approach?",
      "What assumptions did you make, and how would you verify them?",
      "What edge cases could break your solution?",
      "How would you test or validate your answer in practice?",
    ]
  }

  return [
    question ? `Pouvez-vous préciser ce que vous entendez par : « ${question} » ?` : "Pouvez-vous préciser votre démarche ?",
    "Quelles hypothèses avez-vous faites et comment les vérifier ?",
    "Quels cas limites pourraient invalider votre réponse ?",
    "Comment tester/valider concrètement cette réponse ?",
  ]
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function mockAnswerScoring(prompt: string) {
  const lang = pickLanguage(prompt)
  const answer = safeMatch(prompt, /\bANSWER:\s*([\s\S]+?)\n\s*Score\s*0-100/i) || ""
  const len = answer.trim().length

  // Heuristique simple: plus c'est détaillé, plus c'est élevé.
  const completeness = clamp(Math.round((len / 600) * 100), 20, 95)
  const technicalDepth = clamp(completeness - 5, 15, 95)
  const accuracy = clamp(completeness - 10, 10, 95)
  const overallScore = Math.round((technicalDepth + accuracy + completeness) / 3)

  const feedback =
    lang === "en"
      ? "Local dev scoring (heuristic): refine with real LLM for accuracy."
      : "Score en mode dev local (heuristique) : affiner avec un vrai LLM pour plus de précision."

  const strengths =
    lang === "en"
      ? ["Clear structure", "Addresses the main point"]
      : ["Structure claire", "Traite le point principal"]

  const improvements =
    lang === "en"
      ? ["Add concrete examples", "Mention edge cases"]
      : ["Ajouter des exemples concrets", "Mentionner les cas limites"]

  return {
    technicalDepth,
    accuracy,
    completeness,
    overallScore,
    feedback,
    strengths,
    improvements,
  }
}

function mockEmail(prompt: string) {
  const lang = pickLanguage(prompt)
  const candidate = safeMatch(prompt, /\bCandidate:\s*(.+)\s*\n/i) || ""
  const position = safeMatch(prompt, /\bPosition:\s*(.+)\s*\n/i) || ""
  const emailType = /Email Type:.*rejection/i.test(prompt)
    ? "rejection"
    : /Email Type:.*invitation/i.test(prompt)
      ? "invitation"
      : "shortlist"

  if (lang === "en") {
    if (emailType === "rejection") {
      return `Subject: Update on your application\n\nHello ${candidate || ""},\n\nThank you for your interest in the ${position || "position"} role. After careful review, we will not be moving forward at this time.\n\nWe appreciate the time you invested and encourage you to apply again in the future.\n\nBest regards,\nRecruitment Team`
    }
    if (emailType === "invitation") {
      return `Subject: Interview invitation — ${position || ""}\n\nHello ${candidate || ""},\n\nWe would like to invite you to an interview for the ${position || "position"} role.\n\nNext steps:\n- Reply with your availability\n- We will confirm the schedule and format\n\nBest regards,\nRecruitment Team`
    }
    return `Subject: Candidate shortlist — ${candidate || ""} (${position || ""})\n\nHello,\n\nHere is a brief shortlist summary for ${candidate || "the candidate"} for the ${position || "role"} position.\n\nKey points:\n- Overall score and assessment available in the dashboard\n- Strengths and interview performance summarized in the evaluation\n\nBest regards,\nRecruitment Team`
  }

  if (emailType === "rejection") {
    return `Subject: Suite à votre candidature\n\nBonjour ${candidate || ""},\n\nMerci pour votre intérêt pour le poste « ${position || ""} ». Après étude de votre candidature, nous ne donnerons pas suite pour le moment.\n\nNous vous remercions pour le temps consacré et vous encourageons à postuler à de futures opportunités.\n\nCordialement,\nL'équipe recrutement`
  }
  if (emailType === "invitation") {
    return `Subject: Invitation à un entretien — ${position || ""}\n\nBonjour ${candidate || ""},\n\nNous souhaitons vous inviter à un entretien pour le poste « ${position || ""} ».\n\nProchaines étapes :\n- Répondez avec vos disponibilités\n- Nous confirmerons le créneau et le format\n\nCordialement,\nL'équipe recrutement`
  }
  return `Subject: Shortlist — ${candidate || ""} (${position || ""})\n\nBonjour,\n\nVoici une synthèse pour ${candidate || "le candidat"} concernant le poste « ${position || ""} ».\n\nPoints clés :\n- Score global et évaluation disponibles dans le tableau de bord\n- Forces et performance entretien résumées dans la fiche candidat\n\nCordialement,\nL'équipe recrutement`
}

function mockJson(prompt: string) {
  if (/\{"questions"\s*:\s*\[/.test(prompt)) {
    const isFollowUp = /\bFOLLOW-UP\b|follow-up/i.test(prompt)
    const questions = isFollowUp ? mockFollowUps(prompt) : mockQuestions(prompt, [6, 8])
    return JSON.stringify({ questions })
  }
  if (/\"technicalDepth\"/.test(prompt) && /\"overallScore\"/.test(prompt)) {
    return JSON.stringify(mockAnswerScoring(prompt))
  }
  // Fallback générique JSON
  return JSON.stringify({ ok: true })
}

async function callServerLlm(
  prompt: string,
  modelName?: SupportedModel,
  jsonMode?: boolean
): Promise<string> {
  const effectiveModel = modelName || import.meta.env.VITE_LLM_MODEL_DEFAULT
  const resp = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model: effectiveModel,
      jsonMode: Boolean(jsonMode),
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(
      `Server LLM request failed: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ""}`
    )
  }

  const data = (await resp.json()) as any
  const content = data?.content
  if (typeof content !== "string") {
    throw new Error("Server LLM returned invalid payload")
  }
  return content
}

/**
 * In DEV: call the LLM API directly via Vite proxy (bypasses Netlify Function 30s timeout).
 */
async function callDirectLlm(
  prompt: string,
  modelName?: SupportedModel,
  jsonMode?: boolean
): Promise<string> {
  const primaryModel = modelName || import.meta.env.VITE_LLM_MODEL_DEFAULT
  // Si le modèle principal dépasse son quota TPM (429), basculer automatiquement sur un modèle alternatif
  const modelsToTry = [
    primaryModel,
    ...(primaryModel !== 'openai/gpt-oss-20b' ? ['openai/gpt-oss-20b'] : []),
    ...(primaryModel !== 'qwen/qwen3.8-27b' ? ['qwen/qwen3.8-27b'] : []),
  ]

  const systemPrompt = import.meta.env.VITE_LLM_SYSTEM_PROMPT || 'You are a helpful assistant.'
  const TIMEOUT_MS = 60_000

  // Multi-key rotation support (e.g. multiple free tier Groq keys)
  const apiKeysRaw = import.meta.env.VITE_LLM_API_KEYS || import.meta.env.VITE_LLM_API_KEY || ''
  const apiKeys = apiKeysRaw.split(',').map((k: string) => k.trim()).filter(Boolean)

  if (apiKeys.length === 0) {
    throw new Error('VITE_LLM_API_KEY is not set. Direct LLM calls require an API key in dev mode.')
  }

  let lastError: Error | null = null

  for (const model of modelsToTry) {
    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: jsonMode ? 0.3 : 1.0,
      top_p: 1.0,
      max_tokens: 2048,
      stream: false,
    }

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' }
    }

    const jsonBody = JSON.stringify(requestBody)

    for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
      const currentKey = apiKeys[keyIndex]
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        console.log(`[LLM] Calling ${model} via /llm-proxy (key #${keyIndex + 1}/${apiKeys.length})`)
        const resp = await fetch('/llm-proxy/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentKey}`,
          },
          body: jsonBody,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (resp.status === 429) {
          console.warn(`[LLM] Model ${model} rate limited (429) on key #${keyIndex + 1}`)
          if (keyIndex + 1 < apiKeys.length) continue
          // Si toutes les clés pour ce modèle ont été épuisées, essayer le modèle suivant
          break
        }

        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          console.error('[LLM] Request failed:', resp.status, resp.statusText, text.substring(0, 300))
          if (keyIndex + 1 < apiKeys.length) continue
          lastError = new Error(`Direct LLM failed (${resp.status}): ${text.substring(0, 200)}`)
          break
        }

        const rawText = await resp.text()
        const data = JSON.parse(rawText)
        const content = data?.choices?.[0]?.message?.content
        if (typeof content !== 'string') {
          throw new Error('Direct LLM returned invalid payload')
        }
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)
        console.log(`[LLM] Response received with ${model} in ${elapsed}s (${content.length} chars)`)
        return content
      } catch (err: any) {
        clearTimeout(timeoutId)
        lastError = err
        if (keyIndex + 1 < apiKeys.length) continue
      }
    }
  }

  throw lastError || new Error('LLM: all models and API keys exhausted.')
}

export async function llm(
  prompt: string,
  modelName?: SupportedModel,
  jsonMode?: boolean
): Promise<string> {
  if (import.meta.env.DEV) {
    const useServerInDev = import.meta.env.VITE_LLM_USE_SERVER_IN_DEV !== '0'
    if (useServerInDev) {
      // Use direct proxy to LLM API (bypasses Netlify Function 30s timeout)
      return callDirectLlm(prompt, modelName, jsonMode)
    }
    return jsonMode ? mockJson(prompt) : mockEmail(prompt)
  }

  // Production: call via Netlify Function
  return callServerLlm(prompt, modelName, jsonMode)
}
