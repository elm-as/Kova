import { Company, PaymentReminder, LicenseType, PaymentHistory, Language } from './types'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { kvGet, kvSet } from './kv'

export const SUBSCRIPTION_PRICES: Record<LicenseType, { monthly: number; yearly: number; currency: string }> = {
  trial: { monthly: 0, yearly: 0, currency: 'EUR' },
  starter: { monthly: 29, yearly: 290, currency: 'EUR' },
  professional: { monthly: 79, yearly: 790, currency: 'EUR' },
  enterprise: { monthly: 199, yearly: 1990, currency: 'EUR' },
}

export interface InvoiceData {
  invoiceNumber: string
  companyName: string
  companyEmail: string
  planName: string
  billingCycle: 'monthly' | 'yearly'
  amount: number
  currency: string
  status: PaymentHistory['status']
  date: number
  paymentMethod?: string
  companyAddress?: string
  vatNumber?: string
}

export interface SavedPaymentMethod {
  id: string
  type: 'card' | 'sepa' | 'paypal'
  last4?: string
  brand?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  createdAt: number
}

export function isSubscriptionExpired(company: Company): boolean {
  if (!company.subscription) {
    return company.license?.expiryDate ? company.license.expiryDate < Date.now() : false
  }
  return company.subscription.status === 'expired' || 
         company.subscription.status === 'canceled' ||
         company.license.expiryDate < Date.now()
}

export function isSubscriptionPastDue(company: Company): boolean {
  if (!company.subscription) return false
  return company.subscription.status === 'past_due'
}

export function getDaysUntilExpiry(company: Company): number {
  const daysRemaining = Math.ceil((company.license.expiryDate - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, daysRemaining)
}

export function shouldShowPaymentReminder(company: Company): boolean {
  const daysRemaining = getDaysUntilExpiry(company)
  
  if (isSubscriptionExpired(company)) return true
  if (isSubscriptionPastDue(company)) return true
  
  if (daysRemaining <= 7 && daysRemaining > 0) {
    const lastReminder = company.paymentReminders?.[company.paymentReminders.length - 1]
    if (!lastReminder) return true
    if (!lastReminder.acknowledged) return true
    
    const daysSinceLastReminder = Math.floor((Date.now() - lastReminder.sentAt) / (1000 * 60 * 60 * 24))
    return daysSinceLastReminder >= 2
  }
  
  return false
}

export function getPaymentReminderType(company: Company): 'upcoming' | 'overdue' | 'expiring_soon' {
  if (isSubscriptionExpired(company)) return 'overdue'
  if (isSubscriptionPastDue(company)) return 'overdue'
  
  const daysRemaining = getDaysUntilExpiry(company)
  if (daysRemaining <= 3) return 'expiring_soon'
  
  return 'upcoming'
}

export function createDefaultSubscription(licenseType: LicenseType = 'trial') {
  const now = Date.now()
  const trialPeriod = 14 * 24 * 60 * 60 * 1000
  
  return {
    status: 'trialing' as const,
    currentPeriodEnd: now + trialPeriod,
    cancelAtPeriodEnd: false,
    nextPaymentDate: now + trialPeriod,
  }
}

/**
 * Create a Stripe Checkout Session via Netlify Function.
 * Returns a redirect URL to Stripe's hosted payment page.
 */
export async function createStripeCheckoutSession(
  plan: string,
  billingCycle: 'monthly' | 'yearly',
  companyId: string
): Promise<{ url: string; sessionId: string }> {
  const resp = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      billingCycle,
      companyId,
      successUrl: `${window.location.origin}/?payment=success`,
      cancelUrl: `${window.location.origin}/?payment=cancelled`,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Failed to create checkout session')
  }

  return resp.json()
}

/**
 * Validate a license server-side to prevent client clock manipulation.
 */
export async function validateLicenseServerSide(
  companyId: string,
  licenseType: string,
  expiryDate: number
): Promise<{ valid: boolean; isExpired: boolean; daysRemaining: number }> {
  try {
    const resp = await fetch('/api/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, licenseType, expiryDate }),
    })
    if (!resp.ok) throw new Error('Validation failed')
    return resp.json()
  } catch {
    // Fallback to client-side check if server is unreachable
    const now = Date.now()
    return {
      valid: expiryDate > now,
      isExpired: expiryDate < now,
      daysRemaining: Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))),
    }
  }
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Get payment history for a company from KV store.
 */
