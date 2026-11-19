import { supabase, isSupabaseConfigured } from './supabase'
import { Company, User, Position, Candidate, OrderingPreset, PaymentReminder } from './types'
import { toast } from 'sonner'

/** Whether we've already warned the user about localStorage fallback this session */
let _localStorageWarningShown = false

function warnLocalStorageFallback() {
  if (_localStorageWarningShown) return
  _localStorageWarningShown = true
  console.warn('[DB] Supabase not configured — using localStorage fallback. Data is NOT persisted server-side.')
  toast.warning('Base de données non configurée — les données sont stockées localement et ne sont PAS persistées côté serveur.', { duration: 8000 })
}

// ============================================================
// Mappers: TypeScript camelCase ↔ PostgreSQL snake_case
// ============================================================

function mapCompanyFromDb(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    createdAt: row.created_at as number,
    license: {
      type: row.license_type as Company['license']['type'],
      maxUsers: row.max_users as number,
      maxPositions: row.max_positions as number,
      maxCandidatesPerPosition: row.max_candidates_per_position as number,
      features: (row.features ?? {}) as Company['license']['features'],
      startDate: row.license_start_date as number,
      expiryDate: row.license_expiry_date as number,
      isActive: row.license_is_active as boolean,
    },
    subscription: {
      stripeCustomerId: row.stripe_customer_id as string | undefined,
      stripeSubscriptionId: row.stripe_subscription_id as string | undefined,
      status: row.subscription_status as Company['subscription']['status'],
      currentPeriodEnd: row.current_period_end as number,
      cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
      lastPaymentDate: row.last_payment_date as number | undefined,
      nextPaymentDate: row.next_payment_date as number | undefined,
      paymentMethod: row.payment_method as Company['subscription']['paymentMethod'],
    },
    paymentReminders: [],
  }
}

function mapCompanyToDb(c: Partial<Company> & { id?: string }) {
  const row: Record<string, unknown> = {}
  if (c.id !== undefined) row.id = c.id
  if (c.name !== undefined) row.name = c.name
  if (c.email !== undefined) row.email = c.email
  if (c.createdAt !== undefined) row.created_at = c.createdAt
  if (c.license) {
    row.license_type = c.license.type
    row.max_users = c.license.maxUsers
    row.max_positions = c.license.maxPositions
    row.max_candidates_per_position = c.license.maxCandidatesPerPosition
    row.features = c.license.features
    row.license_start_date = c.license.startDate
    row.license_expiry_date = c.license.expiryDate
    row.license_is_active = c.license.isActive
  }
  if (c.subscription) {
    row.subscription_status = c.subscription.status
    row.stripe_customer_id = c.subscription.stripeCustomerId
    row.stripe_subscription_id = c.subscription.stripeSubscriptionId
    row.current_period_end = c.subscription.currentPeriodEnd
    row.cancel_at_period_end = c.subscription.cancelAtPeriodEnd
    row.last_payment_date = c.subscription.lastPaymentDate
    row.next_payment_date = c.subscription.nextPaymentDate
    row.payment_method = c.subscription.paymentMethod
  }
  return row
}

function mapUserFromDb(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    role: row.role as User['role'],
    createdAt: row.created_at as number,
    lastLoginAt: row.last_login_at as number | undefined,
  }
}

function mapUserToDb(u: Partial<User> & { id?: string }) {
  const row: Record<string, unknown> = {}
  if (u.id !== undefined) row.id = u.id
  if (u.companyId !== undefined) row.company_id = u.companyId
  if (u.name !== undefined) row.name = u.name
  if (u.email !== undefined) row.email = u.email
  if (u.passwordHash !== undefined) row.password_hash = u.passwordHash
  if (u.role !== undefined) row.role = u.role
  if (u.createdAt !== undefined) row.created_at = u.createdAt
  if (u.lastLoginAt !== undefined) row.last_login_at = u.lastLoginAt
  return row
}

function mapPositionFromDb(row: Record<string, unknown>): Position {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: row.title as string,
    description: row.description as string,
    requirements: row.requirements as string,
    openings: row.openings as number,
    status: row.status as Position['status'],
    isInternship: row.is_internship as boolean | undefined,
    isLocked: row.is_locked as boolean | undefined,
    hiredCount: row.hired_count as number | undefined,
    archivedAt: row.archived_at as number | undefined,
    createdAt: row.created_at as number,
  }
}

