import { classifyDocument } from './documentClassifier';
import type { DocumentType, DocumentLanguage, ClassificationResult } from './documentClassifier';
import { extractFields, getFieldNames, fieldsToKeyValuePairs } from './fieldExtractor';
import type { ExtractionResult, ExtractedFields } from './fieldExtractor';
import { preprocessImage, extractTablesFromText } from './ocrPipeline';

interface ExtractedSection {
  skills: string[]
  experience: string[]
  education: string[]
  profile: string[]
  languages: string[]
  certifications: string[]
  projects: string[]
  achievements: string[]
  other: string[]
}

function extractKeyInformation(text: string): ExtractedSection {
  const sections: ExtractedSection = {
    skills: [],
    experience: [],
    education: [],
    profile: [],
    languages: [],
    certifications: [],
    projects: [],
    achievements: [],
    other: []
  }
  
  const skillKeywords = /\b(compétence|skill|technolog|langage|language|framework|tool|outil|maîtrise|expertise|programming|développement|development|stack|api|database|frontend|backend|fullstack)/i
  const experienceKeywords = /\b(expérience|experience|poste|position|travail|work|emploi|job|mission|années|years|depuis|since|responsable|responsible|manager|développeur|developer|engineer|ingénieur)/i
  const educationKeywords = /\b(formation|education|diplôme|degree|université|university|école|school|étude|master|licence|bachelor|bac|phd|doctorat|ingénieur)/i
  const profileKeywords = /\b(profil|profile|résumé|summary|objectif|objective|about|à propos|présentation|introduction|passionné|passionate)/i
  const languageKeywords = /\b(langue|language|anglais|english|français|french|espagnol|spanish|bilingue|bilingual|courant|fluent|natif|native)/i
  const certificationKeywords = /\b(certification|certified|certificate|diplôme|award|prix|distinction|accréditation|accredited)/i
  const projectKeywords = /\b(projet|project|réalisation|achievement|développé|developed|créé|created|construit|built|application|site|plateforme|platform|système|system)/i
  const achievementKeywords = /\b(réussite|success|amélioration|improvement|augmentation|increase|réduction|reduction|optimisation|optimization|résultat|result|impact|performance)/i
  
  const lines = text.split(/[\n\r]+|\.(?=\s+[A-Z])/)
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.length < 15) continue
    
    const lowercaseLine = trimmedLine.toLowerCase()
    
    if (skillKeywords.test(lowercaseLine)) {
      sections.skills.push(trimmedLine)
    }
    if (experienceKeywords.test(lowercaseLine)) {
      sections.experience.push(trimmedLine)
    }
    if (educationKeywords.test(lowercaseLine)) {
      sections.education.push(trimmedLine)
    }
    if (profileKeywords.test(lowercaseLine)) {
      sections.profile.push(trimmedLine)
    }
    if (languageKeywords.test(lowercaseLine)) {
      sections.languages.push(trimmedLine)
    }
    if (certificationKeywords.test(lowercaseLine)) {
      sections.certifications.push(trimmedLine)
    }
    if (projectKeywords.test(lowercaseLine)) {
      sections.projects.push(trimmedLine)
    }
    if (achievementKeywords.test(lowercaseLine)) {
      sections.achievements.push(trimmedLine)
    }
  }
  
  return sections
}

function buildStructuredSummary(sections: ExtractedSection): string {
  let summary = ''
  
  if (sections.profile.length > 0) {
    summary += 'PROFIL: ' + sections.profile.slice(0, 3).join('. ') + '\n\n'
  }
  
  if (sections.skills.length > 0) {
    summary += 'COMPÉTENCES: ' + sections.skills.slice(0, 25).join('. ') + '\n\n'
  }
  
  if (sections.experience.length > 0) {
    summary += 'EXPÉRIENCE: ' + sections.experience.slice(0, 20).join('. ') + '\n\n'
  }
  
  if (sections.projects.length > 0) {
    summary += 'PROJETS: ' + sections.projects.slice(0, 15).join('. ') + '\n\n'
  }
  
  if (sections.achievements.length > 0) {
    summary += 'RÉALISATIONS: ' + sections.achievements.slice(0, 10).join('. ') + '\n\n'
  }
  
  if (sections.education.length > 0) {
    summary += 'FORMATION: ' + sections.education.slice(0, 8).join('. ') + '\n\n'
  }
  
  if (sections.certifications.length > 0) {
    summary += 'CERTIFICATIONS: ' + sections.certifications.slice(0, 8).join('. ') + '\n\n'
  }
  
  if (sections.languages.length > 0) {
    summary += 'LANGUES: ' + sections.languages.slice(0, 5).join('. ') + '\n\n'
  }
  
  return summary.trim()
}

