import { useState } from 'react'
import { Company, Language, LicenseType } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  CreditCard,
  Check,
  X,
  Clock,
  Warning,
  Sparkle,
  Buildings,
  Rocket,
  Crown,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowCounterClockwise,
  Calendar,
  Question,
  CaretDown,
  Info,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  SUBSCRIPTION_PRICES,
  createStripeCheckoutSession,
  getDaysUntilExpiry,
  getSubscriptionStatusDetails,
} from '@/lib/payment'
import { getLicenseLimits } from '@/lib/license'

interface PaymentPageProps {
  company: Company
  language: Language
  onUpdateCompany: (company: Company) => void
  onCancel?: () => void
}

const planIcons: Record<LicenseType, React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular'; className?: string }>> = {
  trial: Sparkle,
  starter: Buildings,
  professional: Rocket,
  enterprise: Crown,
}

const planGradients: Record<LicenseType, string> = {
  trial: 'from-slate-500 to-slate-700',
  starter: 'from-blue-500 to-blue-700',
  professional: 'from-violet-500 to-fuchsia-600',
  enterprise: 'from-amber-500 to-orange-600',
}

const displayPlans: LicenseType[] = ['starter', 'professional', 'enterprise']

const comparisonFeatures = [
  { key: 'maxUsers', label: { fr: 'Utilisateurs', en: 'Users' }, values: {
    starter: '5', professional: '15', enterprise: 'Illimite'
  }},
  { key: 'maxPositions', label: { fr: 'Postes', en: 'Positions' }, values: {
    starter: '20', professional: '100', enterprise: 'Illimite'
  }},
  { key: 'maxCandidates', label: { fr: 'Candidats/poste', en: 'Candidates/pos' }, values: {
    starter: '200', professional: '1000', enterprise: 'Illimite'
  }},
  { key: 'bulkOperations', label: { fr: 'Traitement par lots', en: 'Bulk operations' }, values: {
    starter: true, professional: true, enterprise: true
  }},
  { key: 'emailTemplates', label: { fr: 'Templates email', en: 'Email templates' }, values: {
    starter: true, professional: true, enterprise: true
  }},
  { key: 'advancedAnalytics', label: { fr: 'Analytiques avancees', en: 'Advanced analytics' }, values: {
    starter: false, professional: true, enterprise: true
  }},
  { key: 'bulkScoring', label: { fr: 'Scoring en masse', en: 'Bulk scoring' }, values: {
    starter: false, professional: true, enterprise: true
  }},
  { key: 'prioritySupport', label: { fr: 'Support prioritaire', en: 'Priority support' }, values: {
    starter: false, professional: true, enterprise: true
  }},
  { key: 'apiAccess', label: { fr: 'Acces API', en: 'API access' }, values: {
    starter: false, professional: false, enterprise: true
  }},
  { key: 'customBranding', label: { fr: 'Marque blanche', en: 'White label' }, values: {
    starter: false, professional: false, enterprise: true
  }},
  { key: 'dedicatedManager', label: { fr: 'Account manager', en: 'Account manager' }, values: {
    starter: false, professional: false, enterprise: true
  }},
  { key: 'sla', label: { fr: 'SLA 99.9%', en: 'SLA 99.9%' }, values: {
    starter: false, professional: false, enterprise: true
  }},
]

