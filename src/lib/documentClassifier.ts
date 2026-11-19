/**
 * documentClassifier.ts - Classificateur intelligent de types de documents
 *
 * Analyse le texte extrait d'un document pour déterminer son type
 * (CV, Lettre de motivation, Diplôme, Certificat, Relevé de notes, Pièce d'identité, Autre),
 * la langue du document, et fournit un score de confiance.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'cv'
  | 'cover_letter'
  | 'diploma'
  | 'certificate'
  | 'academic_transcript'
  | 'id_document'
  | 'other';

export type DocumentLanguage = 'fr' | 'en' | 'es' | 'unknown';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number; // 0-1
  language: DocumentLanguage;
  typeScores: Record<DocumentType, number>; // Scores bruts pour chaque type
  reasoning: string[];
}

// ─── Labels (FR par défaut) ──────────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: 'CV / Resume',
  cover_letter: 'Lettre de motivation',
  diploma: 'Diplôme',
  certificate: 'Certificat / Attestation',
  academic_transcript: 'Relevé de notes',
  id_document: 'Pièce d\'identité',
  other: 'Autre',
};

// ─── Règles de détection par type ────────────────────────────────────────────

interface DetectionRule {
  keywords: RegExp[];
  sectionHeaders: RegExp[];
  structuralPatterns: RegExp[];
  antiKeywords: RegExp[]; // Mots-clés qui réduisent le score de ce type
  weight: number; // Poids du type dans le scoring global
}

const DETECTION_RULES: Record<DocumentType, DetectionRule> = {
  cv: {
    keywords: [
      /\b(expérience|experience|expériences|experiences)\b/i,
      /\b(compétence|skill|compétences|skills?)\b/i,
      /\b(formation|education|éducation|études|studies)\b/i,
      /\b(cv|curriculum vitae|resume|résumé)\b/i,
      /\b(profil|profile|profil professionnel)\b/i,
      /\b(emploi|job|poste|position|work)\b/i,
      /\b(référence|reference|références|references)\b/i,
      /\b(loisir|hobby|loisirs|hobbies|centres d'intérêt|interests)\b/i,
      /\b(linkedin|github)\b/i,
    ],
    sectionHeaders: [
      /^(expérience|experience|expériences)[\s:]*(professionnelle)?$/im,
      /^(compétence|skill|compétences|skills?)[\s:]*$/im,
      /^(formation|education|éducation|études)[\s:]*$/im,
      /^(langue|language|langues|languages?)[\s:]*$/im,
      /^(profil|profile|résumé|summary)[\s:]*$/im,
      /^(loisirs|hobbies|centres?\s+d['']intérêt|interests?)[\s:]*$/im,
    ],
    structuralPatterns: [
      // Dates suivies de titres de poste : "2018-2020 Développeur chez X"
      /\b\d{4}\s*[-–—àa]\s*\d{4}\b.*\b(développeur|developer|ingénieur|engineer|manager|directeur|consultant|analyste|chef|lead|architecte|designer)\b/im,
      // Pattern "Entreprise | Poste | Date"
      /(?:janvier|january|février|february|mars|march|avril|april|mai|may|juin|june|juillet|july|août|august|septembre|september|octobre|october|novembre|november|décembre|december)\s+\d{4}/i,
      // Email + téléphone (très commun sur un CV)
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}.*(?:\+?\d[\d\s()\-.]{8,}\d)/s,
    ],
    antiKeywords: [],
    weight: 1.0,
  },

  cover_letter: {
    keywords: [
      /\b(madame|monsieur|madame,?\s+monsieur)\b/i,
      /\b(cher|chère|dear|estimado)\b/i,
      /\b(recrutement|recruitment|recrutador|recruteur)\b/i,
      /\b(candidature|application|postuler|apply|candidat)\b/i,
      /\b(lettre de motivation|cover letter|carta de presentación)\b/i,
      /\b(entretien|interview|entrevista|disponible|available)\b/i,
      /\b(veuillez agréer|sincerely|yours faithfully|cordialement|salutations)\b/i,
      /\b(joindre|attach|enclosed|ci-joint|adjunto)\b/i,
      /\b(votre annonce|your advertisement|su anuncio|offre d'emploi|job offer)\b/i,
    ],
    sectionHeaders: [
      /^(objet|subject|asunto|re)[\s:]*$/im,
      /^(madame|monsieur|dear)[,\s]+/im,
      /^(pièce jointe|enclosure|adjunto)[\s:]*$/im,
    ],
    structuralPatterns: [
      // Formule de politesse en fin de document
      /(veuillez\s+agréer|je\s+vous\s+prie|dans\s+l['']attente|sincerely|yours?\s+(faithfully|sincerely|truly)|cordialement|salutations\s+distinguées)/i,
      // Signature block
      /([\w\s]+\n\s*(?:tel|tél|phone|email|courriel)[\s:]+)/i,
    ],
    antiKeywords: [],
    weight: 0.9,
  },

  diploma: {
    keywords: [
      /\b(diplôm|diploma|diplôme|diplomado)\b/i,
      /\b(universit|university|universidad|université)\b/i,
      /\b(délivre|deliver|otorga|décerne|confère|confers|award)\b/i,
      /\b(grade|degree|titre|title|master|licence|bachelor|doctorat|phd)\b/i,
      /\b(mention|honors?|distinction|cum laude|magna|summa)\b/i,
      /\b(académique|academic|académico)\b/i,
      /\b(recteur|président|president|doyen|dean|directeur)\b/i,
      /\b(sceau|seal|sceau officiel)\b/i,
      /\b(arrêté|décret|accreditation|accrédité)\b/i,
    ],
    sectionHeaders: [
      /^(diplôme|diploma)[\s:]*$/im,
      /^(université|university)[\s:]*$/im,
    ],
    structuralPatterns: [
      // "L'Université X certifie que"
      /(l['']université|l['']école|the\s+university)\s+.+\s+(certifie|certify|atteste|attest|décerne)\b/i,
      // Année universitaire
      /année\s+(?:universitaire|académique|scolaire)\s+\d{4}[-–—/]\d{4}/i,
      // "Grade de Master/Licence"
      /\bgrade\s+de\s+(master|licence|doctorat|bachelor)\b/i,
    ],
    antiKeywords: [],
    weight: 1.0,
  },

  certificate: {
    keywords: [
      /\b(certificat|certificate|certificado)\b/i,
      /\b(attestation|attestation de)\b/i,
      /\b(formation\s+(?:professionnelle|continue|complémentaire))\b/i,
      /\b(atteste|certifie|certify|certifies)\b/i,
      /\b(complété|completed|completado|achevé|finished)\b/i,
      /\b(organisme|organization|organisme de formation)\b/i,
      /\b(heures?\s+de\s+formation|training\s+hours?)\b/i,
    ],
    sectionHeaders: [
      /^(certificat|certificate)[\s:]*$/im,
      /^(attestation)[\s:]*$/im,
    ],
    structuralPatterns: [
      /(certifie\s+que|certifies?\s+that|atteste\s+que|attests?\s+that)/i,
      /(a\s+(?:suivi|complété|réussi|completed?|passed?)\s+(?:avec\s+succès|successfully)?)/i,
    ],
    antiKeywords: [
      // Éviter de confondre avec un diplôme
      /\b(diplôme national|diplôme d['']état|diplôme d['']ingénieur)\b/i,
    ],
    weight: 0.85,
  },

  academic_transcript: {
    keywords: [
      /\b(relevé|transcript|transcripción)\b/i,
      /\b(notes|grades|calificaciones|marks)\b/i,
      /\b(gpa|moyenne|average|promedio|moyenne générale)\b/i,
      /\b(crédit|credit|créditos|ects)\b/i,
      /\b(semestre|semester|semestre|trimestre|trimester)\b/i,
      /\b(unité d['']enseignement|ue|course unit|módulo|module)\b/i,
      /\b(relevé de notes|transcript of records)\b/i,
      /\b(bulletin|bulletin de notes|report card)\b/i,
    ],
    sectionHeaders: [
      /^(relevé|transcript)[\s:]*$/im,
      /^(semestre|semester)[\s:]*\d[\s:]*$/im,
      /^(ue|unité)[\s:]*$/im,
    ],
    structuralPatterns: [
      // Lignes avec note/20, GPA sur 4, etc.
      /(?:\d{1,2}[,.]\d{1,2})\s*\/\s*(?:20|10|100|4)/,
      /\b(gpa|moyenne)\s*[:=]?\s*\d{1,2}[,.]\d{1,2}\b/i,
      // Tableaux de notes (lignes répétitives avec matières et notes)
      /^(?:[A-Za-zÀ-ÿ\s]+)\s+\d{1,2}[,.]\d{1,2}\s+\d{1,2}[,.]\d{1,2}\s+(?:A|B|C|D|E|F|PASS|FAIL)/im,
      // Crédits ECTS
      /ects\s*:?\s*\d+/i,
    ],
    antiKeywords: [],
    weight: 0.9,
  },

  id_document: {
    keywords: [
      /\b(passeport|passport|pasaporte)\b/i,
      /\b(carte\s+(?:nationale\s+)?d['']identité|national\s+identity\s+card|cedula)\b/i,
      /\b(identité|identity|identidad)\b/i,
      /\b(permis\s+de\s+conduire|driver[\s']?s?\s+licen[cs]e)\b/i,
      /\b(document\s+d['']identité|id\s+(?:card|document))\b/i,
      /\b(nationalité|nationality|nacionalidad)\b/i,
      /\b(délivr(?:é|ée?)\s+(?:le|par)|issued?\s+(?:on|by)|expedid[oa])\b/i,
      /\b(date\s+de\s+naissance|date\s+of\s+birth|fecha\s+de\s+nacimiento)\b/i,
      /\b(numéro|number|número)\b/i,
    ],
    sectionHeaders: [],
    structuralPatterns: [
      // Format de numéro de passeport (2 lettres + 7 chiffres ou pattern similaire)
      /\b[A-Z]{2}\d{6,9}\b/,
      // Format date de naissance explicite
      /(?:née?|né)\s+(?:le|the)\s+\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/i,
      // Pattern MRZ (Machine Readable Zone) - ligne typique de passeport
      /P<[A-Z]{3}[A-Z<]+\d{9}\d[A-Z]\d{7}/,
    ],
    antiKeywords: [
      // Éviter de confondre un CV contenant la nationalité avec une pièce d'identité
      /\b(expérience|skill|compétence|formation)\b/i,
    ],
    weight: 0.75,
  },

  other: {
    keywords: [],
    sectionHeaders: [],
    structuralPatterns: [],
    antiKeywords: [],
    weight: 0.2,
  },
};

// ─── Détection de langue ─────────────────────────────────────────────────────

const LANGUAGE_PATTERNS: Record<DocumentLanguage, { words: string[]; weight: number }> = {
  fr: {
    words: [
      'le', 'la', 'les', 'des', 'une', 'un', 'et', 'est', 'dans', 'pour',
      'avec', 'sur', 'sont', 'pas', 'que', 'par', 'plus', 'fait', 'ces',
      'expérience', 'formation', 'compétences', 'diplôme', 'candidature',
      'lettre', 'motivation', 'emploi', 'poste', 'entreprise', 'université',
      'monsieur', 'madame', 'veuillez', 'cordialement',
    ],
    weight: 1.0,
  },
  en: {
    words: [
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'are',
      'was', 'not', 'but', 'experience', 'education', 'skills', 'degree',
      'university', 'letter', 'application', 'resume', 'cover', 'job',
      'dear', 'sincerely', 'company', 'position',
    ],
    weight: 1.0,
  },
  es: {
    words: [
      'el', 'la', 'los', 'las', 'una', 'un', 'es', 'por', 'para', 'con',
      'del', 'que', 'más', 'como', 'son', 'las', 'experiencia', 'formación',
      'competencias', 'título', 'universidad', 'carta', 'solicitud',
      'estimado', 'saludos', 'empresa', 'puesto',
    ],
    weight: 1.0,
  },
  unknown: { words: [], weight: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compte le nombre d'occurrences d'un tableau d'expressions régulières dans un texte.
 */