export function optimizeTextForAnalysis(text: string, maxTokens: number = 4500): string {
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
  
  const words = cleanedText.split(/\s+/)
  const estimatedTokens = Math.ceil(words.length * 1.3)
  
  if (estimatedTokens <= maxTokens) {
    return cleanedText
  }
  
  const sections = extractKeyInformation(cleanedText)
  const structuredSummary = buildStructuredSummary(sections)
  
  const summaryWords = structuredSummary.split(/\s+/)
  const summaryTokens = Math.ceil(summaryWords.length * 1.3)
  
  if (summaryTokens <= maxTokens) {
    return structuredSummary
  }
  
  const maxWords = Math.floor(maxTokens / 1.3)
  const truncatedWords = summaryWords.slice(0, maxWords)
  return truncatedWords.join(' ')
}

/**
 * Check if extracted text looks like real readable content vs corrupted PDF data.
 * Returns true if the text has enough real words to be usable.
 */
function isTextReadable(text: string): boolean {
  if (!text || text.length < 50) return false

  // Split into words and check how many are real dictionary-like words (3+ alpha chars)
  const words = text.split(/\s+/).filter(w => w.length >= 3)
  const readableWords = words.filter(w => /^[a-zA-ZÀ-ÿ\-']+$/.test(w))
  const ratio = words.length > 0 ? readableWords.length / words.length : 0

  // At least 40% of 3+ char tokens should be real words
  return ratio >= 0.4 && readableWords.length >= 10
}

async function extractTextWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')

  // Use the bundled worker for Vite compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    if (pageText.trim()) {
      pages.push(pageText.trim())
    }
  }

  return pages.join('\n')
}

function cleanPDFText(rawText: string): string {
  let text = rawText
    .replace(/stream[\s\S]*?endstream/gi, '')
    .replace(/obj[\s\S]*?endobj/gi, '')
    .replace(/<<[\s\S]*?>>/g, '')
    .replace(/\/[A-Z][a-zA-Z0-9]*/g, '')
    .replace(/\[[\d\s.]+\]/g, '')
    .replace(/\(([^()]+)\)/g, '$1')
    .replace(/\d{10,}/g, '')
    .replace(/[^\x20-\x7EÀ-ÿ\n\r\t]/g, ' ')
  
  text = text
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => {
      if (line.length < 2) return false
      if (/^[\d\s\-_.]+$/.test(line)) return false
      if (/^[A-Z]{10,}$/.test(line)) return false
      return true
    })
    .join('\n')
  
  text = text.replace(/\s+/g, ' ').trim()
  
  const sentences = text.split(/(?<=[.!?])\s+/)
  const meaningfulSentences = sentences.filter(s => {
    const words = s.split(/\s+/)
    return words.length >= 3 && /[a-zA-ZÀ-ÿ]{3,}/.test(s)
  })
  
  return meaningfulSentences.join(' ')
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'))
    reader.readAsDataURL(file)
  })
}

async function tryOcrPdfViaApi(file: File): Promise<string | null> {
  try {
    const dataUrl = await fileToDataUrl(file)
    const resp = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, ocrEngine: 2, language: 'auto' }),
    })

    if (!resp.ok) {
      return null
    }

    const data = (await resp.json()) as any
    const text = typeof data?.text === 'string' ? data.text.trim() : ''
    if (text.length < 50) return null
    return text
  } catch {
    return null
  }
}

