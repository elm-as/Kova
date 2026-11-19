export interface Position {
  id: string
  companyId: string
  title: string
  description: string
  requirements: string
  openings: number
  createdAt: number
  status: 'active' | 'closed' | 'archived'
  archivedAt?: number
  hiredCount?: number
  isLocked?: boolean
  isInternship?: boolean
  targetLevel?: 'junior' | 'mid' | 'senior'
}

export interface Candidate {
  id: string
  positionId: string
  name: string
  email: string
  profileText: string
  fileName?: string
  fileType?: 'pdf' | 'html' | 'docx' | 'image' | 'txt'
  documentType?: string  // ex: 'cv', 'cover_letter', 'diploma' — détecté par l'OCR
  documentLanguage?: 'fr' | 'en' | 'es'  // langue détectée du document
  promptDefense?: {  // informations de défense contre le reverse-prompting
    riskLevel: 'none' | 'low' | 'medium' | 'high'
    suspiciousCount: number
    detections: string[]
    modified: boolean
  }
  score: number
  scoreBreakdown: {
    category: string
    score: number
    reasoning: string
  }[]
  strengths: string[]
  weaknesses: string[]
  overallAssessment: string
  interviewQuestions?: string[]
  questionAnswers?: {
    questionIndex: number
    question: string
    answer: string
    answeredAt: number
    aiScore?: {
      technicalDepth: number
      accuracy: number
      completeness: number
      overallScore: number
      feedback: string
      strengths: string[]
      improvements: string[]
      scoredAt: number
    }
  }[]
  followUpQuestions?: {
    originalQuestionIndex: number
    originalQuestion: string
    originalAnswer: string
    followUpQuestions: string[]
    generatedAt: number
  }[]
  alternativePositions?: {
    positionId: string
    positionTitle: string
    reasoning: string
  }[]
  status: 'pending' | 'analyzing' | 'scored' | 'selected' | 'rejected' | 'hired'
  createdAt: number
  analyzedAt?: number
  customOrder?: number
  hiredAt?: number
}

export interface PositionWithCandidates extends Position {
  candidates: Candidate[]
}

export interface OrderingPreset {
  id: string
  positionId: string
  name: string
  candidateOrder: string[]
  createdAt: number
  updatedAt: number
}

export type Language = 'fr' | 'en' | 'es'

export interface ScoreWeights {
  technicalSkills: number
  professionalExperience: number
  educationCertifications: number
  culturalFitSoftSkills: number
  careerTrajectoryGrowth: number
  productionReadiness: number
  proofOfExecution: number
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  technicalSkills: 15,
  professionalExperience: 15,
  educationCertifications: 10,
  culturalFitSoftSkills: 10,
  careerTrajectoryGrowth: 15,
  productionReadiness: 15,
  proofOfExecution: 20,
}

export const SCORE_WEIGHT_KEYS: (keyof ScoreWeights)[] = [
  'technicalSkills',
  'professionalExperience',
  'educationCertifications',
  'culturalFitSoftSkills',
  'careerTrajectoryGrowth',
  'productionReadiness',
  'proofOfExecution',
]

export const SCORE_CATEGORY_MAP: Record<keyof ScoreWeights, string> = {
  technicalSkills: 'Technical Skills',
  professionalExperience: 'Professional Experience',
  educationCertifications: 'Education & Certifications',
  culturalFitSoftSkills: 'Cultural Fit & Soft Skills',
  careerTrajectoryGrowth: 'Career Trajectory & Growth',
  productionReadiness: 'Production Readiness',
  proofOfExecution: 'Proof of Execution',
}

export type TargetLevel = 'junior' | 'mid' | 'senior'

export interface WeightPreset {
  id: string
  name: string
  description: string
  weights: ScoreWeights
}

export interface AuditLogEntry {
  id: string
  companyId: string
  userId: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'analyze' | 'export' | 'email' | 'payment' | 'role_change'
  entityType: 'position' | 'candidate' | 'user' | 'company' | 'subscription' | 'email' | 'session'
  entityId?: string
  entityName?: string
  details?: string
  timestamp: number
}

export type LicenseType = 'trial' | 'starter' | 'professional' | 'enterprise'
export type UserRole = 'owner' | 'admin' | 'recruiter' | 'viewer'

export interface Company {
  id: string
  name: string
  email: string
  createdAt: number
  license: {
    type: LicenseType
    maxUsers: number
    maxPositions: number
    maxCandidatesPerPosition: number
    features: {
      bulkOperations: boolean
      advancedAnalytics: boolean
      emailTemplates: boolean
      apiAccess: boolean
      customBranding: boolean
    }
    startDate: number
    expiryDate: number
    isActive: boolean
  }
  subscription: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    status: 'active' | 'past_due' | 'canceled' | 'expired' | 'trialing'
    currentPeriodEnd: number
    cancelAtPeriodEnd: boolean
    lastPaymentDate?: number
    nextPaymentDate?: number
    paymentMethod?: {
      type: 'card' | 'sepa' | 'paypal'
      last4?: string
      brand?: string
    }
  }
  paymentReminders?: PaymentReminder[]
}

export interface PaymentReminder {
  id: string
  companyId: string
  type: 'upcoming' | 'overdue' | 'expiring_soon'
  sentAt: number
  daysBeforeExpiry: number
  acknowledged: boolean
}

export interface PaymentHistory {
  id: string
  companyId: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'pending' | 'refunded'
  stripePaymentId?: string
  createdAt: number
  description: string
}

export type WebhookEventType =
  | 'candidate.analyzed'
  | 'candidate.created'
  | 'candidate.deleted'
  | 'position.created'
  | 'position.updated'
  | 'position.deleted'
  | 'subscription.changed'

export interface WebhookSubscription {
  id: string
  companyId: string
  url: string
  events: WebhookEventType[]
  secret: string
  active: boolean
  createdAt: number
  lastTriggeredAt?: number
  failCount: number
}

export interface User {
  id: string
  companyId: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: number
  lastLoginAt?: number
}

export interface AuthSession {
  companyId: string
  userId: string
  isAuthenticated: boolean
}