function mapPositionToDb(p: Partial<Position> & { id?: string }) {
  const row: Record<string, unknown> = {}
  if (p.id !== undefined) row.id = p.id
  if (p.companyId !== undefined) row.company_id = p.companyId
  if (p.title !== undefined) row.title = p.title
  if (p.description !== undefined) row.description = p.description
  if (p.requirements !== undefined) row.requirements = p.requirements
  if (p.openings !== undefined) row.openings = p.openings
  if (p.status !== undefined) row.status = p.status
  if (p.isInternship !== undefined) row.is_internship = p.isInternship
  if (p.isLocked !== undefined) row.is_locked = p.isLocked
  if (p.hiredCount !== undefined) row.hired_count = p.hiredCount
  if (p.archivedAt !== undefined) row.archived_at = p.archivedAt
  if (p.createdAt !== undefined) row.created_at = p.createdAt
  return row
}

function mapCandidateFromDb(row: Record<string, unknown>): Candidate {
  return {
    id: row.id as string,
    positionId: row.position_id as string,
    name: row.name as string,
    email: row.email as string,
    profileText: row.profile_text as string,
    fileName: row.file_name as string | undefined,
    fileType: row.file_type as Candidate['fileType'],
    score: row.score as number,
    scoreBreakdown: (row.score_breakdown ?? []) as Candidate['scoreBreakdown'],
    strengths: (row.strengths ?? []) as string[],
    weaknesses: (row.weaknesses ?? []) as string[],
    overallAssessment: row.overall_assessment as string,
    interviewQuestions: (row.interview_questions ?? []) as string[],
    questionAnswers: (row.question_answers ?? []) as Candidate['questionAnswers'],
    followUpQuestions: (row.follow_up_questions ?? []) as Candidate['followUpQuestions'],
    alternativePositions: (row.alternative_positions ?? []) as Candidate['alternativePositions'],
    status: row.status as Candidate['status'],
    customOrder: row.custom_order as number | undefined,
    analyzedAt: row.analyzed_at as number | undefined,
    hiredAt: row.hired_at as number | undefined,
    createdAt: row.created_at as number,
  }
}

function mapCandidateToDb(c: Partial<Candidate> & { id?: string }) {
  const row: Record<string, unknown> = {}
  if (c.id !== undefined) row.id = c.id
  if (c.positionId !== undefined) row.position_id = c.positionId
  if (c.name !== undefined) row.name = c.name
  if (c.email !== undefined) row.email = c.email
  if (c.profileText !== undefined) row.profile_text = c.profileText
  if (c.fileName !== undefined) row.file_name = c.fileName
  if (c.fileType !== undefined) row.file_type = c.fileType
  if (c.score !== undefined) row.score = c.score
  if (c.scoreBreakdown !== undefined) row.score_breakdown = c.scoreBreakdown
  if (c.strengths !== undefined) row.strengths = c.strengths
  if (c.weaknesses !== undefined) row.weaknesses = c.weaknesses
  if (c.overallAssessment !== undefined) row.overall_assessment = c.overallAssessment
  if (c.interviewQuestions !== undefined) row.interview_questions = c.interviewQuestions
  if (c.questionAnswers !== undefined) row.question_answers = c.questionAnswers
  if (c.followUpQuestions !== undefined) row.follow_up_questions = c.followUpQuestions
  if (c.alternativePositions !== undefined) row.alternative_positions = c.alternativePositions
  if (c.status !== undefined) row.status = c.status
  if (c.customOrder !== undefined) row.custom_order = c.customOrder
  if (c.analyzedAt !== undefined) row.analyzed_at = c.analyzedAt
  if (c.hiredAt !== undefined) row.hired_at = c.hiredAt
  if (c.createdAt !== undefined) row.created_at = c.createdAt
  return row
}

// ============================================================
// localStorage fallback (quand Supabase n'est pas configuré)
// ============================================================

function localGet<T>(key: string): T | undefined {
  const raw = localStorage.getItem(`ats:${key}`)
  if (raw == null) return undefined
  try { return JSON.parse(raw) as T } catch { return undefined }
}

function localSet<T>(key: string, value: T) {
  localStorage.setItem(`ats:${key}`, JSON.stringify(value))
}

// ============================================================
async function getDemoAccount() {
  const { initializeDemoAccount } = await import('./license')
  const { demoCompany, demoUser } = await initializeDemoAccount()
  let companies = localGet<Company[]>('companies') ?? []
  if (!companies.some(c => c.id === demoCompany.id)) {
    companies.push(demoCompany)
    localSet('companies', companies)
  }
  let users = localGet<User[]>('users') ?? []
  if (!users.some(u => u.id === demoUser.id)) {
    users.push(demoUser)
    localSet('users', users)
  }
  return { demoCompany, demoUser }
}

// ============================================================
// COMPANIES
// ============================================================

export async function getCompanyById(id: string): Promise<Company | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).maybeSingle()
      if (!error && data) return mapCompanyFromDb(data)
    } catch (e) {
      console.warn('[DB] Supabase company query error, fallback:', e)
    }
  }
  let companies = localGet<Company[]>('companies') ?? []
  let company = companies.find(c => c.id === id)
  if (!company && id === 'demo-company-1') {
    const { demoCompany } = await getDemoAccount()
    return demoCompany
  }
  return company ?? null
}

