import { useState } from 'react'
import { Language, LicenseType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Check, X, ArrowRight, Sparkle, Buildings, Rocket, Crown, ShieldCheck, Lock, ArrowCounterClockwise } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SUBSCRIPTION_PRICES, formatCurrency } from '@/lib/payment'
import { getLicenseLimits } from '@/lib/license'

interface PricingSectionProps {
  language: Language
  onSelectPlan?: (plan: LicenseType, billingCycle: 'monthly' | 'yearly') => void
  currentPlan?: LicenseType
  variant?: 'full' | 'landing'
  className?: string
}

interface PlanFeature {
  key: string
  label: Record<'fr' | 'en', string>
  included: LicenseType[]
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

const planFeatures: PlanFeature[] = [
  { key: 'maxUsers', label: { fr: 'Utilisateurs', en: 'Users' }, included: ['starter', 'professional', 'enterprise'] },
  { key: 'maxPositions', label: { fr: 'Postes ouverts', en: 'Open positions' }, included: ['starter', 'professional', 'enterprise'] },
  { key: 'maxCandidates', label: { fr: 'Candidats par poste', en: 'Candidates per position' }, included: ['starter', 'professional', 'enterprise'] },
  { key: 'bulkOperations', label: { fr: 'Operations en masse', en: 'Bulk operations' }, included: ['starter', 'professional', 'enterprise'] },
  { key: 'emailTemplates', label: { fr: 'Templates email', en: 'Email templates' }, included: ['starter', 'professional', 'enterprise'] },
  { key: 'advancedAnalytics', label: { fr: 'Analytiques avancees', en: 'Advanced analytics' }, included: ['professional', 'enterprise'] },
  { key: 'apiAccess', label: { fr: 'Acces API', en: 'API access' }, included: ['enterprise'] },
  { key: 'customBranding', label: { fr: 'Marque personnalisee', en: 'Custom branding' }, included: ['enterprise'] },
  { key: 'prioritySupport', label: { fr: 'Support prioritaire', en: 'Priority support' }, included: ['professional', 'enterprise'] },
  { key: 'dedicatedManager', label: { fr: 'Account manager dedie', en: 'Dedicated account manager' }, included: ['enterprise'] },
  { key: 'customIntegrations', label: { fr: 'Integrations sur mesure', en: 'Custom integrations' }, included: ['enterprise'] },
  { key: 'sla', label: { fr: 'SLA garantie 99.9%', en: '99.9% SLA guarantee' }, included: ['enterprise'] },
]

const displayPlans: LicenseType[] = ['starter', 'professional', 'enterprise']

export default function PricingSection({
  language,
  onSelectPlan,
  currentPlan,
  variant = 'full',
  className,
}: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(true)

  const texts = {
    fr: {
      badge: 'Tarifs',
      title: 'Des plans adaptes a vos besoins',
      subtitle: 'Choisissez le plan qui correspond a la taille de votre entreprise et a vos objectifs de recrutement.',
      monthly: 'Mensuel',
      yearly: 'Annuel',
      savePercent: 'Economisez 17%',
      perMonth: '/mois',
      perYear: '/an',
      popular: 'Populaire',
      currentPlan: 'Plan actuel',
      getStarted: 'Commencer',
      contactSales: 'Contacter les ventes',
      upgrade: 'Passer a',
      downgrade: 'Revenir a',
      free: 'Gratuit',
      included: 'Inclus',
      notIncluded: 'Non inclus',
      trustTitle: 'Paiement 100% securise',
      trustDesc: 'Vos donnees de paiement sont chiffrees et traitees par Stripe, leader mondial de la securite des paiements en ligne.',
      guarantee: 'Garantie satisfait ou rembourse 30 jours',
      ssl: 'Connexion securisee SSL 256-bit',
      stripe: 'Alimente par Stripe',
    },
    en: {
      badge: 'Pricing',
      title: 'Plans tailored to your needs',
      subtitle: 'Choose the plan that fits your company size and recruitment goals.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      savePercent: 'Save 17%',
      perMonth: '/mo',
      perYear: '/yr',
      popular: 'Popular',
      currentPlan: 'Current plan',
      getStarted: 'Get started',
      contactSales: 'Contact sales',
      upgrade: 'Upgrade to',
      downgrade: 'Switch to',
      free: 'Free',
      included: 'Included',
      notIncluded: 'Not included',
      trustTitle: '100% Secure Payments',
      trustDesc: 'Your payment data is encrypted and processed by Stripe, the global leader in online payment security.',
      guarantee: '30-day money-back guarantee',
      ssl: '256-bit SSL secure connection',
      stripe: 'Powered by Stripe',
    },
  }

  const t = texts[language]
  const planNames: Record<LicenseType, Record<'fr' | 'en', string>> = {
    trial: { fr: 'Essai', en: 'Trial' },
    starter: { fr: 'Demarrage', en: 'Starter' },
    professional: { fr: 'Professionnel', en: 'Professional' },
    enterprise: { fr: 'Enterprise', en: 'Enterprise' },
  }

  const getPlanAmount = (plan: LicenseType) => {
    const price = SUBSCRIPTION_PRICES[plan]
    return isYearly ? price.yearly : price.monthly
  }

  const getFeatureValue = (plan: LicenseType, featureKey: string): string | boolean => {
    if (plan === 'trial' && !displayPlans.includes('trial' as LicenseType)) return false
    const limits = getLicenseLimits(plan)
    if (featureKey === 'maxUsers') return limits.maxUsers === -1 ? 'Unlimited' : String(limits.maxUsers)
    if (featureKey === 'maxPositions') return limits.maxPositions === -1 ? 'Unlimited' : String(limits.maxPositions)
    if (featureKey === 'maxCandidates') return limits.maxCandidatesPerPosition === -1 ? 'Unlimited' : String(limits.maxCandidatesPerPosition)
    if (featureKey in limits.features) return limits.features[featureKey as keyof typeof limits.features]
    // Non-limit features
    const extraFeatures: Record<string, LicenseType[]> = {
      prioritySupport: ['professional', 'enterprise'],
      dedicatedManager: ['enterprise'],
      customIntegrations: ['enterprise'],
      sla: ['enterprise'],
    }
    if (extraFeatures[featureKey]) return extraFeatures[featureKey].includes(plan)
    return false
  }

  const handleSelectPlan = (plan: LicenseType) => {
    if (plan === 'enterprise') {
      window.location.href = `mailto:contact@ai-recruitment-score.fr?subject=${language === 'fr' ? 'Demande%20de%20devis%20Enterprise' : 'Enterprise%20Plan%20Quote'}`
      return
    }
    onSelectPlan?.(plan, isYearly ? 'yearly' : 'monthly')
  }

  return (
    <section className={cn('w-full py-16 lg:py-24', className)}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 mb-8"
        >
          <Badge variant="secondary" className="text-xs font-medium px-3 py-1">
            {t.badge}
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            {t.title}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={cn('text-sm font-medium transition-colors', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>
            {t.monthly}
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <span className={cn('text-sm font-medium transition-colors flex items-center gap-2', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
            {t.yearly}
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-500 hover:bg-emerald-500">
              {t.savePercent}
            </Badge>
          </span>
        </motion.div>

        {/* Plan cards - 3 column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {displayPlans.map((plan, index) => {
            const Icon = planIcons[plan]
            const amount = getPlanAmount(plan)
            const isCurrent = currentPlan === plan
            const isPopular = plan === 'professional'
            const isEnterprise = plan === 'enterprise'
            const gradient = planGradients[plan]

            return (
              <motion.div
                key={plan}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                className="flex"
              >
                <Card
                  className={cn(
                    'relative flex flex-col w-full transition-all duration-300',
                    isPopular && !isEnterprise
                      ? 'border-primary shadow-lg shadow-primary/10 scale-[1.03] md:scale-105 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30 hover:shadow-md',
                    isEnterprise && 'border-amber-500/40 hover:border-amber-500/60',
                    isCurrent && 'ring-2 ring-primary/30'
                  )}
                >
                  {/* Gradient header for popular or enterprise */}
                  {(isPopular || isEnterprise) && (
                    <div
                      className={cn(
                        'h-1.5 rounded-t-xl',
                        isPopular
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                          : 'bg-gradient-to-r from-amber-400 to-orange-500'
                      )}
                    />
                  )}

                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-0 right-0 flex justify-center">
                      <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white text-xs px-4 py-1">
                        {t.popular}
                      </Badge>
                    </div>
                  )}

                  <CardHeader className={cn('pb-4', isPopular && 'pt-8')}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        plan === 'starter' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                        plan === 'professional' && 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
                        plan === 'enterprise' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      )}>
                        <Icon size={22} weight="duotone" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{planNames[plan][language]}</CardTitle>
                        <CardDescription className="text-xs">
                          {plan === 'starter' && (language === 'fr' ? 'Pour les petites equipes' : 'For small teams')}
                          {plan === 'professional' && (language === 'fr' ? 'Pour les equipes en croissance' : 'For growing teams')}
                          {plan === 'enterprise' && (language === 'fr' ? 'Pour les grandes organisations' : 'For large organizations')}
                        </CardDescription>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-4">
                      {isEnterprise ? (
                        <div className="text-3xl font-bold">
                          {language === 'fr' ? 'Sur devis' : 'Custom'}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold">{formatCurrency(amount)}</span>
                            <span className="text-sm text-muted-foreground">
                              {isYearly ? t.perYear : t.perMonth}
                            </span>
                          </div>
                          {isYearly && amount > 0 && (
                            <div className="text-xs text-emerald-500 mt-1 font-medium">
                              {t.savePercent}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 pb-6">
                    <Separator className="mb-4" />
                    <ul className="space-y-3">
                      {planFeatures.map((feature) => {
                        const included = feature.included.includes(plan)
                        const value = getFeatureValue(plan, feature.key)
                        return (
                          <li key={feature.key} className="flex items-start gap-2.5 text-sm">
                            {included ? (
                              <Check size={16} weight="bold" className="text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                              <X size={16} weight="bold" className="text-muted-foreground/40 mt-0.5 shrink-0" />
                            )}
                            <span className={cn(!included && 'text-muted-foreground/50')}>
                              {feature.label[language]}
                              {typeof value === 'string' && (
                                <span className={cn(
                                  'ml-1 text-xs',
                                  included ? 'text-muted-foreground' : 'text-muted-foreground/40'
                                )}>
                                  ({value === 'Unlimited' ? (language === 'fr' ? 'Illimite' : 'Unlimited') : value})
                                </span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>

                  <Separator />

                  <CardFooter className="pt-4 pb-5">
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>
                        {t.currentPlan}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        className={cn(
                          'w-full gap-2 h-11 font-semibold',
                          isEnterprise
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0'
                            : isPopular
                              ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0'
                              : ''
                        )}
                        variant={(!isPopular && !isEnterprise) ? 'outline' : 'default'}
                      >
                        {isEnterprise ? t.contactSales : t.getStarted}
                        <ArrowRight size={16} weight="bold" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Trust section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <Separator className="mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={24} weight="duotone" />
              </div>
              <span className="text-sm font-medium">{t.guarantee}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Lock size={24} weight="duotone" />
              </div>
              <span className="text-sm font-medium">{t.ssl}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <ArrowCounterClockwise size={24} weight="duotone" />
              </div>
              <span className="text-sm font-medium">{t.stripe}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
