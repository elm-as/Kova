/**
 * fieldExtractor.ts - Extraction structurée des champs par type de document
 *
 * Utilise des patterns regex + heuristiques NLP pour extraire les champs
 * pertinents selon le type de document (CV, Lettre de motivation, Diplôme, etc.).
 * Chaque champ extrait est accompagné d'un score de confiance (0-1).
 */

import type { DocumentType } from './documentClassifier';

// ─── Types communs ───────────────────────────────────────────────────────────

export interface ExtractedField<T = string> {
  value: T;
  confidence: number; // 0-1
  rawMatch: string; // Le texte brut qui a matché
}

export interface ExtractedArrayField<T = string> {
  value: T[];
  confidence: number;
  rawMatches: string[];
}

// ─── Types spécifiques par document ──────────────────────────────────────────

export interface CVFields {
  name: ExtractedField;
  email: ExtractedField;
  phone: ExtractedField;
  location: ExtractedField;
  linkedin: ExtractedField;
  title: ExtractedField; // Intitulé de poste actuel / titre
  skills: ExtractedArrayField;
  experience: ExtractedArrayField<ExperienceEntry>;
  education: ExtractedArrayField<EducationEntry>;
  languages: ExtractedArrayField<LanguageEntry>;
  certifications: ExtractedArrayField;
  summary: ExtractedField; // Résumé / profil
}

export interface CoverLetterFields {
  recipient: ExtractedField;
  recipientCompany: ExtractedField;
  sender: ExtractedField;
  senderEmail: ExtractedField;
  senderPhone: ExtractedField;
  date: ExtractedField;
  subject: ExtractedField;
  body: ExtractedField;
  signature: ExtractedField;
  position: ExtractedField; // Poste visé
}

export interface DiplomaFields {
  institution: ExtractedField;
  degree: ExtractedField;
  fieldOfStudy: ExtractedField;
  date: ExtractedField;
  honors: ExtractedField;
  location: ExtractedField;
  studentName: ExtractedField;
  issuer: ExtractedField; // Autorité émettrice
}

export interface CertificateFields {
  title: ExtractedField;
  issuer: ExtractedField;
  date: ExtractedField;
  recipient: ExtractedField;
  skills: ExtractedArrayField;
  duration: ExtractedField;
  reference: ExtractedField; // Numéro de référence
}

export interface AcademicTranscriptFields {
  institution: ExtractedField;
  studentName: ExtractedField;
  period: ExtractedField; // Période académique
  gpa: ExtractedField;
  courses: ExtractedArrayField<CourseEntry>;
  totalCredits: ExtractedField;
  degree: ExtractedField;
  honors: ExtractedField;
}

export interface IDDocumentFields {
  documentType: ExtractedField; // Passeport, CNI, Permis...
  documentNumber: ExtractedField;
  fullName: ExtractedField;
  birthDate: ExtractedField;
  nationality: ExtractedField;
  expiryDate: ExtractedField;
  issuingAuthority: ExtractedField;
}

export interface OtherFields {
  title: ExtractedField;
  date: ExtractedField;
  author: ExtractedField;
  keyPhrases: ExtractedArrayField;
}

// ─── Types d'entrées structurées ─────────────────────────────────────────────

export interface ExperienceEntry {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
  confidence: number;
}

export interface EducationEntry {
  degree: string;
  school: string;
  year: string;
  fieldOfStudy: string;
  confidence: number;
}

export interface LanguageEntry {
  language: string;
  level: string;
  confidence: number;
}

export interface CourseEntry {
  name: string;
  grade: string;
  credits: string;
  confidence: number;
}

// ─── Type union pour le résultat d'extraction ────────────────────────────────

export type ExtractedFields =
  | { type: 'cv'; fields: CVFields }
  | { type: 'cover_letter'; fields: CoverLetterFields }
  | { type: 'diploma'; fields: DiplomaFields }
  | { type: 'certificate'; fields: CertificateFields }
  | { type: 'academic_transcript'; fields: AcademicTranscriptFields }
  | { type: 'id_document'; fields: IDDocumentFields }
  | { type: 'other'; fields: OtherFields };

export interface ExtractionResult {
  documentType: DocumentType;
  fields: ExtractedFields;
  overallConfidence: number;
  processingTimeMs: number;
  rawText: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extrait la première correspondance d'un pattern regex.
 */
function extractFirst(text: string, patterns: RegExp[]): ExtractedField {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = (match[1] || match[0]).trim();
      // Calculer un score basé sur la position dans les patterns
      const confidence = 1.0 - (patterns.indexOf(pattern) * 0.1);
      return {
        value,
        confidence: Math.max(0.4, Math.min(1.0, confidence)),
        rawMatch: match[0].trim(),
      };
    }
  }
  return { value: '', confidence: 0, rawMatch: '' };
}

/**
 * Extrait toutes les correspondances d'un pattern (avec un groupe de capture).
 */