export function PaymentPage({ company, language, onUpdateCompany, onCancel }: PaymentPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<LicenseType>(
    company.license.type === 'trial' ? 'professional' : company.license.type
  )
  const [isYearly, setIsYearly] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const texts = {
    fr: {
      // Hero
      heroBadge: 'Tarifs',
      heroTitle: 'Boostez votre recrutement avec l\'IA',
      heroSubtitle: 'Des plans flexibles concus pour les equipes de toutes tailles. Commencez gratuitement, evoluez a votre rythme.',
      // Billing toggle
      monthly: 'Mensuel',
      yearly: 'Annuel',
      savePercent: '-17%',
      perMonth: '/mois',
      perYear: '/an',
      // Plan cards
      popularBadge: 'Le plus populaire',
      currentBadge: 'Plan actuel',
      starter: 'Demarrage',
      professional: 'Professionnel',
      enterprise: 'Enterprise',
      starterDesc: 'Pour les petites equipes',
      professionalDesc: 'Pour les equipes en croissance',
      enterpriseDesc: 'Pour les grandes organisations',
      getStarted: 'Commencer',
      contactSales: 'Contacter les ventes',
      customPrice: 'Sur devis',
      upgradeTo: 'Passer a',
      // Feature comparison
      comparisonTitle: 'Comparaison detaillee des plans',
      comparisonSubtitle: 'Trouvez le plan parfait pour vos besoins de recrutement',
      feature: 'Fonctionnalite',
      included: 'Inclus',
      notIncluded: 'Non inclus',
      unlimited: 'Illimite',
      // Current subscription
      currentPlan: 'Votre plan actuel',
      expiresIn: 'Expire dans',
      days: 'jours',
      status: 'Statut',
      managePlan: 'Gerer votre plan',
      // Payment flow
      processing: 'Redirection vers Stripe...',
      processPayment: 'Paiement securise',
      cancel: 'Annuler',
      // Summary sidebar
      summary: 'Resume',
      planLabel: 'Plan',
      billingLabel: 'Facturation',
      total: 'Total',
      allFees: 'Tous les frais sont en EUR. TVA applicable.',
      // Trust
      trustStripe: 'Paiement securise via Stripe',
      trustSSL: 'Cryptage SSL 256-bit',
      trustGuarantee: 'Garantie 30 jours satisfait ou rembourse',
      // FAQ
      faqTitle: 'Questions frequentes',
      faqSubtitle: 'Tout ce que vous devez savoir sur nos abonnements',
      faqQ1: 'Puis-je changer de plan a tout moment ?',
      faqA1: 'Oui, vous pouvez upgrader ou downgrader votre plan a tout moment. Le changement est effectif immediatement et le montant est proratise sur la periode restante.',
      faqQ2: 'Comment fonctionne la periode d\'essai ?',
      faqA2: 'Vous beneficiez de 14 jours d\'essai gratuit avec toutes les fonctionnalites du plan Professionnel. Aucune carte bancaire n\'est requise pour demarrer.',
      faqQ3: 'Puis-je annuler mon abonnement ?',
      faqA3: 'Absolument. Vous pouvez annuler a tout moment depuis votre espace. Votre acces reste actif jusqu\'a la fin de la periode deja payee.',
      faqQ4: 'Quels moyens de paiement acceptez-vous ?',
      faqA4: 'Nous acceptons les cartes Visa, Mastercard et American Express. Tous les paiements sont traites de maniere securisee par Stripe.',
      faqQ5: 'Proposez-vous des reductions pour les startups ?',
      faqA5: 'Oui, nous offrons 30% de reduction sur le plan Professionnel pour les startups de moins de 2 ans. Contactez-nous pour en beneficier.',
      faqQ6: 'Mes donnees de paiement sont-elles securisees ?',
      faqA6: 'Vos donnees bancaires ne sont jamais stockees sur nos serveurs. Tous les paiements sont traites par Stripe, certifie PCI DSS niveau 1.',
      // Status banner
      trialActive: 'Periode d\'essai active',
      subscriptionActive: 'Abonnement actif',
      noSubscription: 'Aucun abonnement actif',
      recommended: 'Recommande',
    },
    en: {
      // Hero
      heroBadge: 'Pricing',
      heroTitle: 'Supercharge your recruitment with AI',
      heroSubtitle: 'Flexible plans designed for teams of all sizes. Start free, scale at your own pace.',
      // Billing toggle
      monthly: 'Monthly',
      yearly: 'Yearly',
      savePercent: '-17%',
      perMonth: '/mo',
      perYear: '/yr',
      // Plan cards
      popularBadge: 'Most popular',
      currentBadge: 'Current plan',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
      starterDesc: 'For small teams',
      professionalDesc: 'For growing teams',
      enterpriseDesc: 'For large organizations',
      getStarted: 'Get started',
      contactSales: 'Contact sales',
      customPrice: 'Custom',
      upgradeTo: 'Upgrade to',
      // Feature comparison
      comparisonTitle: 'Detailed plan comparison',
      comparisonSubtitle: 'Find the perfect plan for your recruitment needs',
      feature: 'Feature',
      included: 'Included',
      notIncluded: 'Not included',
      unlimited: 'Unlimited',
      // Current subscription
      currentPlan: 'Your current plan',
      expiresIn: 'Expires in',
      days: 'days',
      status: 'Status',
      managePlan: 'Manage your plan',
      // Payment flow
      processing: 'Redirecting to Stripe...',
      processPayment: 'Secure payment',
      cancel: 'Cancel',
      // Summary sidebar
      summary: 'Summary',
      planLabel: 'Plan',
      billingLabel: 'Billing',
      total: 'Total',
      allFees: 'All fees are in EUR. VAT applies.',
      // Trust
      trustStripe: 'Secure payment via Stripe',
      trustSSL: '256-bit SSL encryption',
      trustGuarantee: '30-day money-back guarantee',
      // FAQ
      faqTitle: 'Frequently asked questions',
      faqSubtitle: 'Everything you need to know about our subscriptions',
      faqQ1: 'Can I change my plan at any time?',
      faqA1: 'Yes, you can upgrade or downgrade your plan at any time. The change is effective immediately and the amount is prorated for the remaining period.',
      faqQ2: 'How does the free trial work?',
      faqA2: 'You get 14 days of free trial with all Professional plan features. No credit card is required to get started.',
      faqQ3: 'Can I cancel my subscription?',
      faqA3: 'Absolutely. You can cancel at any time from your dashboard. Your access remains active until the end of the already paid period.',
      faqQ4: 'What payment methods do you accept?',
      faqA4: 'We accept Visa, Mastercard, and American Express. All payments are securely processed by Stripe.',
      faqQ5: 'Do you offer discounts for startups?',
      faqA5: 'Yes, we offer a 30% discount on the Professional plan for startups less than 2 years old. Contact us to apply.',
      faqQ6: 'Is my payment data secure?',
      faqA6: 'Your banking data is never stored on our servers. All payments are processed by Stripe, certified PCI DSS Level 1.',
      // Status banner
      trialActive: 'Active trial period',
      subscriptionActive: 'Active subscription',
      noSubscription: 'No active subscription',
      recommended: 'Recommended',
    },
  }

  const t = texts[language]
  const daysRemaining = getDaysUntilExpiry(company)
  const statusInfo = getSubscriptionStatusDetails(company.subscription.status, language)
  const planNames: Record<LicenseType, Record<'fr' | 'en', string>> = {
    trial: { fr: 'Essai', en: 'Trial' },
    starter: { fr: t.starter, en: t.starter },
    professional: { fr: t.professional, en: t.professional },
    enterprise: { fr: t.enterprise, en: t.enterprise },
  }
  const planDescs: Record<LicenseType, Record<'fr' | 'en', string>> = {
    trial: { fr: '', en: '' },
    starter: { fr: t.starterDesc, en: t.starterDesc },
    professional: { fr: t.professionalDesc, en: t.professionalDesc },
    enterprise: { fr: t.enterpriseDesc, en: t.enterpriseDesc },
  }

  const getPlanAmount = (plan: LicenseType) => {
    const price = SUBSCRIPTION_PRICES[plan]
    return isYearly ? price.yearly : price.monthly
  }

  const handlePayment = async () => {
    if (selectedPlan === company.license.type && company.subscription.status === 'active') {
      toast.info(
        language === 'fr'
          ? 'Vous etes deja sur ce plan.'
          : 'You are already on this plan.'
      )
      return
    }

    setIsProcessing(true)

    try {
      const { url } = await createStripeCheckoutSession(
        selectedPlan,
        isYearly ? 'yearly' : 'monthly',
        company.id
      )

      if (url) {
        window.location.href = url
      } else {
        toast.error(
          language === 'fr'
            ? 'Erreur lors de la creation de la session de paiement. Veuillez reessayer.'
            : 'Error creating payment session. Please try again.'
        )
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : language === 'fr'
            ? 'Erreur lors du paiement. Veuillez reessayer.'
            : 'Payment error. Please try again.'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const getComparisonValue = (plan: LicenseType, key: string): string | boolean => {
    const limits = getLicenseLimits(plan)
    if (key === 'maxUsers') return limits.maxUsers === -1 ? t.unlimited : String(limits.maxUsers)
    if (key === 'maxPositions') return limits.maxPositions === -1 ? t.unlimited : String(limits.maxPositions)
    if (key === 'maxCandidates') return limits.maxCandidatesPerPosition === -1 ? t.unlimited : String(limits.maxCandidatesPerPosition)
    if (key in limits.features) return limits.features[key as keyof typeof limits.features]

    const extraFeatures: Record<string, LicenseType[]> = {
      prioritySupport: ['professional', 'enterprise'],
      dedicatedManager: ['enterprise'],
      sla: ['enterprise'],
      bulkScoring: ['professional', 'enterprise'],
    }
    if (extraFeatures[key]) return extraFeatures[key].includes(plan)
    return false
  }

  const hasActiveSubscription = company.subscription.status === 'active' || company.subscription.status === 'trialing'
  const selectedAmount = getPlanAmount(selectedPlan)

  return (
    <div className="w-full">
      {/* HERO — sobre */}
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 text-center">
        <Badge variant="secondary" className="text-xs font-medium px-3 py-1 mb-3">
          {t.heroBadge}
        </Badge>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t.heroTitle}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto mt-2">
          {t.heroSubtitle}
        </p>
      </div>

      {/* ================================================================ */}
      {/* CURRENT SUBSCRIPTION STATUS BANNER                               */}
      {/* ================================================================ */}
      {hasActiveSubscription && (
        <div className="max-w-6xl mx-auto px-4 mb-12">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between p-4 md:p-5">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Info size={22} weight="duotone" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm md:text-base font-semibold">
                        {company.subscription.status === 'trialing' ? t.trialActive : t.subscriptionActive}
                      </p>
                      <Badge variant={statusInfo.variant === 'destructive' ? 'destructive' : 'default'} className="text-[10px] h-5">
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                      <span className="capitalize">{planNames[company.license.type][language]}</span>
                      {' '}&middot;{' '}
                      {t.expiresIn} {daysRemaining} {t.days}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar size={16} weight="duotone" className="text-muted-foreground hidden sm:block" />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {new Date(company.license.expiryDate).toLocaleDateString(
                      language === 'fr' ? 'fr-FR' : 'en-US'
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ================================================================ */}
      {/* BILLING TOGGLE                                                   */}
      {/* ================================================================ */}
      <div className="max-w-6xl mx-auto px-4 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex items-center justify-center gap-4"
        >
          <span className={cn(
            'text-sm md:text-base font-medium transition-colors',
            !isYearly ? 'text-foreground' : 'text-muted-foreground cursor-pointer'
          )}
            onClick={() => setIsYearly(false)}
          >
            {t.monthly}
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary scale-110"
          />
          <span className={cn(
            'text-sm md:text-base font-medium transition-colors flex items-center gap-2',
            isYearly ? 'text-foreground' : 'text-muted-foreground cursor-pointer'
          )}
            onClick={() => setIsYearly(true)}
          >
            {t.yearly}
            <Badge
              variant="default"
              className="text-[10px] md:text-[11px] px-1.5 py-0 h-5 bg-emerald-500 hover:bg-emerald-500 font-semibold"
            >
              {t.savePercent}
            </Badge>
          </span>
        </motion.div>
      </div>

      {/* ================================================================ */}
      {/* MAIN LAYOUT: PLANS + SIDEBAR                                     */}
      {/* ================================================================ */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Plan cards - taking 2/3 on large screens */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {displayPlans.map((plan, index) => {
                const Icon = planIcons[plan]
                const amount = getPlanAmount(plan)
                const isCurrent = company.license.type === plan && hasActiveSubscription
                const isPopular = plan === 'professional'
                const isEnterprise = plan === 'enterprise'
                const isSelected = selectedPlan === plan

                return (
                  <motion.div
                    key={plan}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                    className="flex"
                  >
                    <div
                      onClick={() => setSelectedPlan(plan)}
                      className={cn(
                        'relative flex flex-col w-full rounded-xl border-2 cursor-pointer transition-all duration-200 group bg-card',
                        isSelected
                          ? isEnterprise
                            ? 'border-amber-500 shadow-sm'
                            : isPopular
                              ? 'border-primary shadow-sm'
                              : 'border-primary shadow-sm'
                          : 'border-border hover:border-primary/30 hover:shadow-sm',
                        isPopular && !isEnterprise && !isSelected && 'border-primary/30',
                      )}
                    >
                      {/* Color accent top — sobre */}
                      {(isPopular || isEnterprise) && (
                        <div className={cn(
                          'h-1 rounded-t-[11px]',
                          isPopular ? 'bg-primary' : 'bg-amber-500'
                        )} />
                      )}

                      {/* Popular badge — sobre */}
                      {isPopular && (
                        <div className="absolute -top-3 left-0 right-0 flex justify-center">
                          <Badge variant="secondary" className="text-[10px] md:text-xs px-3 py-0.5 shadow-sm">
                            {t.popularBadge}
                          </Badge>
                        </div>
                      )}

                      {/* Current badge */}
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="absolute top-3 right-3 text-[10px] h-5 z-10 bg-background"
                        >
                          {t.currentBadge}
                        </Badge>
                      )}

                      <div className={cn('p-5 md:p-6 flex flex-col flex-1', isPopular && 'pt-7')}>
                        {/* Icon + Name */}
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className={cn(
                            'p-2 rounded-lg',
                            plan === 'starter' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                            plan === 'professional' && 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
                            plan === 'enterprise' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                          )}>
                            <Icon size={20} weight="duotone" />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-bold">{planNames[plan][language]}</h3>
                            <p className="text-[11px] md:text-xs text-muted-foreground">
                              {planDescs[plan][language]}
                            </p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mb-5">
                          {isEnterprise ? (
                            <div>
                              <span className="text-2xl md:text-3xl font-extrabold">{t.customPrice}</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl md:text-3xl font-extrabold">{formatCurrency(amount)}</span>
                                <span className="text-xs md:text-sm text-muted-foreground">
                                  {isYearly ? t.perYear : t.perMonth}
                                </span>
                              </div>
                              {isYearly && amount > 0 && (
                                <p className="text-[11px] text-emerald-500 font-medium mt-0.5">
                                  {t.savePercent} {language === 'fr' ? 'vs mensuel' : 'vs monthly'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        <div className="flex-1 space-y-2.5 mb-5">
                          {plan === 'starter' && (
                            <>
                              <FeatureRow included label={language === 'fr' ? '5 utilisateurs' : '5 users'} />
                              <FeatureRow included label={language === 'fr' ? '20 postes' : '20 positions'} />
                              <FeatureRow included label={language === 'fr' ? '200 candidats/poste' : '200 candidates/pos'} />
                              <FeatureRow included label={language === 'fr' ? 'Traitement par lots' : 'Bulk operations'} />
                              <FeatureRow included label={language === 'fr' ? 'Templates email' : 'Email templates'} />
                              <FeatureRow included={false} label={language === 'fr' ? 'Analytiques avancees' : 'Advanced analytics'} />
                              <FeatureRow included={false} label={language === 'fr' ? 'Acces API' : 'API access'} />
                            </>
                          )}
                          {plan === 'professional' && (
                            <>
                              <FeatureRow included label={language === 'fr' ? '15 utilisateurs' : '15 users'} />
                              <FeatureRow included label={language === 'fr' ? '100 postes' : '100 positions'} />
                              <FeatureRow included label={language === 'fr' ? '1000 candidats/poste' : '1000 candidates/pos'} />
                              <FeatureRow included label={language === 'fr' ? 'Analytiques avancees' : 'Advanced analytics'} />
                              <FeatureRow included label={language === 'fr' ? 'Scoring en masse' : 'Bulk scoring'} />
                              <FeatureRow included label={language === 'fr' ? 'Support prioritaire' : 'Priority support'} />
                              <FeatureRow included={false} label={language === 'fr' ? 'Acces API' : 'API access'} />
                            </>
                          )}
                          {plan === 'enterprise' && (
                            <>
                              <FeatureRow included label={language === 'fr' ? 'Utilisateurs illimites' : 'Unlimited users'} />
                              <FeatureRow included label={language === 'fr' ? 'Postes illimites' : 'Unlimited positions'} />
                              <FeatureRow included label={language === 'fr' ? 'Candidats illimites' : 'Unlimited candidates'} />
                              <FeatureRow included label={language === 'fr' ? 'Acces API' : 'API access'} />
                              <FeatureRow included label={language === 'fr' ? 'Marque blanche' : 'White label'} />
                              <FeatureRow included label={language === 'fr' ? 'Account manager dedie' : 'Dedicated account manager'} />
                              <FeatureRow included label={language === 'fr' ? 'SLA 99.9%' : 'SLA 99.9%'} />
                            </>
                          )}
                        </div>

                        {/* CTA Button */}
                        {isCurrent ? (
                          <Button className="w-full h-10 md:h-11" variant="outline" disabled>
                            <Check size={16} weight="bold" className="mr-1.5" />
                            {t.currentBadge}
                          </Button>
                        ) : isEnterprise ? (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `mailto:contact@ai-recruitment-score.fr?subject=${language === 'fr' ? 'Demande%20de%20devis%20Enterprise' : 'Enterprise%20Plan%20Quote'}`
                            }}
                            className="w-full h-10 md:h-11 gap-1.5 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                          >
                            {t.contactSales}
                            <ArrowRight size={16} weight="bold" />
                          </Button>
                        ) : (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPlan(plan)
                              // Scroll to summary
                              document.getElementById('payment-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }}
                            className={cn(
                              'w-full h-10 md:h-11 gap-1.5 font-semibold',
                              isPopular
                                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0'
                                : ''
                            )}
                            variant={isPopular ? 'default' : 'outline'}
                          >
                            {t.getStarted}
                            <ArrowRight size={16} weight="bold" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Feature Comparison Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-12"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{t.comparisonTitle}</h2>
                <p className="text-muted-foreground text-sm md:text-base">{t.comparisonSubtitle}</p>
              </div>

              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left p-4 font-semibold">{t.feature}</th>
                        {displayPlans.map((plan) => (
                          <th key={plan} className="p-4 text-center font-semibold min-w-[120px]">
                            <span className={cn(
                              plan === 'professional' && 'text-primary',
                              plan === 'enterprise' && 'text-amber-500'
                            )}>
                              {planNames[plan][language]}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((feature, idx) => (
                        <tr
                          key={feature.key}
                          className={cn(
                            'border-b border-border/50 transition-colors hover:bg-muted/20',
                            idx % 2 === 0 && 'bg-muted/10'
                          )}
                        >
                          <td className="p-4 font-medium">{feature.label[language]}</td>
                          {displayPlans.map((plan) => {
                            const value = getComparisonValue(plan, feature.key)
                            const isBool = typeof value === 'boolean'
                            const displayValue = String(isBool ? (value ? '✓' : '✗') : value)

                            return (
                              <td key={plan} className="p-4 text-center">
                                {isBool ? (
                                  value ? (
                                    <Check size={18} weight="bold" className="text-emerald-500 mx-auto" />
                                  ) : (
                                    <X size={18} weight="bold" className="text-muted-foreground/30 mx-auto" />
                                  )
                                ) : (
                                  <span className={cn(
                                    'font-medium',
                                    String(value) === t.unlimited && 'text-emerald-500'
                                  )}>
                                    {String(value)}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </motion.div>

            {/* Trust Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-12"
            >
              <Separator className="mb-8" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="flex items-center gap-3 p-3">
                  <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <ShieldCheck size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.trustGuarantee.split(' ').slice(0, 2).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">{t.trustGuarantee.split(' ').slice(2).join(' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                    <Lock size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.trustSSL}</p>
                    <p className="text-xs text-muted-foreground">TLS 1.3, AES-256</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3">
                  <div className="p-2.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <CreditCard size={22} weight="duotone" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.trustStripe}</p>
                    <p className="text-xs text-muted-foreground">PCI DSS Niveau 1</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* FAQ Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-16"
            >
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Question size={24} weight="duotone" className="text-primary" />
                  <h2 className="text-2xl md:text-3xl font-bold">{t.faqTitle}</h2>
                </div>
                <p className="text-muted-foreground text-sm md:text-base">{t.faqSubtitle}</p>
              </div>

              <Card>
                <CardContent className="pt-6 pb-2">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ1}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA1}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ2}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA2}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ3}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA3}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ4}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA4}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-5">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ5}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA5}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-6">
                      <AccordionTrigger className="text-sm md:text-base font-medium hover:no-underline">
                        {t.faqQ6}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {t.faqA6}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar - Payment Summary (sticky) */}
          <div className="lg:col-span-1" id="payment-summary">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="lg:sticky lg:top-6"
            >
              <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard size={20} weight="duotone" className="text-primary" />
                    {t.summary}
                  </CardTitle>
                  <CardDescription>
                    {planNames[selectedPlan][language]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.planLabel}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-semibold capitalize',
                          selectedPlan === 'professional' && 'bg-primary/10 text-primary',
                          selectedPlan === 'enterprise' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        )}
                      >
                        {planNames[selectedPlan][language]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.billingLabel}</span>
                      <span className="text-sm font-medium">
                        {isYearly ? t.yearly : t.monthly}
                        {isYearly && (
                          <Badge className="ml-1.5 text-[10px] h-4 px-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0">
                            {t.savePercent}
                          </Badge>
                        )}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold">{t.total}</span>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold">
                        {selectedPlan === 'enterprise'
                          ? t.customPrice
                          : formatCurrency(selectedAmount)
                        }
                      </div>
                      {selectedPlan !== 'enterprise' && (
                        <div className="text-[11px] text-muted-foreground">
                          {isYearly ? t.perYear : t.perMonth}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center">
                    {t.allFees}
                  </p>

                  {selectedPlan !== 'enterprise' && selectedPlan !== company.license.type && (
                    <Button
                      onClick={handlePayment}
                      disabled={isProcessing}
                      className={cn(
                        'w-full h-12 gap-2 text-base font-semibold',
                        selectedPlan === 'professional'
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600'
                          : ''
                      )}
                      size="lg"
                    >
                      {isProcessing ? (
                        <>
                          <Clock size={20} weight="duotone" className="animate-spin" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <Lock size={18} weight="duotone" />
                          {t.processPayment}
                        </>
                      )}
                    </Button>
                  )}

                  {selectedPlan === company.license.type && hasActiveSubscription && selectedPlan !== 'trial' && (
                    <Button className="w-full" variant="outline" disabled>
                      <Check size={16} weight="bold" className="mr-1.5" />
                      {t.currentBadge}
                    </Button>
                  )}

                  {selectedPlan === 'enterprise' && (
                    <Button
                      onClick={() => {
                        window.location.href = `mailto:contact@ai-recruitment-score.fr?subject=${language === 'fr' ? 'Demande%20de%20devis%20Enterprise' : 'Enterprise%20Plan%20Quote'}`
                      }}
                      className="w-full h-12 gap-2 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                    >
                      {t.contactSales}
                      <ArrowRight size={18} weight="bold" />
                    </Button>
                  )}

                  {onCancel && (
                    <Button
                      onClick={onCancel}
                      variant="ghost"
                      className="w-full"
                      disabled={isProcessing}
                    >
                      {t.cancel}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper component for plan feature rows
function FeatureRow({ included, label }: { included: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs md:text-sm">
      {included ? (
        <Check size={15} weight="bold" className="text-emerald-500 shrink-0" />
      ) : (
        <X size={15} weight="bold" className="text-muted-foreground/30 shrink-0" />
      )}
      <span className={cn(!included && 'text-muted-foreground/50')}>
        {label}
      </span>
    </div>
  )
}