export async function getPaymentHistory(companyId: string): Promise<PaymentHistory[]> {
  const allHistory = await kvGet<PaymentHistory[]>('payment-history') || []
  return allHistory.filter((p) => p.companyId === companyId).sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Get all payment history (admin use).
 */
export async function getAllPaymentHistory(): Promise<PaymentHistory[]> {
  const history = await kvGet<PaymentHistory[]>('payment-history')
  return history || []
}

/**
 * Add a payment to history.
 */
export async function addPaymentHistory(payment: PaymentHistory): Promise<void> {
  const allHistory = await kvGet<PaymentHistory[]>('payment-history') || []
  allHistory.push(payment)
  await kvSet('payment-history', allHistory)
}

/**
 * Generate sequential invoice number.
 * Format: INV-{YEAR}{MONTH}-{sequential 4-digit number}
 */
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const allHistory = await kvGet<PaymentHistory[]>('payment-history') || []
  const thisMonthInvoices = allHistory.filter((p) => {
    const d = new Date(p.createdAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const sequential = String(thisMonthInvoices.length + 1).padStart(4, '0')
  return `INV-${yearMonth}-${sequential}`
}

/**
 * Format invoice data from payment history entry.
 */
export function getInvoiceData(
  payment: PaymentHistory,
  company: { name: string; email: string },
  planName: string,
  billingCycle: 'monthly' | 'yearly',
  options?: { companyAddress?: string; vatNumber?: string }
): InvoiceData {
  return {
    invoiceNumber: payment.id,
    companyName: company.name,
    companyEmail: company.email,
    planName,
    billingCycle,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    date: payment.createdAt,
    companyAddress: options?.companyAddress,
    vatNumber: options?.vatNumber,
  }
}

/**
 * Generate and download a PDF invoice using jsPDF.
 */
export function downloadInvoiceAsPDF(invoice: InvoiceData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Colors
  const primaryColor = '#2563EB'
  const darkColor = '#1E293B'
  const lightGray = '#F1F5F9'
  const midGray = '#94A3B8'

  // Header
  doc.setFillColor(primaryColor)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor('#FFFFFF')
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('FACTURE', 20, 25)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`N ${invoice.invoiceNumber}`, pageWidth - 20, 25, { align: 'right' })

  // Company info
  doc.setTextColor(darkColor)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('AI Recruitment Score', 20, 55)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(midGray)
  doc.text('123 Avenue de l\'Innovation', 20, 62)
  doc.text('75008 Paris, France', 20, 67)
  doc.text('SIRET: 123 456 789 00012', 20, 72)
  doc.text('TVA: FR12345678900', 20, 77)
  doc.text('contact@ai-recruitment-score.fr', 20, 82)

  // Client info
  doc.setFillColor(lightGray)
  doc.rect(20, 92, pageWidth - 40, 35, 'F')

  doc.setTextColor(darkColor)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('FACTURE A', 25, 102)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.companyName, 25, 110)
  doc.text(invoice.companyEmail, 25, 115)
  if (invoice.companyAddress) {
    doc.text(invoice.companyAddress, 25, 120)
  }

  // Invoice details
  doc.setTextColor(darkColor)
  doc.setFontSize(9)
  const detailX = pageWidth - 80
  doc.text('Date de facturation:', detailX, 102)
  doc.text(new Date(invoice.date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), detailX + 40, 102)
  doc.text('Statut:', detailX, 109)
  const statusLabels: Record<string, string> = {
    succeeded: 'Payee',
    failed: 'Echouee',
    pending: 'En attente',
    refunded: 'Remboursee',
  }
  doc.text(statusLabels[invoice.status] || invoice.status, detailX + 40, 109)

  if (invoice.vatNumber) {
    doc.text('TVA Client:', detailX, 116)
    doc.text(invoice.vatNumber, detailX + 40, 116)
  }

  // Table
  const tableY = 140
  doc.setFillColor(primaryColor)
  doc.rect(20, tableY, pageWidth - 40, 10, 'F')

  doc.setTextColor('#FFFFFF')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 25, tableY + 7)
  doc.text('Periode', 100, tableY + 7)
  doc.text('Qt', 140, tableY + 7)
  doc.text('Prix HT', 155, tableY + 7)
  doc.text('Total HT', pageWidth - 25, tableY + 7, { align: 'right' })

  const vatRate = 20
  const amountExclVat = invoice.amount / (1 + vatRate / 100)

  // Table body
  let rowY = tableY + 15
  doc.setTextColor(darkColor)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const cycleLabel = invoice.billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'
  doc.text(`Abonnement ${invoice.planName} (${cycleLabel})`, 25, rowY)
  doc.text(cycleLabel, 100, rowY)
  doc.text('1', 140, rowY)
  doc.text(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(amountExclVat), 155, rowY)
  doc.text(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(amountExclVat), pageWidth - 25, rowY, { align: 'right' })

  // Line separator
  rowY += 8
  doc.setDrawColor(midGray)
  doc.setLineWidth(0.2)
  doc.line(20, rowY, pageWidth - 20, rowY)

  // Totals
  rowY += 12
  const totalsX = pageWidth - 85
  doc.setFontSize(9)
  doc.text('Sous-total HT', totalsX, rowY)
  doc.text(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(amountExclVat), pageWidth - 25, rowY, { align: 'right' })

  rowY += 8
  doc.text(`TVA (${vatRate}%)`, totalsX, rowY)
  doc.text(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(invoice.amount - amountExclVat), pageWidth - 25, rowY, { align: 'right' })

  rowY += 10
  doc.setDrawColor(primaryColor)
  doc.setLineWidth(0.5)
  doc.line(totalsX, rowY - 4, pageWidth - 20, rowY - 4)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor)
  doc.text('Total TTC', totalsX, rowY)
  doc.text(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(invoice.amount), pageWidth - 25, rowY, { align: 'right' })

  // Footer
  doc.setTextColor(midGray)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  const footerY = 275
  doc.text('AI Recruitment Score - SAS au capital de 10 000 EUR', 20, footerY)
  doc.text('RCS Paris B 123 456 789 - TVA Intracommunautaire FR12345678900', 20, footerY + 5)
  doc.text('Conditions generales de vente disponibles sur demande.', 20, footerY + 10)
  doc.text(`Facture generee le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 20, footerY + 10, { align: 'right' })

  // Download
  doc.save(`facture-${invoice.invoiceNumber}.pdf`)
}

/**
 * Get saved payment methods from subscription data.
 */
export function getSavedPaymentMethods(company: Company): SavedPaymentMethod[] {
  const methods: SavedPaymentMethod[] = []

  if (company.subscription?.paymentMethod) {
    methods.push({
      id: 'primary',
      type: company.subscription.paymentMethod.type,
      last4: company.subscription.paymentMethod.last4,
      brand: company.subscription.paymentMethod.brand,
      isDefault: true,
      createdAt: company.subscription.lastPaymentDate || company.license.startDate,
    })
  }

  return methods
}

/**
 * Format payment status for badge display.
 * Returns variant and label.
 */
export function formatPaymentStatus(
  status: PaymentHistory['status'],
  language: Language = 'fr'
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const lang = language === 'es' ? 'fr' : language
  const map = {
    fr: {
      succeeded: { label: 'Reussi', variant: 'default' as const },
      failed: { label: 'Echoue', variant: 'destructive' as const },
      pending: { label: 'En attente', variant: 'secondary' as const },
      refunded: { label: 'Rembourse', variant: 'outline' as const },
    },
    en: {
      succeeded: { label: 'Succeeded', variant: 'default' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      refunded: { label: 'Refunded', variant: 'outline' as const },
    },
  }

  return map[lang][status] || { label: status, variant: 'outline' }
}

/**
 * Get subscription status details for display.
 */
export function getSubscriptionStatusDetails(
  status: Company['subscription']['status'],
  language: Language = 'fr'
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const lang = language === 'es' ? 'fr' : language
  const map = {
    fr: {
      active: { label: 'Actif', variant: 'default' as const },
      trialing: { label: 'Periode d\'essai', variant: 'secondary' as const },
      past_due: { label: 'Paiement en retard', variant: 'destructive' as const },
      canceled: { label: 'Annule', variant: 'destructive' as const },
      expired: { label: 'Expire', variant: 'destructive' as const },
    },
    en: {
      active: { label: 'Active', variant: 'default' as const },
      trialing: { label: 'Trial', variant: 'secondary' as const },
      past_due: { label: 'Past Due', variant: 'destructive' as const },
      canceled: { label: 'Canceled', variant: 'destructive' as const },
      expired: { label: 'Expired', variant: 'destructive' as const },
    },
  }

  return map[lang][status] || { label: status, variant: 'outline' }
}