function extractAll(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  // Créer une copie du pattern avec le flag global
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((match = globalPattern.exec(text)) !== null) {
    results.push((match[1] || match[0]).trim());
  }
  return [...new Set(results)]; // Dédupliquer
}

/**
 * Normalise une chaîne (enlève les espaces multiples, caractères spéciaux communs).
 */
function normalize(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Calcule la confiance d'une extraction basée sur la présence et qualité des résultats.
 */
function computeArrayConfidence(results: string[], expectedMin: number = 1): number {
  if (results.length === 0) return 0;
  const ratio = Math.min(results.length / expectedMin, 1.0);
  return Math.round(ratio * 100) / 100;
}

// ─── Extraction CV ───────────────────────────────────────────────────────────

function extractCVFields(text: string): CVFields {
  const name = extractFirst(text, [
    // Nom en haut du document (typiquement les 200 premiers caractères)
    /^(?:[A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+){1,3})/m,
    // Format "Nom Prénom" sur une ligne dédiée avec majuscules
    /^([A-Z][A-Z\s]+)\s*\n/m,
    // Pattern "Name:" ou "Nom :"
    /(?:nom|name|prénom)\s*[:=]\s*([A-Za-zÀ-ÿ\s\-']{2,40})/im,
    // Première ligne significative après un saut de ligne
    /^([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+)/m,
  ]);

  const email = extractFirst(text, [
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
    /(?:email|courriel|e-mail|mail)[\s:]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
  ]);

  const phone = extractFirst(text, [
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/,
    /(?:t[ée]l|phone|mobile|portable|cell)[\s.:]*([+\d][\d\s()\-.]{7,20})/i,
  ]);

  const location = extractFirst(text, [
    /(?:adresse|address|localisation|location|ville|city|basé à|based in)[\s:]*([A-Za-zÀ-ÿ\s,\-']{3,60})/im,
    /(?:Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Lille|Strasbourg|London|New York|Berlin|Madrid|Barcelona|Montr[eé]al|Bruxelles|Gen[eè]ve|Casablanca|Tunis|Alger)/i,
  ]);

  const linkedin = extractFirst(text, [
    /(?:linkedin\.com\/in\/|linkedin[: ]+)([A-Za-z0-9\-_]+)/i,
    /(https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_]+\/?/i,
  ]);

  const title = extractFirst(text, [
    // Format "Développeur Full Stack" sur une ligne après le nom
    /(?:^|\n)([A-Z][a-zÀ-ÿ]+(?: [A-Z][a-zÀ-ÿ]+){1,5})\s*(?:\n|$)/m,
    /(?:titre|title|poste|position)[\s:]*([A-Za-zÀ-ÿ\s\/\-&]+)/im,
    /(?:développeur|developer|ingénieur|engineer|consultant|analyste|architecte|designer|chef de projet|product manager|data scientist|devops)[a-zÀ-ÿ\s]*/i,
  ]);

  // Compétences
  const rawSkills: string[] = [];

  // 1. Section "Compétences" / "Skills" explicite
  const skillsSectionMatch = text.match(
    /(?:comp[eé]tences|skills?|technologies?|stack technique|outils|tools?)[\s:]*\n([\s\S]*?)(?:\n\s*\n|\n(?:exp[eé]rience|experience|formation|education|langues?|languages?|loisirs|hobbies|projets?|projects?|certifications?|r[eé]f[eé]rences?)\b)/im
  );
  if (skillsSectionMatch) {
    // Extraire les mots individuels et les combos
    const sectionText = skillsSectionMatch[1];
    const skillWords = sectionText.split(/[,;•·\-\|\/\n]+/).map(s => s.trim()).filter(s => s.length > 1 && !/^[et|&]+$/.test(s));
    rawSkills.push(...skillWords);
  }

  // 2. Mots-clés techniques dispersés dans le texte
  const techPatterns = [
    /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Ruby|Go|Rust|PHP|Swift|Kotlin|Scala|R|MATLAB)\b/g,
    /\b(React|Angular|Vue\.?js|Node\.?js|Express|Django|Flask|Spring|Laravel|Rails|\.NET|FastAPI)\b/gi,
    /\b(SQL|MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch|Cassandra|DynamoDB|Oracle|SQLite)\b/gi,
    /\b(Docker|Kubernetes|AWS|Azure|GCP|Terraform|Ansible|Jenkins|GitLab|GitHub Actions|CI\/CD)\b/gi,
    /\b(Git|Linux|REST|GraphQL|gRPC|WebSocket|Microservices|Agile|Scrum|Kanban)\b/gi,
    /\b(HTML5?|CSS3?|SASS|LESS|Tailwind|Bootstrap|Material[-\s]?UI)\b/gi,
    /\b(Machine Learning|Deep Learning|NLP|Computer Vision|TensorFlow|PyTorch|scikit-learn|Pandas|NumPy)\b/gi,
    /\b(Figma|Sketch|Adobe XD|Photoshop|Illustrator|InDesign|Premiere)\b/gi,
  ];

  for (const pattern of techPatterns) {
    const matches = text.match(pattern);
    if (matches) rawSkills.push(...matches);
  }

  // Dédupliquer et nettoyer
  const skills = [...new Set(rawSkills.map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 60))];

  // Expérience professionnelle
  const experiences: ExperienceEntry[] = [];
  const expSectionMatch = text.match(
    /(?:exp[eé]rience|experience|exp[eé]riences? professionnelles?|professional experience|emploi|work experience|parcours professionnel)[\s:]*\n([\s\S]*?)(?:\n\s*\n\s*(?:formation|education|[eé]ducation|[eé]tudes|comp[eé]tences|skills?|langues?|languages?|loisirs|hobbies|projets?|projects?|certifications?|r[eé]f[eé]rences?)\b|$)/im
  );

  const expText = expSectionMatch ? expSectionMatch[1] : text;

  // Patterns pour identifier des blocs d'expérience
  const expBlockPatterns = [
    // "Jan 2020 - Dec 2022 | Developer | Company"
    /(\d{4}\s*[-–—àa]\s*(?:\d{4}|présent|present|aujourd['']hui|today|actuel))\s*[-–—|/:]?\s*([^,\n]{3,80}?)\s*[-–—|/:]?\s*([^,\n]{3,60}?)(?=\n|$)/gi,
    // "Company, Title (dates)"
    /([A-Z][A-Za-zÀ-ÿ\s&.,]{3,60})\s*[-–—|/:]?\s*([A-Za-zÀ-ÿ\s&\/]{3,60})\s*[-–—|/:]?\s*(\d{4}\s*[-–—àa]\s*\d{4})/g,
    // "Title at Company"
    /(développeur|developer|ingénieur|engineer|consultant|analyste|manager|directeur|lead|architecte|designer|chef de projet|product owner|scrum master)[a-zÀ-ÿ\s]*(?:chez|at|@|pour|for)\s+([A-Za-zÀ-ÿ\s&.,]{2,50})/gi,
  ];

  // Approche simplifiée : chercher les périodes date-date suivies de texte
  const dateJobPattern = /(\d{4})\s*[-–—àa]\s*((?:\d{4}|présent|present|actuel|aujourd['']hui|today))\s*[:\-\|]?\s*([^,\n]{5,120}?)(?=\s*(?:\d{4}\s*[-–—]|$))/g;
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = dateJobPattern.exec(expText)) !== null) {
    const startDate = dateMatch[1];
    const endDate = dateMatch[2];
    const rest = dateMatch[3].trim();

    // Essayer de séparer titre et entreprise
    let title = rest;
    let company = '';
    const companyMatch = rest.match(/(?:chez|at|@|pour|for|[-–—|])\s*([A-Z][A-Za-zÀ-ÿ\s&.,]{2,50})\s*$/);
    if (companyMatch) {
      title = rest.substring(0, rest.length - companyMatch[0].length).trim();
      company = companyMatch[1].trim();
    }

    experiences.push({
      title,
      company,
      startDate,
      endDate,
      description: '',
      confidence: 0.65,
    });
  }

  const expConfidence = computeArrayConfidence(experiences.map(e => e.title), 1);

  // Formation / Éducation
  const education: EducationEntry[] = [];
  const eduSectionMatch = text.match(
    /(?:formation|education|[eé]ducation|[eé]tudes|studies?|dipl[oô]mes?|degrees?|parcours académique)[\s:]*\n([\s\S]*?)(?:\n\s*\n\s*(?:exp[eé]rience|experience|comp[eé]tences|skills?|langues?|languages?|loisirs|hobbies|projets?|projects?|certifications?)\b|$)/im
  );

  const eduText = eduSectionMatch ? eduSectionMatch[1] : text;

  // Patterns pour les formations
  const degreePatterns = [
    /(?:master|mastere|mast[eè]re|msc?|mba|licence|bachelor|bsc|ba|doctorat|phd|dut|bts|bac|baccalaur[eé]at|ing[eé]nieur|engineering)\s+(?:en\s+)?([A-Za-zÀ-ÿ\s&\/]{3,60})/gi,
  ];

  for (const pattern of degreePatterns) {
    let degMatch: RegExpExecArray | null;
    const localPattern = new RegExp(pattern.source, pattern.flags);
    while ((degMatch = localPattern.exec(eduText)) !== null) {
      education.push({
        degree: normalize(degMatch[0].substring(0, 80)),
        school: '',
        year: '',
        fieldOfStudy: degMatch[1] ? normalize(degMatch[1]) : '',
        confidence: 0.55,
      });
    }
  }

  // Chercher les noms d'écoles/universités
  const schoolPatterns = [
    /(?:universit[eé]|university|universidad|école|school|institut|institute|facult[eé]|faculty|polytechnique|centrale|ensa|ensam|h[eé]c|essec|escp|sciences?\s*po|mit|stanford|harvard|oxford|cambridge)\s+[A-Za-zÀ-ÿ\s&.,-]{2,60}/gi,
  ];

  for (const pattern of schoolPatterns) {
    const schools = extractAll(eduText, pattern);
    schools.forEach((school, idx) => {
      if (idx < education.length) {
        education[idx].school = school;
      } else {
        education.push({ degree: '', school, year: '', fieldOfStudy: '', confidence: 0.5 });
      }
    });
  }

  // Extraire les années de formation
  const yearPattern = /(?:19|20)\d{2}\s*[-–—/]\s*(?:19|20)\d{2}/g;
  const years = extractAll(eduText, yearPattern);
  years.forEach((year, idx) => {
    if (idx < education.length) {
      education[idx].year = year;
    }
  });

  const eduConfidence = computeArrayConfidence(education.map(e => e.degree || e.school), 1);

  // Langues
  const languageEntries: LanguageEntry[] = [];
  const langSectionMatch = text.match(
    /(?:langues?|languages?|comp[eé]tences linguistiques)\s*:?\s*\n([\s\S]*?)(?:\n\s*\n|$)/im
  );

  const langText = langSectionMatch ? langSectionMatch[1] : text;

  const langPatterns = [
    /(fran[cç]ais|french|anglais|english|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|arabe|arabic|chinois|chinese|japonais|japanese|russe|russian|n[eé]erlandais|dutch)[\s:]*[-–—]?\s*(courant|fluent|bilingue|bilingual|natif|native|avanc[eé]|advanced|interm[eé]diaire|intermediate|d[eé]butant|beginner|a1|a2|b1|b2|c1|c2)/gi,
  ];

  for (const pattern of langPatterns) {
    let langMatch: RegExpExecArray | null;
    const localPattern = new RegExp(pattern.source, pattern.flags);
    while ((langMatch = localPattern.exec(langText)) !== null) {
      languageEntries.push({
        language: langMatch[1].trim(),
        level: langMatch[2].trim(),
        confidence: 0.75,
      });
    }
  }

  const langConfidence = computeArrayConfidence(languageEntries.map(l => l.language), 1);

  // Certifications
  const certPattern = /(?:certifications?|certificats?|certificates?)\s*:?\s*\n([\s\S]*?)(?:\n\s*\n|$)/im;
  const certSection = text.match(certPattern);
  const certifications = certSection
    ? certSection[1].split(/[\n,;•·\-]+/).map(s => s.trim()).filter(s => s.length > 5)
    : [];

  const certConfidence = computeArrayConfidence(certifications, 1);

  // Résumé / Profil
  const summary = extractFirst(text, [
    /(?:profil|profile|r[eé]sum[eé]|summary|à propos|about me|objectif|objective)[\s:]*\n?([\s\S]{30,500}?)(?:\n\s*\n)/im,
  ]);

  return {
    name,
    email,
    phone,
    location,
    linkedin,
    title,
    skills: { value: skills, confidence: computeArrayConfidence(skills, 3), rawMatches: [] },
    experience: { value: experiences, confidence: expConfidence, rawMatches: [] },
    education: { value: education, confidence: eduConfidence, rawMatches: [] },
    languages: { value: languageEntries, confidence: langConfidence, rawMatches: [] },
    certifications: { value: certifications, confidence: certConfidence, rawMatches: [] },
    summary,
  };
}

// ─── Extraction Lettre de motivation ─────────────────────────────────────────

function extractCoverLetterFields(text: string): CoverLetterFields {
  const recipient = extractFirst(text, [
    /(?:madame|monsieur|dear|mr\.?|mrs\.?|ms\.?|dr\.?)\s+([A-Z][A-Za-zÀ-ÿ\s\-]{2,40})/im,
    /(?:[àa] l['']attention de|to the attention of|attn)[\s:]*([A-Za-zÀ-ÿ\s\-]{3,60})/im,
  ]);

  const recipientCompany = extractFirst(text, [
    /(?:soci[eé]t[eé]|entreprise|company|firme|firm|organisation|organization)[\s:]*([A-Za-zÀ-ÿ\s&.,\-']{3,60})/im,
    /\b(?:chez|at|au sein de)\s+([A-Z][A-Za-zÀ-ÿ\s&.,\-]{3,60})\b/,
  ]);

  const sender = extractFirst(text, [
    // L'expéditeur est souvent en haut à gauche
    /^([A-Z][a-zÀ-ÿ]+\s+[A-Z][a-zÀ-ÿ]+)\s*\n/m,
  ]);

  const senderEmail = extractFirst(text, [
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i,
  ]);

  const senderPhone = extractFirst(text, [
    /(?:t[ée]l|phone)[\s.:]*([+\d][\d\s()\-.]{7,20})/i,
  ]);

  const date = extractFirst(text, [
    /(?:fait [àa]|le|date)[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
  ]);

  const subject = extractFirst(text, [
    /(?:objet|subject|re|concerne|candidature)[\s:]*([A-Za-zÀ-ÿ\d\s\/\-&',.!]{10,150})/im,
  ]);

  const position = extractFirst(text, [
    /(?:poste de|position of|emploi de|job of|candidature (?:au|pour le|pour|à))[\s:]*([A-Za-zÀ-ÿ\s\/\-&()]{5,80})/im,
    /\b(?:développeur|developer|ingénieur|engineer|consultant|analyste|manager|directeur|lead|architecte|designer|chef de projet|product manager|data scientist|devops)\s[A-Za-zÀ-ÿ\s\/\-&()]+/i,
  ]);

  // Corps de la lettre (entre l'en-tête et la formule de politesse)
  const bodyMatch = text.match(
    /(?:madame|monsieur|dear|recruteur|recruitment)[,\s][\s\S]{20,}(?:veuillez|sincerely|cordialement|salutations|je vous prie)/im
  );
  const body = {
    value: bodyMatch ? normalize(bodyMatch[0]) : '',
    confidence: bodyMatch ? 0.7 : 0,
    rawMatch: bodyMatch ? bodyMatch[0] : '',
  };

  // Signature
  const signature = extractFirst(text, [
    /(veuillez agr[eé]er|sincerely|yours?\s+(?:faithfully|sincerely|truly)|cordialement|salutations distingu[eé]es|bien cordialement)[\s\S]{5,200}$/im,
  ]);

  return {
    recipient,
    recipientCompany,
    sender,
    senderEmail,
    senderPhone,
    date,
    subject,
    body,
    signature,
    position,
  };
}

// ─── Extraction Diplôme ──────────────────────────────────────────────────────

function extractDiplomaFields(text: string): DiplomaFields {
  const institution = extractFirst(text, [
    /(?:universit[eé]|university|universidad|institut|institute|[eé]cole|school|facult[eé]|faculty)\s+([A-Za-zÀ-ÿ\s&.,\-']{3,80})/im,
    /(?:d[eé]livr[eé] par|d[eé]cern[eé] par|awarded by|otorgado por|conf[eé]r[eé] par)\s+([A-Za-zÀ-ÿ\s&.,\-']{3,80})/im,
  ]);

  const degree = extractFirst(text, [
    /(?:grade de|titre de|degree of|t[ií]tulo de)\s+([A-Za-zÀ-ÿ\s&\/]{3,80})/im,
    /(?:dipl[oô]me\s+(?:de|national\s+de|d['']?[eé]tat|d['']?ing[eé]nieur|d['']?universit[eé]))\s+([A-Za-zÀ-ÿ\s&\/]{3,80})/im,
    /\b(master|mast[eè]re|msc|mba|licence|bachelor|bsc|ba|doctorat|phd|dut|bts|bac\+?\d?|ing[eé]nieur|engineering diploma|bachelier)\b/i,
  ]);

  const fieldOfStudy = extractFirst(text, [
    /(?:en|in|sp[eé]cialit[eé]|mention|field|domaine)\s+([A-Za-zÀ-ÿ\s&\/]{3,80})/im,
    /\b(informatique|computer science|math[eé]matiques|mathematics|physique|physics|chimie|chemistry|biologie|biology|[eé]conomie|economics|gestion|management|droit|law|m[eé]decine|medicine|ing[eé]nierie|engineering|architecture|marketing|finance|comptabilit[eé]|accounting|ressources humaines|human resources|communication|journalisme|journalism|sciences politiques|political science|sociologie|sociology|psychologie|psychology|philosophie|philosophy|histoire|history|g[eé]ographie|geography|langues|literature|litt[eé]rature|arts?|design|musique|music)\b/i,
  ]);

  const date = extractFirst(text, [
    /(?:ann[eé]e|year|a[ñn]o|date)[\s:]*(\d{4})/im,
    /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    /(\d{4}\s*[-–—/]\s*\d{4})/,
  ]);

  const honors = extractFirst(text, [
    /(?:mention|honors?|distinction)[\s:]*\s*((?:tr[eè]s\s+)?bien|assez\s+bien|passable|excellent|f[eé]licitations|cum laude|magna cum laude|summa cum laude|honors|distinction)/i,
    /\b(?:mention\s+(tr[eè]s\s+bien|bien|assez\s+bien|passable))\b/i,
  ]);

  const location = extractFirst(text, [
    /(?:fait [àa]|d[eé]livr[eé] [àa]|[àa])\s+([A-Z][A-Za-zÀ-ÿ\s\-',]{3,60})(?:,?\s*(?:le|the)\s+\d)/im,
    /(?:Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Lille|Strasbourg|London|New York|Berlin|Madrid|Montr[eé]al)/i,
  ]);

  const studentName = extractFirst(text, [
    /(?:d[eé]livr[eé] [àa]|d[eé]cern[eé] [àa]|awarded to|otorgado a|conf[eé]r[eé] [àa]|attribu[eé] [àa])\s+(?:m\.|mme|mlle|mr\.?|mrs\.?|ms\.?)\s+([A-Z][A-Za-zÀ-ÿ\s\-']{3,60})/im,
    /^([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+)/m,
  ]);

  const issuer = extractFirst(text, [
    /(?:recteur|pr[eé]sident|directeur|doyen|dean|president|director)[\s:]*([A-Za-zÀ-ÿ\s\-]{3,60})/im,
    /(?:sign[eé]|signature)[\s:]*([A-Za-zÀ-ÿ\s\-]{3,60})/im,
  ]);

  return { institution, degree, fieldOfStudy, date, honors, location, studentName, issuer };
}

// ─── Extraction Certificat ───────────────────────────────────────────────────

function extractCertificateFields(text: string): CertificateFields {
  const title = extractFirst(text, [
    /(?:certificat|certificate|certificado|attestation)\s+(?:de\s+)?([A-Za-zÀ-ÿ\s&\/\-]{5,120})/im,
    /^([A-Z][A-Za-zÀ-ÿ\s&\/\-]{5,120})/m,
  ]);

  const issuer = extractFirst(text, [
    /(?:d[eé]livr[eé] par|issued by|emitido por|organisme|organism)\s+([A-Za-zÀ-ÿ\s&.,\-']{3,80})/im,
    /(?:^|\n)([A-Z][A-Za-zÀ-ÿ\s&.,\-']{5,80})\s*(?:\n|certifie|atteste)/m,
  ]);

  const date = extractFirst(text, [
    /(?:date|fait [àa]|le|d[eé]livr[eé] le|issued on)[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    /(\d{4})/,
  ]);

  const recipient = extractFirst(text, [
    /(?:d[eé]livr[eé] [àa]|remis [àa]|awarded to|attribu[eé] [àa])\s+(?:m\.|mme|mlle|mr\.?|mrs\.?|ms\.?)\s+([A-Z][A-Za-zÀ-ÿ\s\-']{3,60})/im,
    /(?:atteste que|certifie que|certify that)\s+(?:m\.|mme|mlle|mr\.?|mrs\.?|ms\.?)\s+([A-Z][A-Za-zÀ-ÿ\s\-']{3,60})/im,
  ]);

  // Compétences mentionnées dans le certificat
  const skills = extractAll(text, /(?:comp[eé]tence|skill|ma[iî]trise|connaissance)[\s:]*([A-Za-zÀ-ÿ\s,&\-]{3,60})/gi);
  const skillsConf = computeArrayConfidence(skills, 1);

  const duration = extractFirst(text, [
    /(?:dur[eé]e|duration|heures?|hours?|jours?|days?|mois|months?)[\s:]*(\d+\s*(?:h|heures?|hours?|j|jours?|days?|mois|months?))/i,
  ]);

  const reference = extractFirst(text, [
    /(?:r[eé]f[eé]rence|reference|num[eé]ro|number|n[°o]|id)[\s:]*([A-Za-z0-9\-/#]{3,30})/i,
  ]);

  return {
    title,
    issuer,
    date,
    recipient,
    skills: { value: skills, confidence: skillsConf, rawMatches: [] },
    duration,
    reference,
  };
}

// ─── Extraction Relevé de notes ──────────────────────────────────────────────

function extractAcademicTranscriptFields(text: string): AcademicTranscriptFields {
  const institution = extractFirst(text, [
    /(?:universit[eé]|university|universidad|institut|institute|[eé]cole|school|facult[eé]|faculty)\s+([A-Za-zÀ-ÿ\s&.,\-']{3,80})/im,
  ]);

  const studentName = extractFirst(text, [
    /(?:[eé]tudiant|student|estudiante|nom|name)[\s:]*([A-Z][A-Za-zÀ-ÿ\s\-']{3,60})/im,
    /^([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+)/m,
  ]);

  const period = extractFirst(text, [
    /(?:ann[eé]e universitaire|academic year|a[ñn]o acad[eé]mico|semestre|semester|trimestre|trimester)[\s:]*(\d{4}\s*[-–—/]\s*\d{4})/i,
    /(?:semestre|semester)\s+(\d)\s*[-–—/]?\s*(\d{4}\s*[-–—/]\s*\d{4})/i,
    /(20\d{2}\s*[-–—/]\s*20\d{2})/,
  ]);

  // GPA / Moyenne
  const gpa = extractFirst(text, [
    /(?:gpa|moyenne|average|moy\.?)[\s:]*(\d{1,2}[,.]\d{1,2})\s*(?:\/\s*(?:20|10|100|4))?/i,
    /(?:mention|honors?)[\s:]*((?:tr[eè]s\s+)?bien|assez\s+bien|passable|excellent)/i,
  ]);

  // Cours et notes
  const courses: CourseEntry[] = [];
  const coursePattern = /^([A-Za-zÀ-ÿ\s&()\-']{3,80})\s+(\d{1,2}[,.]?\d{0,2})\s+(\d{1,2})\s*$/gm;
  let courseMatch: RegExpExecArray | null;
  while ((courseMatch = coursePattern.exec(text)) !== null) {
    courses.push({
      name: courseMatch[1].trim(),
      grade: courseMatch[2].trim(),
      credits: courseMatch[3].trim(),
      confidence: 0.6,
    });
  }

  const coursesConf = computeArrayConfidence(courses.map(c => c.name), 1);

  // Total crédits
  const totalCredits = extractFirst(text, [
    /(?:total cr[eé]dits?|total credits?|ects total|cr[eé]dits? totaux)[\s:]*(\d+)/i,
  ]);

  const degree = extractFirst(text, [
    /(?:dipl[oô]me|degree|titre)[\s:]*([A-Za-zÀ-ÿ\s&\/]{3,80})/im,
    /\b(master|licence|bachelor|doctorat|phd|dut|bts|bac)\b/i,
  ]);

  const honorsGpa = extractFirst(text, [
    /(?:mention|honors?|distinction)[\s:]*((?:tr[eè]s\s+)?bien|assez\s+bien|passable|excellent|f[eé]licitations|cum laude)/i,
  ]);

  return {
    institution,
    studentName,
    period,
    gpa,
    courses: { value: courses, confidence: coursesConf, rawMatches: [] },
    totalCredits,
    degree,
    honors: honorsGpa,
  };
}

// ─── Extraction Pièce d'identité ─────────────────────────────────────────────

function extractIDDocumentFields(text: string): IDDocumentFields {
  const documentType = extractFirst(text, [
    /(passeport|passport|pasaporte|permis de conduire|driver[\s']?s?\s+licen[cs]e|carte nationale d['']identit[eé]|national identity card|c[eé]dula|carte d['']identit[eé]|id card)/i,
  ]);

  const documentNumber = extractFirst(text, [
    /(?:num[eé]ro|number|n[°o]|no\.?|document)[\s:]*([A-Z0-9]{6,20})/i,
    /\b([A-Z]{2}\d{6,9})\b/,
  ]);

  const fullName = extractFirst(text, [
    /(?:nom|name|apellidos?|surname|pr[eé]nom|given name)[\s:]*([A-Z][A-Za-zÀ-ÿ\s\-']{3,60})/im,
    /^([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+)/m,
  ]);

  const birthDate = extractFirst(text, [
    /(?:date de naissance|date of birth|fecha de nacimiento|n[eé]e?\s+(?:le|the))[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
  ]);

  const nationality = extractFirst(text, [
    /(?:nationalit[eé]|nationality|nacionalidad)[\s:]*([A-Za-zÀ-ÿ\s]{3,40})/im,
    /\b(fran[cç]aise?|french|belge|belgian|suisse|swiss|canadienne?|canadian|am[eé]ricaine?|american|espagnole?|spanish|italienne?|italian|allemande?|german|anglaise?|british|portugaise?|portuguese|marocaine?|moroccan|tunisienne?|tunisian|alg[eé]rienne?|algerian|s[eé]n[eé]galaise?|senegalese)\b/i,
  ]);

  const expiryDate = extractFirst(text, [
    /(?:date d['']expiration|expiry date|expiration date|fecha de caducidad|valable jusqu['']au|valid until)[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
  ]);

  const issuingAuthority = extractFirst(text, [
    /(?:autorit[eé]|authority|autoridad|d[eé]livr[eé] par|issued by|expedid[oa] por)[\s:]*([A-Za-zÀ-ÿ\s&.,\-']{3,60})/im,
    /(?:pr[eé]fecture|prefecture|mairie|consulat|consulate|ambassade|embassy)\s+([A-Za-zÀ-ÿ\s&.,\-']{3,60})/i,
  ]);

  return { documentType, documentNumber, fullName, birthDate, nationality, expiryDate, issuingAuthority };
}

// ─── Extraction Autre ────────────────────────────────────────────────────────

function extractOtherFields(text: string): OtherFields {
  const title = extractFirst(text, [
    /^([A-Z][A-Za-zÀ-ÿ\s]{3,100})$/m,
  ]);

  const date = extractFirst(text, [
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/,
    /(\d{4})/,
  ]);

  const author = extractFirst(text, [
    /(?:auteur|author|par|by|r[eé]dig[eé] par|written by)[\s:]*([A-Za-zÀ-ÿ\s\-]{3,60})/im,
  ]);

  const keyPhrases = text
    .split(/[\n.]+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 200)
    .slice(0, 5);

  return {
    title,
    date,
    author,
    keyPhrases: { value: keyPhrases, confidence: computeArrayConfidence(keyPhrases, 1), rawMatches: [] },
  };
}

// ─── Fonction principale d'extraction ────────────────────────────────────────

/**
 * Extrait les champs structurés d'un document selon son type.
 *
 * @param text - Texte brut extrait du document
 * @param documentType - Type de document classifié
 * @returns ExtractionResult avec les champs extraits et la confiance globale
 */
export function extractFields(text: string, documentType: DocumentType): ExtractionResult {
  const startTime = performance.now();

  let fields: ExtractedFields;

  switch (documentType) {
    case 'cv':
      fields = { type: 'cv', fields: extractCVFields(text) };
      break;
    case 'cover_letter':
      fields = { type: 'cover_letter', fields: extractCoverLetterFields(text) };
      break;
    case 'diploma':
      fields = { type: 'diploma', fields: extractDiplomaFields(text) };
      break;
    case 'certificate':
      fields = { type: 'certificate', fields: extractCertificateFields(text) };
      break;
    case 'academic_transcript':
      fields = { type: 'academic_transcript', fields: extractAcademicTranscriptFields(text) };
      break;
    case 'id_document':
      fields = { type: 'id_document', fields: extractIDDocumentFields(text) };
      break;
    default:
      fields = { type: 'other', fields: extractOtherFields(text) };
      break;
  }

  // Calculer la confiance globale (moyenne des confiances individuelles)
  const overallConfidence = computeOverallConfidence(fields);

  const endTime = performance.now();
  const processingTimeMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    documentType,
    fields,
    overallConfidence,
    processingTimeMs,
    rawText: text,
  };
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Calcule la confiance globale d'une extraction en moyennant les confiances
 * de tous les champs individuels.
 */
function computeOverallConfidence(fields: ExtractedFields): number {
  const confidences: number[] = [];
  const actualFields = fields.type === 'other' ? fields.fields : fields.fields;

  function collectConfidences(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if ('confidence' in obj && typeof (obj as Record<string, unknown>).confidence === 'number') {
      confidences.push((obj as Record<string, number>).confidence);
    }
    // Ne pas descendre dans les tableaux complexes (value arrays)
    if ('value' in obj && Array.isArray((obj as Record<string, unknown>).value)) {
      // On garde la confidence du wrapper
      return;
    }
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        collectConfidences(val);
      }
    }
  }

  collectConfidences(actualFields);

  if (confidences.length === 0) return 0;
  const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Obtient les noms des champs pour un type de document donné.
 */
export function getFieldNames(documentType: DocumentType): string[] {
  const sets: Record<DocumentType, string[]> = {
    cv: ['name', 'email', 'phone', 'location', 'linkedin', 'title', 'skills', 'experience', 'education', 'languages', 'certifications', 'summary'],
    cover_letter: ['recipient', 'recipientCompany', 'sender', 'senderEmail', 'senderPhone', 'date', 'subject', 'body', 'signature', 'position'],
    diploma: ['institution', 'degree', 'fieldOfStudy', 'date', 'honors', 'location', 'studentName', 'issuer'],
    certificate: ['title', 'issuer', 'date', 'recipient', 'skills', 'duration', 'reference'],
    academic_transcript: ['institution', 'studentName', 'period', 'gpa', 'courses', 'totalCredits', 'degree', 'honors'],
    id_document: ['documentType', 'documentNumber', 'fullName', 'birthDate', 'nationality', 'expiryDate', 'issuingAuthority'],
    other: ['title', 'date', 'author', 'keyPhrases'],
  };
  return sets[documentType] || [];
}

/**
 * Convertit les champs extraits en format JSON simple pour l'affichage.
 */
export function fieldsToJson(fields: ExtractedFields): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function flatten(obj: unknown, prefix: string = ''): void {
    if (!obj || typeof obj !== 'object') return;

    if ('value' in obj && 'confidence' in obj) {
      const extracted = obj as { value: unknown; confidence: number };
      result[prefix] = {
        valeur: extracted.value,
        confiance: Math.round(extracted.confidence * 100) + '%',
      };
      return;
    }

    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'rawMatch' || key === 'rawMatches') continue;
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      flatten(val, newPrefix);
    }
  }

  flatten(fields.fields);
  return result;
}

/**
 * Exporte les champs sous forme de paires clé-valeur aplaties pour copie facile.
 */
export function fieldsToKeyValuePairs(fields: ExtractedFields): Array<{ key: string; value: string; confidence: number }> {
  const pairs: Array<{ key: string; value: string; confidence: number }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function collect(obj: any, prefix: string = ''): void {
    if (!obj || typeof obj !== 'object') return;

    if ('value' in obj && 'confidence' in obj && !Array.isArray(obj.value)) {
      const extracted = obj as { value: string; confidence: number };
      if (extracted.value) {
        pairs.push({ key: prefix, value: String(extracted.value), confidence: extracted.confidence });
      }
      return;
    }

    // Pour les arrays de structurés (experience, education, courses), on les convertit en string
    if ('value' in obj && Array.isArray(obj.value) && obj.value.length > 0) {
      const entries = obj.value as unknown[];
      entries.forEach((entry: unknown, idx: number) => {
        if (typeof entry === 'object' && entry !== null) {
          const entryObj = entry as Record<string, unknown>;
          const objStr = Object.entries(entryObj)
            .filter(([k]) => k !== 'confidence')
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
          pairs.push({ key: `${prefix}[${idx}]`, value: objStr, confidence: (obj as { confidence: number }).confidence });
        } else if (typeof entry === 'string') {
          pairs.push({ key: `${prefix}[${idx}]`, value: entry, confidence: (obj as { confidence: number }).confidence });
        }
      });
      return;
    }

    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (key === 'rawMatch' || key === 'rawMatches') continue;
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      collect(val, newPrefix);
    }
  }

  collect(fields.fields);
  return pairs;
}