/**
 * Client-side OCR fallback: render PDF pages to canvas images,
 * then send each image to the OCR API. Works better than sending
 * the raw PDF when it contains scanned images.
 */
async function tryOcrViaCanvasRendering(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfjsLib = await import('pdfjs-dist')

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const pageTexts: string[] = []
    const maxPages = Math.min(pdf.numPages, 5) // Limit to 5 pages for performance

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 }) // Higher scale = better OCR

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      await (page.render({ canvas, canvasContext: ctx, viewport } as any).promise)

      // Convert canvas to data URL and send to OCR API
      const imageDataUrl = canvas.toDataURL('image/png')

      try {
        const resp = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: imageDataUrl, ocrEngine: 2, language: 'auto' }),
        })

        if (resp.ok) {
          const data = (await resp.json()) as any
          const text = typeof data?.text === 'string' ? data.text.trim() : ''
          if (text.length > 20) {
            pageTexts.push(text)
          }
        }
      } catch {
        // Skip this page
      }

      // Clean up
      canvas.width = 0
      canvas.height = 0
    }

    const fullText = pageTexts.join('\n')
    return fullText.length >= 50 ? fullText : null
  } catch {
    return null
  }
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  // Keep a copy because pdfjs may detach (transfer) the original buffer
  const bufferCopy = arrayBuffer.slice(0)

  // 1. Try pdf.js structured extraction first (handles most PDFs correctly)
  let text = ''
  try {
    text = await extractTextWithPdfJs(arrayBuffer)
  } catch {
    // pdf.js extraction failed, will try fallbacks
  }

  // 2. If pdf.js returned readable text, use it
  if (isTextReadable(text)) {
    return optimizeTextForAnalysis(text)
  }

  // 3. Fallback: Python backend OCR (PaddleOCR — Tier 2, pour PDF scannés)
  try {
    const pythonText = await extractWithPythonBackend(file)
    if (pythonText && isTextReadable(pythonText)) {
      return optimizeTextForAnalysis(pythonText)
    }
  } catch {
    // Python backend not available or failed — continue to next fallback
  }

  // 4. Fallback: try OCR.space API (Tier 3 — fallback distant si PaddleOCR down)
  const ocrText = await tryOcrPdfViaApi(file)
  if (ocrText && isTextReadable(ocrText)) {
    return optimizeTextForAnalysis(ocrText)
  }

  // 4b. Fallback: render pages to canvas images → OCR each image
  const canvasOcrText = await tryOcrViaCanvasRendering(file)
  if (canvasOcrText && isTextReadable(canvasOcrText)) {
    return optimizeTextForAnalysis(canvasOcrText)
  }

  // 5. Last resort: try the raw byte extraction + cleanup (legacy)
  const uint8Array = new Uint8Array(bufferCopy)
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const rawText = decoder.decode(uint8Array)
  const cleaned = cleanPDFText(rawText)

  if (isTextReadable(cleaned)) {
    return optimizeTextForAnalysis(cleaned)
  }

  throw new Error(
    "Impossible d'extraire le texte du PDF. Le fichier est peut-être protégé, corrompu, ou ne contient que des images. Essayez un autre format (DOCX, TXT) ou un PDF non protégé."
  )
}

export async function extractTextFromHTML(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const html = e.target?.result as string
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        
        const scripts = doc.querySelectorAll('script, style, noscript, iframe, link, meta')
        scripts.forEach(el => el.remove())
        
        const mainContent = doc.querySelector('main, article, .content, #content, body') || doc.body
        
        const text = mainContent.textContent || ''
        
        const cleaned = text
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .trim()
        
        if (cleaned.length < 50) {
          reject(new Error('Le fichier HTML semble vide ou illisible'))
          return
        }
        
        const optimized = optimizeTextForAnalysis(cleaned)
        
        resolve(optimized)
      } catch {
        reject(new Error('Erreur lors de l\'extraction du texte du HTML'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'))
    }
    
    reader.readAsText(file)
  })
}