function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Vérifie si au moins un pattern du tableau correspond au texte.
 */
function hasAnyMatch(text: string, patterns: RegExp[]): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((p) => p.test(text));
}

/**
 * Calcule un score pour un type de document donné.
 */
function scoreDocumentType(text: string, rules: DetectionRule, textLength: number): number {
  let score = 0;

  // 1. Mots-clés (poids 35%)
  const keywordMatches = countMatches(text, rules.keywords);
  const keywordScore = Math.min(keywordMatches / 5, 1.0) * 0.35;
  score += keywordScore;

  // 2. En-têtes de section (poids 25%)
  const headerMatches = countMatches(text, rules.sectionHeaders);
  const headerScore = Math.min(headerMatches / 3, 1.0) * 0.25;
  score += headerScore;

  // 3. Patterns structurels (poids 30%)
  const structuralMatches = countMatches(text, rules.structuralPatterns);
  const structuralScore = Math.min(structuralMatches / 3, 1.0) * 0.30;
  score += structuralScore;

  // 4. Bonus lié à la longueur appropriée du document (poids 10%)
  const wordCount = text.split(/\s+/).length;
  // Un CV fait généralement 300-3000 mots, une lettre 200-800, un diplôme 50-300, etc.
  let lengthScore = 0;
  if (wordCount >= 50 && wordCount <= 5000) {
    lengthScore = 0.05;
  }
  if (wordCount >= 100 && wordCount <= 3000) {
    lengthScore = 0.10;
  }
  score += lengthScore;

  // 5. Pénalités anti-keywords (réduction jusqu'à 40%)
  if (hasAnyMatch(text, rules.antiKeywords)) {
    const antiCount = countMatches(text, rules.antiKeywords);
    score *= Math.max(0.3, 1 - antiCount * 0.15);
  }

  // Appliquer le poids du type
  score *= rules.weight;

  return Math.min(score, 1.0);
}