export async function createCompany(company: Company): Promise<Company> {
  if (!isSupabaseConfigured || !supabase) {
    const companies = localGet<Company[]>('companies') ?? []
    companies.push(company)
    localSet('companies', companies)
    return company
  }
  const row = mapCompanyToDb(company)
  const { data, error } = await supabase.from('companies').insert(row).select().single()
  if (error) throw error
  return mapCompanyFromDb(data)
}

export async function updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
  if (!isSupabaseConfigured || !supabase) {
    const companies = localGet<Company[]>('companies') ?? []
    const idx = companies.findIndex(c => c.id === id)
    if (idx === -1) throw new Error('Company not found')
    companies[idx] = { ...companies[idx], ...updates }
    localSet('companies', companies)
    return companies[idx]
  }
  const row = mapCompanyToDb(updates)
  const { data, error } = await supabase.from('companies').update(row).eq('id', id).select().single()
  if (error) throw error
  return mapCompanyFromDb(data)
}

// ============================================================
// USERS
// ============================================================

export async function getUserByEmail(email: string): Promise<User | null> {
  const isDemoEmail = email.toLowerCase() === 'admin@demo-company.com'

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('users').select('*').ilike('email', email).maybeSingle()
      if (!error && data) return mapUserFromDb(data)
    } catch (e) {
      console.warn('[DB] Supabase user query error, fallback:', e)
    }
  }
  let users = localGet<User[]>('users') ?? []
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!user && isDemoEmail) {
    const { demoUser } = await getDemoAccount()
    return demoUser
  }
  return user ?? null
}

export async function getUsersByCompanyId(companyId: string): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('users').select('*').eq('company_id', companyId)
      if (!error && data && data.length > 0) return data.map(mapUserFromDb)
    } catch (e) {
      console.warn('[DB] Supabase getUsersByCompanyId error, fallback:', e)
    }
  }
  let users = localGet<User[]>('users') ?? []
  if (companyId === 'demo-company-1' && !users.some(u => u.companyId === companyId)) {
    const { demoUser } = await getDemoAccount()
    return [demoUser]
  }
  return users.filter(u => u.companyId === companyId)
}

export async function createUser(user: User): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    const users = localGet<User[]>('users') ?? []
    users.push(user)
    localSet('users', users)
    return user
  }
  const row = mapUserToDb(user)
  const { data, error } = await supabase.from('users').insert(row).select().single()
  if (error) throw error
  return mapUserFromDb(data)
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  if (isSupabaseConfigured && supabase) {
    try {
      const row = mapUserToDb(updates)
      const { data, error } = await supabase.from('users').update(row).eq('id', id).select().maybeSingle()
      if (!error && data) return mapUserFromDb(data)
    } catch (e) {
      console.warn('[DB] Supabase updateUser error, fallback:', e)
    }
  }
  const users = localGet<User[]>('users') ?? []
  const idx = users.findIndex(u => u.id === id)
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates }
    localSet('users', users)
    return users[idx]
  }
  return { id, ...updates } as User
}

export async function checkEmailExists(email: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    const users = localGet<User[]>('users') ?? []
    return users.some(u => u.email.toLowerCase() === email.toLowerCase())
  }
  const { count, error } = await supabase
    .from('users').select('id', { count: 'exact', head: true }).ilike('email', email)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function checkCompanyEmailExists(email: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    const companies = localGet<Company[]>('companies') ?? []
    return companies.some(c => c.email.toLowerCase() === email.toLowerCase())
  }
  const { count, error } = await supabase
    .from('companies').select('id', { count: 'exact', head: true }).ilike('email', email)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function deleteUser(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const users = localGet<User[]>('users') ?? []
    localSet('users', users.filter(u => u.id !== id))
    return
  }
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// POSITIONS
// ============================================================

export async function getPositionsByCompanyId(companyId: string): Promise<Position[]> {
  if (!isSupabaseConfigured || !supabase) {
    const positions = localGet<Position[]>('positions') ?? []
    return positions.filter(p => p.companyId === companyId)
  }
  const { data, error } = await supabase
    .from('positions').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPositionFromDb)
}

export async function createPosition(position: Position): Promise<Position> {
  if (!isSupabaseConfigured || !supabase) {
    const positions = localGet<Position[]>('positions') ?? []
    positions.push(position)
    localSet('positions', positions)
    return position
  }
  const row = mapPositionToDb(position)
  const { data, error } = await supabase.from('positions').insert(row).select().single()
  if (error) throw error
  return mapPositionFromDb(data)
}