export async function extractTextFromFile(file: File): Promise<{ text: string; fileType: 'pdf' | 'html' | 'docx' | 'image' | 'txt' }> {
  const fileType = file.type
  const fileName = file.name.toLowerCase()

  // Validate file type by MIME type and magic bytes (permissive — lets unsupported fall through to Python OCR)
  const validationError = await validateFileType(file)
  if (validationError) {
    throw new Error(validationError)
  }

  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const text = await extractTextFromPDF(file)
    return { text, fileType: 'pdf' }
  } else if (fileType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    const text = await extractTextFromHTML(file)
    return { text, fileType: 'html' }
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // DOCX → Tier 1 (python-docx, extraction native, PAS d'OCR)
    // DOCX a toujours du texte natif. python-docx l'extrait instantanément.
    const text = await extractWithPythonBackend(file)
    return { text, fileType: 'docx' }
  } else if (fileName.match(/\.(png|jpg|jpeg|webp)$/) || fileType.startsWith('image/')) {
    // Image: Essai via backend Python en priorité, repli robuste sur OCR.space
    try {
      const text = await extractWithPythonBackend(file)
      return { text, fileType: 'image' }
    } catch {
      const text = await tryOcrPdfViaApi(file)
      if (text && text.trim().length > 10) {
        return { text: optimizeTextForAnalysis(text), fileType: 'image' }
      }
      throw new Error("Impossible d'extraire le texte de l'image. Assurez-vous que l'image est nette ou collez le texte directement.")
    }
  } else if (fileName.endsWith('.txt') || fileType === 'text/plain') {
    // TXT → Tier 1 (lecture native, pas d'OCR)
    try {
      const text = await extractWithPythonBackend(file)
      return { text, fileType: 'txt' }
    } catch {
      const text = await file.text()
      if (!text || text.length < 10) throw new Error('Fichier TXT vide ou illisible')
      return { text: optimizeTextForAnalysis(text), fileType: 'txt' }
    }
  } else {
    throw new Error('Format de fichier non supporté. Utilisez PDF, DOCX, HTML, TXT, PNG ou JPG.')
  }
}

export function validateFileSize(file: File, maxSizeMB: number = 5): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxBytes
}

/**
 * Validate a file by checking its magic bytes against expected MIME types.
 * Returns an error message if invalid, or null if valid.
 */
async function validateFileType(file: File): Promise<string | null> {
  const allowedTypes = [
    'application/pdf',
    'text/html',
    'text/plain',
  ]

  const allowedExtensions = ['.pdf', '.html', '.htm', '.txt', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp']
  const fileName = file.name.toLowerCase()
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext))

  if (!hasValidExtension) {
    return 'Type de fichier non supporté. Utilisez PDF, DOCX, HTML, TXT, PNG ou JPG.'
  }

  // Check magic bytes for PDFs
  if (fileName.endsWith('.pdf')) {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    // PDF magic bytes: %PDF-
    const isPdf = header[0] === 0x25 && header[1] === 0x50 &&
                  header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2D
    if (!isPdf) {
      return 'Le fichier ne semble pas être un PDF valide (signature incorrecte).'
    }
  }

  // HTML files: check for reasonable content (< tags present)
  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    const sample = await file.slice(0, 1000).text()
    if (!/<[a-z][\s\S]*>/i.test(sample)) {
      return 'Le fichier ne semble pas être un HTML valide.'
    }
  }

  return null
}

// ─── Python OCR Backend Integration (PaddleOCR — FREE) ──────────────────────

/**
 * Python OCR backend response structure.
 */
interface PythonOcrResponse {
  candidate_id?: string
  filename: string
  extraction_method: string
  text_length: number
  data: {
    nom_complet?: string | null
    email?: string | null
    telephone?: string | null
    ville?: string | null
    titre_poste_actuel?: string | null
    annees_experience_totale?: number | null
    experiences?: Array<{ poste: string; entreprise: string; date_debut: string | null; date_fin: string | null; description: string | null }>
    formations?: Array<{ diplome: string; etablissement: string; annee: string | null }>
    competences?: string[]
    langues?: Array<{ langue: string; niveau: string | null }>
    confiance_extraction?: string
    texte_brut?: string
    erreur?: string
    note?: string
  }
}