// ─── Classification principale ───────────────────────────────────────────────

/**
 * Classifie un document en fonction de son contenu textuel.
 *
 * @param text - Texte extrait du document
 * @returns ClassificationResult avec le type, la confiance, la langue et le détail des scores
 */
export function classifyDocument(text: string): ClassificationResult {
  if (!text || text.trim().length < 20) {
    return {
      documentType: 'other',
      confidence: 0,
      language: 'unknown',
      typeScores: {
        cv: 0,
        cover_letter: 0,
        diploma: 0,
        certificate: 0,
        academic_transcript: 0,
        id_document: 0,
        other: 1,
      },
      reasoning: ['Texte insuffisant pour la classification (< 20 caractères).'],
    };
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();
  const textLength = cleanText.length;

  // Calculer les scores pour chaque type
  const typeScores: Record<DocumentType, number> = {
    cv: scoreDocumentType(cleanText, DETECTION_RULES.cv, textLength),
    cover_letter: scoreDocumentType(cleanText, DETECTION_RULES.cover_letter, textLength),
    diploma: scoreDocumentType(cleanText, DETECTION_RULES.diploma, textLength),
    certificate: scoreDocumentType(cleanText, DETECTION_RULES.certificate, textLength),
    academic_transcript: scoreDocumentType(cleanText, DETECTION_RULES.academic_transcript, textLength),
    id_document: scoreDocumentType(cleanText, DETECTION_RULES.id_document, textLength),
    other: scoreDocumentType(cleanText, DETECTION_RULES.other, textLength),
  };

  // Déterminer le type avec le meilleur score
  let bestType: DocumentType = 'other';
  let bestScore = typeScores.other;

  for (const [type, score] of Object.entries(typeScores) as [DocumentType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Calculer la confiance normalisée
  const totalScore = Object.values(typeScores).reduce((sum, s) => sum + s, 0);
  const confidence = totalScore > 0
    ? Math.round((bestScore / Math.max(totalScore * 0.6, bestScore)) * 100) / 100
    : 0;

  // Détecter la langue
  const language = detectDocumentLanguage(cleanText);

  // Générer le raisonnement
  const reasoning = buildReasoning(bestType, typeScores, cleanText);

  return {
    documentType: bestType,
    confidence,
    language,
    typeScores,
    reasoning,
  };
}

// ─── Détection de langue ─────────────────────────────────────────────────────

/**
 * Détecte la langue principale d'un document par analyse lexicale.
 */
export function detectDocumentLanguage(text: string): DocumentLanguage {
  if (!text || text.trim().length < 30) return 'unknown';

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/[\s,.;:!?()\[\]{}\-]+/).filter((w) => w.length >= 2);

  const scores: Record<DocumentLanguage, number> = { fr: 0, en: 0, es: 0, unknown: 0 };

  // Compter les correspondances de mots pour chaque langue
  for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
    if (lang === 'unknown') continue;
    const docLang = lang as DocumentLanguage;
    let langWordCount = 0;
    for (const word of config.words) {
      // Compter les occurrences de ce mot dans le texte
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        langWordCount += matches.length;
      }
    }
    // Score proportionnel au pourcentage de mots de cette langue
    const wordRatio = words.length > 0 ? langWordCount / words.length : 0;
    scores[docLang] = Math.min(wordRatio * 10 * config.weight, 1.0);
  }

  // Déterminer la meilleure langue
  let bestLang: DocumentLanguage = 'unknown';
  let bestScore = 0.05; // Seuil minimum

  for (const [lang, score] of Object.entries(scores)) {
    const docLangEntry = lang as DocumentLanguage;
    if (score > bestScore) {
      bestScore = score;
      bestLang = docLangEntry;
    }
  }

  return bestLang;
}