export async function updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
  if (!isSupabaseConfigured || !supabase) {
    const positions = localGet<Position[]>('positions') ?? []
    const idx = positions.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('Position not found')
    positions[idx] = { ...positions[idx], ...updates }
    localSet('positions', positions)
    return positions[idx]
  }
  const row = mapPositionToDb(updates)
  const { data, error } = await supabase.from('positions').update(row).eq('id', id).select().single()
  if (error) throw error
  return mapPositionFromDb(data)
}

export async function deletePosition(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const positions = localGet<Position[]>('positions') ?? []
    localSet('positions', positions.filter(p => p.id !== id))
    return
  }
  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// CANDIDATES
// ============================================================

export async function getCandidatesByPositionIds(positionIds: string[]): Promise<Candidate[]> {
  if (positionIds.length === 0) return []
  if (!isSupabaseConfigured || !supabase) {
    const candidates = localGet<Candidate[]>('candidates') ?? []
    const ids = new Set(positionIds)
    return candidates.filter(c => ids.has(c.positionId))
  }
  const { data, error } = await supabase
    .from('candidates').select('*').in('position_id', positionIds).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapCandidateFromDb)
}

export async function getCandidatesPaginated(
  positionId: string,
  page: number,
  pageSize: number
): Promise<{ candidates: Candidate[]; total: number }> {
  if (!isSupabaseConfigured || !supabase) {
    const candidates = localGet<Candidate[]>('candidates') ?? []
    const filtered = candidates.filter(c => c.positionId === positionId)
    const start = (page - 1) * pageSize
    return { candidates: filtered.slice(start, start + pageSize), total: filtered.length }
  }
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await supabase
    .from('candidates')
    .select('*', { count: 'exact' })
    .eq('position_id', positionId)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { candidates: (data ?? []).map(mapCandidateFromDb), total: count ?? 0 }
}

export async function createCandidate(candidate: Candidate): Promise<Candidate> {
  if (!isSupabaseConfigured || !supabase) {
    const candidates = localGet<Candidate[]>('candidates') ?? []
    candidates.push(candidate)
    localSet('candidates', candidates)
    return candidate
  }
  const row = mapCandidateToDb(candidate)
  const { data, error } = await supabase.from('candidates').insert(row).select().single()
  if (error) throw error
  return mapCandidateFromDb(data)
}

export async function updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate> {
  if (!isSupabaseConfigured || !supabase) {
    const candidates = localGet<Candidate[]>('candidates') ?? []
    const idx = candidates.findIndex(c => c.id === id)
    if (idx === -1) throw new Error('Candidate not found')
    candidates[idx] = { ...candidates[idx], ...updates }
    localSet('candidates', candidates)
    return candidates[idx]
  }
  const row = mapCandidateToDb(updates)
  const { data, error } = await supabase.from('candidates').update(row).eq('id', id).select().single()
  if (error) throw error
  return mapCandidateFromDb(data)
}

export async function deleteCandidate(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const candidates = localGet<Candidate[]>('candidates') ?? []
    localSet('candidates', candidates.filter(c => c.id !== id))
    return
  }
  const { error } = await supabase.from('candidates').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// SYNC HELPERS
// Diffent un ancien et un nouveau tableau pour appliquer les
// opérations CRUD correspondantes côté Supabase.
// ============================================================

export async function syncPositions(prev: Position[], next: Position[]): Promise<void> {
  const prevMap = new Map(prev.map(p => [p.id, p]))
  const nextMap = new Map(next.map(p => [p.id, p]))

  const promises: Promise<unknown>[] = []

  for (const p of next) {
    if (!prevMap.has(p.id)) {
      promises.push(createPosition(p))
    } else if (JSON.stringify(prevMap.get(p.id)) !== JSON.stringify(p)) {
      promises.push(updatePosition(p.id, p))
    }
  }
  for (const p of prev) {
    if (!nextMap.has(p.id)) {
      promises.push(deletePosition(p.id))
    }
  }

  await Promise.all(promises)
}

export async function syncCandidates(prev: Candidate[], next: Candidate[]): Promise<void> {
  const prevMap = new Map(prev.map(c => [c.id, c]))
  const nextMap = new Map(next.map(c => [c.id, c]))

  const promises: Promise<unknown>[] = []

  for (const c of next) {
    if (!prevMap.has(c.id)) {
      promises.push(createCandidate(c))
    } else if (JSON.stringify(prevMap.get(c.id)) !== JSON.stringify(c)) {
      promises.push(updateCandidate(c.id, c))
    }
  }
  for (const c of prev) {
    if (!nextMap.has(c.id)) {
      promises.push(deleteCandidate(c.id))
    }
  }

  await Promise.all(promises)
}