/**
 * Tente d'extraire le texte via le backend Python OCR (PaddleOCR).
 * Fonctionne avec PDF scannés, DOCX, images — tout ce que le frontend JS ne gère pas.
 *
 * @param file - Fichier à envoyer au backend
 * @returns Texte extrait
 */
async function extractWithPythonBackend(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const resp = await fetch('/api/ocr-python/cv/process', {
    method: 'POST',
    body: formData,
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error')
    throw new Error(`OCR Python backend error (${resp.status}): ${errText.substring(0, 300)}`)
  }

  const data: PythonOcrResponse = await resp.json()

  // Si le backend a structuré le texte en JSON, on reconstruit un texte lisible
  if (data.data && !data.data.erreur) {
    const d = data.data
    let text = ''

    if (d.texte_brut) {
      // Le backend n'a pas utilisé de LLM, il renvoie le texte brut
      text = d.texte_brut
    } else {
      // Le backend a structuré → on rebuild un texte pour l'analyse IA
      if (d.nom_complet) text += `NOM: ${d.nom_complet}\n`
      if (d.email) text += `EMAIL: ${d.email}\n`
      if (d.telephone) text += `TEL: ${d.telephone}\n`
      if (d.ville) text += `VILLE: ${d.ville}\n`
      if (d.titre_poste_actuel) text += `POSTE ACTUEL: ${d.titre_poste_actuel}\n`
      if (d.annees_experience_totale) text += `ANNÉES EXPÉRIENCE: ${d.annees_experience_totale}\n`

      if (d.experiences && d.experiences.length > 0) {
        text += '\nEXPÉRIENCES:\n'
        for (const exp of d.experiences) {
          text += `- ${exp.poste} chez ${exp.entreprise}`
          if (exp.date_debut || exp.date_fin) text += ` (${exp.date_debut || '?'} — ${exp.date_fin || 'présent'})`
          if (exp.description) text += `: ${exp.description}`
          text += '\n'
        }
      }

      if (d.formations && d.formations.length > 0) {
        text += '\nFORMATIONS:\n'
        for (const f of d.formations) {
          text += `- ${f.diplome} — ${f.etablissement}`
          if (f.annee) text += ` (${f.annee})`
          text += '\n'
        }
      }

      if (d.competences && d.competences.length > 0) {
        text += '\nCOMPÉTENCES: ' + d.competences.join(', ') + '\n'
      }

      if (d.langues && d.langues.length > 0) {
        text += '\nLANGUES: ' + d.langues.map(l => `${l.langue}${l.niveau ? ` (${l.niveau})` : ''}`).join(', ') + '\n'
      }
    }

    if (text.trim().length < 50) {
      throw new Error('Texte extrait trop court par le backend OCR Python')
    }

    return optimizeTextForAnalysis(text.trim())
  }

  // Fallback : le backend a renvoyé une erreur ou pas de données
  if (data.data?.erreur) {
    throw new Error(`Backend OCR Python: ${data.data.erreur}`)
  }

  throw new Error('Backend OCR Python: réponse invalide (pas de données)')
}

/**
 * Vérifie si le backend Python OCR est disponible.
 */
export async function isPythonOcrAvailable(): Promise<boolean> {
  try {
    const resp = await fetch('/api/ocr-python/health')
    if (!resp.ok) return false
    const data = await resp.json()
    return data?.status === 'ok'
  } catch {
    return false
  }
}

// ─── Nouveautés : Pipeline OCR intelligent ───────────────────────────────────

/**
 * Résultat combiné de l'extraction structurée d'un document.
 */
export interface StructuredDataResult {
  documentType: DocumentType;
  classification: ClassificationResult;
  fields: ExtractedFields;
  extraction: ExtractionResult;
  rawText: string;
  overallConfidence: number;
}

/**
 * Résultat d'extraction avec métadonnées enrichies.
 */
export interface TextWithMetadataResult {
  text: string;
  fileType: 'pdf' | 'html' | 'docx' | 'image' | 'txt';
  documentType: DocumentType;
  language: DocumentLanguage;
  processingTimeMs: number;
  ocrConfidence: number;
  classificationConfidence: number;
  classificationReasoning: string[];
}

/**
 * Extrait les données structurées d'un fichier :
 * 1. Extraction du texte brut
 * 2. Classification du type de document
 * 3. Extraction des champs spécifiques
 *
 * @param file - Fichier à analyser (PDF ou HTML)
 * @returns StructuredDataResult avec le type, la classification, et les champs extraits
 */
export async function extractStructuredData(file: File): Promise<StructuredDataResult> {
  const startTime = performance.now();

  // Étape 1 : Extraire le texte brut
  const { text, fileType } = await extractTextFromFile(file);

  // Étape 2 : Classifier le document
  const classification = classifyDocument(text);

  // Étape 3 : Extraire les champs structurés selon le type
  const extraction = extractFields(text, classification.documentType);

  return {
    documentType: classification.documentType,
    classification,
    fields: extraction.fields,
    extraction,
    rawText: text,
    overallConfidence: Math.round(
      (classification.confidence * 0.4 + extraction.overallConfidence * 0.6) * 100
    ) / 100,
  };
}

/**
 * Extrait le texte d'un fichier avec métadonnées enrichies
 * (type de document, langue, confiance, temps de traitement).
 *
 * @param file - Fichier à analyser (PDF ou HTML)
 * @returns TextWithMetadataResult avec texte + métadonnées
 */
export async function extractTextWithMetadata(file: File): Promise<TextWithMetadataResult> {
  const startTime = performance.now();

  // Extraire le texte via la méthode existante
  const { text, fileType } = await extractTextFromFile(file);

  // Classifier
  const classification = classifyDocument(text);

  const endTime = performance.now();

  return {
    text,
    fileType,
    documentType: classification.documentType,
    language: classification.language,
    processingTimeMs: Math.round((endTime - startTime) * 100) / 100,
    ocrConfidence: 0, // Sera renseigné si l'OCR a été utilisé
    classificationConfidence: classification.confidence,
    classificationReasoning: classification.reasoning,
  };
}

/**
 * Version enrichie de extractTextFromFile qui retourne aussi les métadonnées.
 * Conserve la rétrocompatibilité avec l'API existante.
 *
 * @param file - Fichier à analyser
 * @param withMetadata - Si true, retourne les métadonnées en plus
 */
export async function extractTextFromFileEnhanced(
  file: File,
  withMetadata: true
): Promise<TextWithMetadataResult>;
export async function extractTextFromFileEnhanced(
  file: File,
  withMetadata?: false
): Promise<{ text: string; fileType: 'pdf' | 'html' | 'docx' | 'image' | 'txt' }>;
export async function extractTextFromFileEnhanced(
  file: File,
  withMetadata?: boolean
): Promise<{ text: string; fileType: 'pdf' | 'html' | 'docx' | 'image' | 'txt' } | TextWithMetadataResult> {
  if (withMetadata) {
    return extractTextWithMetadata(file);
  }
  return extractTextFromFile(file);
}

/**
 * Extrait et prétraite une image pour l'OCR (améliore la qualité avant envoi à l'API).
 */
export async function preprocessImageForOcr(dataUrl: string): Promise<string> {
  return preprocessImage(dataUrl, {
    contrast: 1.3,
    grayscale: true,
    denoise: true,
    deskew: true,
    threshold: 140,
  });
}

/**
 * Détecte les tableaux dans le texte extrait.
 */
export function detectTables(text: string) {
  return extractTablesFromText(text);
}

/**
 * Récupère la liste des champs pertinents pour un type de document donné.
 */
export function getRelevantFieldNames(documentType: DocumentType): string[] {
  return getFieldNames(documentType);
}

/**
 * Convertit les champs extraits en paires clé-valeur pour affichage.
 */
export function extractFieldPairs(fields: ExtractedFields) {
  return fieldsToKeyValuePairs(fields);
}