// ─── Raisonnement ────────────────────────────────────────────────────────────

function buildReasoning(
  bestType: DocumentType,
  typeScores: Record<DocumentType, number>,
  text: string,
): string[] {
  const reasoning: string[] = [];

  // Raison sur les scores
  const sorted = (Object.entries(typeScores) as [DocumentType, number][])
    .sort(([, a], [, b]) => b - a);

  reasoning.push(
    `Type détecté : ${DOCUMENT_TYPE_LABELS[bestType]} (score: ${(typeScores[bestType] * 100).toFixed(1)}%)`,
  );

  if (sorted.length > 1 && sorted[1][1] > 0.1) {
    reasoning.push(
      `Deuxième type possible : ${DOCUMENT_TYPE_LABELS[sorted[1][0]]} (score: ${(sorted[1][1] * 100).toFixed(1)}%)`,
    );
  }

  // Raisonnement spécifique au type détecté
  const rules = DETECTION_RULES[bestType];
  const keywordMatches = countMatches(text, rules.keywords);
  const headerMatches = countMatches(text, rules.sectionHeaders);
  const structuralMatches = countMatches(text, rules.structuralPatterns);

  if (keywordMatches > 0) {
    reasoning.push(`Mots-clés caractéristiques trouvés : ${keywordMatches}`);
  }
  if (headerMatches > 0) {
    reasoning.push(`En-têtes de section identifiés : ${headerMatches}`);
  }
  if (structuralMatches > 0) {
    reasoning.push(`Patterns structurels détectés : ${structuralMatches}`);
  }

  return reasoning;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Liste les types de documents supportés.
 */
export function getSupportedDocumentTypes(): DocumentType[] {
  return ['cv', 'cover_letter', 'diploma', 'certificate', 'academic_transcript', 'id_document', 'other'];
}

/**
 * Vérifie si un type de document a besoin d'une extraction de champs poussée.
 */
export function requiresFieldExtraction(docType: DocumentType): boolean {
  return docType !== 'other';
}
