import { useState } from 'react'
import { Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2,
  MessageSquare,
  Pencil,
  Save,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import AnswerScoreDisplay from './AnswerScoreDisplay'

interface QuestionItemProps {
  candidate: Candidate
  questionIndex: number
  question: string
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  onGenerateFollowUp: (questionIndex: number) => void
  onScoreAnswer: (questionIndex: number) => void
  generatingFollowUp: number | null
  scoringAnswer: number | null
  language: Language
}

export default function QuestionItem({
  candidate,
  questionIndex,
  question,
  setCandidates,
  onGenerateFollowUp,
  onScoreAnswer,
  generatingFollowUp,
  scoringAnswer,
  language,
}: QuestionItemProps) {
  const [isAnswering, setIsAnswering] = useState(false)
  const [answerText, setAnswerText] = useState('')

  const answer = candidate.questionAnswers?.find((a) => a.questionIndex === questionIndex)
  const followUp = candidate.followUpQuestions?.find((f) => f.originalQuestionIndex === questionIndex)

  const startAnswering = () => {
    setIsAnswering(true)
    setAnswerText(answer?.answer || '')
  }

  const saveAnswer = () => {
    if (!answerText.trim()) return

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidate.id) {
          const existingAnswers = c.questionAnswers || []
          const existingAnswerIndex = existingAnswers.findIndex(
            (a) => a.questionIndex === questionIndex
          )

          let updatedAnswers
          if (existingAnswerIndex >= 0) {
            updatedAnswers = [...existingAnswers]
            updatedAnswers[existingAnswerIndex] = {
              questionIndex,
              question,
              answer: answerText,
              answeredAt: Date.now(),
            }
          } else {
            updatedAnswers = [
              ...existingAnswers,
              {
                questionIndex,
                question,
                answer: answerText,
                answeredAt: Date.now(),
              },
            ]
          }

          return { ...c, questionAnswers: updatedAnswers }
        }
        return c
      })
    )

    setIsAnswering(false)
    setAnswerText('')

    toast.success(t('common.save', language), {
      description: language === 'fr'
        ? 'Cliquez sur "Évaluer la Réponse" pour obtenir une analyse IA détaillée'
        : 'Click "Score Answer" to get detailed AI analysis',
      duration: 4000,
    })
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm text-foreground flex-1">
            <span className="font-semibold text-accent mr-2">{questionIndex + 1}.</span>
            {question}
          </p>
          {answer && (
            <Badge
              variant={answer.aiScore ? 'default' : 'secondary'}
              className="shrink-0 gap-1 text-xs"
            >
              {answer.aiScore ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {language === 'fr' ? 'Évaluée' : 'Scored'}
                </>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3" />
                  {language === 'fr' ? 'Répondue' : 'Answered'}
                </>
              )}
            </Badge>
          )}
        </div>

        {!isAnswering && answer && (
          <div className="mt-2 space-y-3">
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">
                  {t('candidate.answeredOn', language)} {new Date(answer.answeredAt).toLocaleDateString()}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startAnswering}
                  className="h-7 gap-1 text-xs"
                >
                  <Pencil className="w-3 h-3" />
                  {t('candidate.editAnswer', language)}
                </Button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{answer.answer}</p>
            </div>

            {answer.aiScore ? (
              <AnswerScoreDisplay
                answer={answer}
                language={language}
                onRescore={() => onScoreAnswer(questionIndex)}
                scoringAnswer={scoringAnswer === questionIndex}
              />
            ) : (
              <div className="p-3 bg-accent/5 border border-dashed border-accent/30 rounded-lg">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {language === 'fr' ? 'Évaluation IA disponible' : 'AI Evaluation Available'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'fr'
                          ? 'Obtenez une analyse détaillée de cette réponse'
                          : 'Get detailed analysis of this answer'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onScoreAnswer(questionIndex)}
                    disabled={scoringAnswer === questionIndex}
                    className="gap-1.5 text-xs bg-accent hover:bg-accent/90 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {scoringAnswer === questionIndex
                      ? t('candidate.scoringAnswer', language)
                      : t('candidate.scoreAnswer', language)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isAnswering && !answer && (
          <div className="mt-2 p-3 bg-muted/30 border border-dashed rounded-md">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {language === 'fr'
                  ? 'Aucune réponse enregistrée pour cette question'
                  : 'No answer recorded for this question'}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={startAnswering}
                className="gap-1.5 text-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {t('candidate.answerQuestion', language)}
              </Button>
            </div>
          </div>
        )}

        {isAnswering && (
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-2 p-2 bg-blue-50/50 border border-blue-200/60 rounded-md text-blue-900 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs">
                {language === 'fr'
                  ? 'Après avoir enregistré la réponse, vous pourrez la faire évaluer par l\'IA pour obtenir des scores détaillés et des recommandations.'
                  : 'After saving the answer, you can have it evaluated by AI to get detailed scores and recommendations.'}
              </p>
            </div>
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={t('candidate.answerPlaceholder', language)}
              className="min-h-24 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveAnswer}
                disabled={!answerText.trim()}
                className="gap-1.5 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                {t('candidate.saveAnswer', language)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAnswering(false)
                  setAnswerText('')
                }}
                className="text-xs"
              >
                {t('candidate.cancel', language)}
              </Button>
            </div>
          </div>
        )}

        {answer && !isAnswering && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerateFollowUp(questionIndex)}
              disabled={generatingFollowUp === questionIndex}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generatingFollowUp === questionIndex
                ? t('candidate.generating', language)
                : t('candidate.generateFollowUp', language)}
            </Button>
          </div>
        )}

        {followUp && followUp.followUpQuestions.length > 0 && (
          <div className="mt-3 pl-4 border-l-2 border-accent space-y-2">
            <p className="text-xs font-semibold text-accent">
              {t('candidate.followUpQuestions', language)}
            </p>
            <ul className="space-y-2">
              {followUp.followUpQuestions.map((fq, fqIndex) => (
                <li key={fqIndex} className="text-sm text-foreground">
                  <span className="font-semibold text-accent mr-2">
                    {questionIndex + 1}.{fqIndex + 1}
                  </span>
                  {fq}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
