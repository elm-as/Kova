import { useState } from 'react'
import { Candidate, Position, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { Button } from '@/components/ui/button'
import { HelpCircle, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { llm, llmPrompt } from '@/lib/llmClient'
import { getLLMModel } from '@/lib/llmModels'
import QuestionItem from '@/components/candidate-details/QuestionItem'

interface CandidateInterviewTabProps {
  candidate: Candidate
  position: Position
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  language: Language
}

export default function CandidateInterviewTab({
  candidate,
  position,
  setCandidates,
  language,
}: CandidateInterviewTabProps) {
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [generatingFollowUp, setGeneratingFollowUp] = useState<number | null>(null)
  const [scoringAnswer, setScoringAnswer] = useState<number | null>(null)

  const handleGenerateQuestions = async () => {
    setGeneratingQuestions(true)
    try {
      const isEnglish = language === 'en'
      const questionsPrompt = llmPrompt`Expert technical interviewer: Generate 6-8 TECHNICAL questions only. No behavioral/social/soft skills. Respond in ${isEnglish ? 'ENGLISH' : 'FRENCH'}.

JOB: ${position.title}
REQ: ${position.requirements}

CANDIDATE: ${candidate.name} (${candidate.score}/100)
Strengths: ${candidate.strengths.slice(0, 3).join(', ')}
Weaknesses: ${candidate.weaknesses.slice(0, 3).join(', ')}

Focus: Technical skills, knowledge, problem-solving, experience verification, tools/tech mastery.

Return JSON in ${isEnglish ? 'ENGLISH' : 'FRENCH'}:
    {"questions":["q1","q2",...]}

IMPORTANT: Output ONLY valid JSON. No markdown, no extra text.`

      const fastModel = getLLMModel('fast')
      const result = await llm(questionsPrompt, fastModel, true)
      const data = JSON.parse(result)

      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Format de réponse invalide.')
      }

      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, interviewQuestions: data.questions } : c))
      )
      toast.success(t('candidate.questionsGenerated', language))
    } catch (error) {
      console.error('Error generating questions:', error)
      toast.error(t('candidate.questionsError', language))
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleGenerateFollowUp = async (questionIndex: number) => {
    const answer = candidate.questionAnswers?.find((a) => a.questionIndex === questionIndex)
    if (!answer) return

    setGeneratingFollowUp(questionIndex)
    try {
      const isEnglish = language === 'en'
      const followUpPrompt = llmPrompt`Technical interviewer: Generate 3-5 TECHNICAL follow-up questions. No behavioral/social/soft skills. Respond in ${isEnglish ? 'ENGLISH' : 'FRENCH'}.

QUESTION: ${answer.question}
ANSWER: ${answer.answer}

JOB: ${position.title}
CANDIDATE: ${candidate.name}

Focus: Technical depth, understanding, edge cases, implementation details.

Return JSON in ${isEnglish ? 'ENGLISH' : 'FRENCH'}:
    {"questions":["q1","q2",...]}

IMPORTANT: Output ONLY valid JSON.`

      const fastModel = getLLMModel('fast')
      const result = await llm(followUpPrompt, fastModel, true)
      const data = JSON.parse(result)

      if (!data.questions || !Array.isArray(data.questions)) throw new Error('Format invalide.')

      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id !== candidate.id) return c
          const existingFollowUps = c.followUpQuestions || []
          const idx = existingFollowUps.findIndex((f) => f.originalQuestionIndex === questionIndex)
          const newFollowUp = {
            originalQuestionIndex: questionIndex,
            originalQuestion: answer.question,
            originalAnswer: answer.answer,
            followUpQuestions: data.questions,
            generatedAt: Date.now(),
          }
          const updated = idx >= 0 ? [...existingFollowUps] : [...existingFollowUps, newFollowUp]
          if (idx >= 0) updated[idx] = newFollowUp
          return { ...c, followUpQuestions: updated }
        })
      )
      toast.success(t('candidate.followUpGenerated', language))
    } catch (error) {
      console.error(error)
      toast.error(t('candidate.followUpError', language))
    } finally {
      setGeneratingFollowUp(null)
    }
  }

  const handleScoreAnswer = async (questionIndex: number) => {
    const answer = candidate.questionAnswers?.find((a) => a.questionIndex === questionIndex)
    if (!answer) return

    setScoringAnswer(questionIndex)
    try {
      const isEnglish = language === 'en'
      const scoringPrompt = llmPrompt`Technical interviewer: Evaluate answer for technical depth, accuracy, completeness. Respond in ${isEnglish ? 'ENGLISH' : 'FRENCH'}.

JOB: ${position.title}
CANDIDATE: ${candidate.name} (${candidate.score}/100)
QUESTION: ${answer.question}
ANSWER: ${answer.answer}

Return JSON in ${isEnglish ? 'ENGLISH' : 'FRENCH'}:
{
  "technicalDepth":85,
  "accuracy":90,
  "completeness":80,
  "overallScore":85,
  "feedback":"Explication concise",
  "strengths":["point 1"],
  "improvements":["point 2"]
}`

      const fastModel = getLLMModel('fast')
      const result = await llm(scoringPrompt, fastModel, true)
      const data = JSON.parse(result)

      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id !== candidate.id) return c
          const existingAnswers = c.questionAnswers || []
          const idx = existingAnswers.findIndex((a) => a.questionIndex === questionIndex)
          if (idx < 0) return c
          const updated = [...existingAnswers]
          updated[idx] = {
            ...updated[idx],
            aiScore: { ...data, scoredAt: Date.now() },
          }
          return { ...c, questionAnswers: updated }
        })
      )
      toast.success('Réponse évaluée par l\'IA.')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de l\'évaluation.')
    } finally {
      setScoringAnswer(null)
    }
  }

  const hasQuestions = candidate.interviewQuestions && candidate.interviewQuestions.length > 0

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div>
          <h3 className="text-xs font-bold text-foreground">
            Questions d'entretien technique
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Calibrées sur le profil de {candidate.name} et les compétences cibles.
          </p>
        </div>

        <Button
          size="sm"
          disabled={generatingQuestions}
          onClick={handleGenerateQuestions}
          className="h-7 text-xs gap-1 font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {generatingQuestions ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Génération...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{hasQuestions ? 'Régénérer questions' : 'Générer questions IA'}</span>
            </>
          )}
        </Button>
      </div>

      {!hasQuestions ? (
        <div className="text-center py-10 space-y-3 rounded-lg border border-dashed border-border p-6 bg-muted/10">
          <HelpCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="text-sm font-semibold">Aucune question technique préparée</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Générez une série de questions d'entretien technique calibrées sur le CV de {candidate.name} et les exigences du poste.
            </p>
          </div>
          <Button
            size="sm"
            disabled={generatingQuestions}
            onClick={handleGenerateQuestions}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Générer les questions techniques</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {candidate.interviewQuestions?.map((q, idx) => (
            <QuestionItem
              key={idx}
              candidate={candidate}
              questionIndex={idx}
              question={q}
              setCandidates={setCandidates}
              onGenerateFollowUp={handleGenerateFollowUp}
              onScoreAnswer={handleScoreAnswer}
              generatingFollowUp={generatingFollowUp}
              scoringAnswer={scoringAnswer}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  )
}
