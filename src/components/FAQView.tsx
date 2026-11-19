import { Language } from '@/lib/types'
import { t } from '@/lib/translations'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Question, Lightbulb, FileText, ChartBar, Users, Archive, Trash, ArrowsClockwise, ArrowRight, ShieldCheck } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface FAQViewProps {
  language: Language
  onNavigate?: (tab: string) => void
}

export default function FAQView({ language, onNavigate }: FAQViewProps) {
  const faqCategories = [
    {
      title: t('faq.category.general', language),
      icon: Question,
      color: 'text-accent',
      questions: [
        { q: 'whatIsThis', a: 'whatIsThisAnswer', link: null },
        { q: 'howItWorks', a: 'howItWorksAnswer', link: 'positions' },
        { q: 'needAccount', a: 'needAccountAnswer', link: null },
        { q: 'dataStorage', a: 'dataStorageAnswer', link: null },
      ]
    },
    {
      title: t('faq.category.positions', language),
      icon: FileText,
      color: 'text-blue-500',
      questions: [
        { q: 'createPosition', a: 'createPositionAnswer', link: 'positions' },
        { q: 'archivePosition', a: 'archivePositionAnswer', link: 'positions' },
        { q: 'deletePosition', a: 'deletePositionAnswer', link: 'positions' },
        { q: 'restoreArchived', a: 'restoreArchivedAnswer', link: 'history' },
      ]
    },
    {
      title: t('faq.category.candidates', language),
      icon: Users,
      color: 'text-purple-500',
      questions: [
        { q: 'addCandidate', a: 'addCandidateAnswer', link: 'positions' },
        { q: 'fileFormats', a: 'fileFormatsAnswer', link: null },
        { q: 'howScoring', a: 'howScoringAnswer', link: 'positions' },
        { q: 'scoreBreakdown', a: 'scoreBreakdownAnswer', link: 'positions' },
        { q: 'deleteCandidate', a: 'deleteCandidateAnswer', link: 'positions' },
        { q: 'bulkDelete', a: 'bulkDeleteAnswer', link: 'positions' },
      ]
    },
    {
      title: t('faq.category.questions', language),
      icon: Lightbulb,
      color: 'text-yellow-600',
      questions: [
        { q: 'interviewQuestions', a: 'interviewQuestionsAnswer', link: 'positions' },
        { q: 'questionTypes', a: 'questionTypesAnswer', link: null },
        { q: 'answerQuestions', a: 'answerQuestionsAnswer', link: 'positions' },
        { q: 'scoreAnswers', a: 'scoreAnswersAnswer', link: 'positions' },
        { q: 'followUpQuestions', a: 'followUpQuestionsAnswer', link: 'positions' },
      ]
    },
    {
      title: t('faq.category.analysis', language),
      icon: ChartBar,
      color: 'text-green-500',
      questions: [
        { q: 'compareScores', a: 'compareScoresAnswer', link: 'positions' },
        { q: 'alternativePositions', a: 'alternativePositionsAnswer', link: 'positions' },
        { q: 'orderingPresets', a: 'orderingPresetsAnswer', link: 'positions' },
        { q: 'emailTemplates', a: 'emailTemplatesAnswer', link: 'positions' },
      ]
    },
    {
      title: t('faq.category.history', language),
      icon: Archive,
      color: 'text-orange-500',
      questions: [
        { q: 'viewHistory', a: 'viewHistoryAnswer', link: 'history' },
        { q: 'filterHistory', a: 'filterHistoryAnswer', link: 'history' },
        { q: 'dateRange', a: 'dateRangeAnswer', link: 'history' },
      ]
    },
    {
      title: t('faq.category.security', language),
      icon: ShieldCheck,
      color: 'text-red-500',
      questions: [
        { q: 'passwordSecurity', a: 'passwordSecurityAnswer', link: null },
        { q: 'passwordRequirements', a: 'passwordRequirementsAnswer', link: null },
        { q: 'resetPassword', a: 'resetPasswordAnswer', link: null },
        { q: 'accountSecurity', a: 'accountSecurityAnswer', link: null },
      ]
    },
  ]

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('faq.title', language)}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t('faq.subtitle', language)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {faqCategories.map((category, categoryIndex) => {
          const Icon = category.icon
          return (
            <motion.div
              key={categoryIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.05 }}
            >
              <Card className="h-full">
                <CardHeader className="p-3 pb-0">
                  <div className="flex items-center gap-2">
                    <Icon size={18} weight="duotone" className={category.color} />
                    <CardTitle className="text-sm font-semibold">{category.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((item, itemIndex) => (
                      <AccordionItem key={itemIndex} value={`item-${categoryIndex}-${itemIndex}`}>
                        <AccordionTrigger className="text-left hover:no-underline hover:text-accent transition-colors text-xs sm:text-sm py-2">
                          {t(`faq.questions.${item.q}`, language)}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed space-y-2 text-xs pb-3">
                          <p className="break-words">{t(`faq.answers.${item.a}`, language)}</p>
                          {item.link && onNavigate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onNavigate(item.link)}
                              className="gap-2 hover:bg-accent/10 hover:text-accent hover:border-accent transition-all w-full xs:w-auto h-9"
                            >
                              {t(`faq.goTo.${item.link}`, language)}
                              <ArrowRight size={14} className="sm:hidden" weight="bold" />
                              <ArrowRight size={16} className="hidden sm:block" weight="bold" />
                            </Button>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card className="border-accent/20 bg-muted/30">
        <CardHeader className="p-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-accent shrink-0" weight="duotone" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg break-words">{t('faq.tips.title', language)}</CardTitle>
              <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">{t('faq.tips.subtitle', language)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          <div className="flex gap-2">
            <ArrowsClockwise size={16} className="text-accent shrink-0 mt-0.5" weight="duotone" />
            <p className="text-xs text-foreground leading-relaxed">{t('faq.tips.tip1', language)}</p>
          </div>
          <div className="flex gap-2">
            <ChartBar size={16} className="text-accent shrink-0 mt-0.5" weight="duotone" />
            <p className="text-xs text-foreground leading-relaxed">{t('faq.tips.tip2', language)}</p>
          </div>
          <div className="flex gap-2">
            <Trash size={16} className="text-accent shrink-0 mt-0.5" weight="duotone" />
            <p className="text-xs text-foreground leading-relaxed">{t('faq.tips.tip3', language)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
