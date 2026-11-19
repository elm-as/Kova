import { Candidate, Language } from '@/lib/types'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BarChart2,
  Briefcase,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CandidateAssessmentTabProps {
  candidate: Candidate
  language: Language
  getScoreColor: (score: number) => string
}

export default function CandidateAssessmentTab({
  candidate,
  language,
  getScoreColor,
}: CandidateAssessmentTabProps) {
  const getScoreProgressClass = (score: number) => {
    if (score >= 80) return '[&>div]:bg-emerald-600 dark:[&>div]:bg-emerald-500'
    if (score >= 65) return '[&>div]:bg-blue-600 dark:[&>div]:bg-blue-500'
    if (score >= 50) return '[&>div]:bg-amber-600 dark:[&>div]:bg-amber-500'
    return '[&>div]:bg-rose-600 dark:[&>div]:bg-rose-500'
  }

  const getScoreBadgeBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
    if (score >= 65) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
    if (score >= 50) return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Synthèse IA — Style exécutif épuré */}
      {candidate.overallAssessment && (
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Synthèse Globale de l'IA
            </span>
          </div>
          <p className="text-xs sm:text-sm text-foreground leading-relaxed pl-1">
            {candidate.overallAssessment}
          </p>
        </div>
      )}

      {/* Cartes Doubles : Forces vs Vigilance (Contraste élevé, zéro fond criard) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Points forts */}
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Points forts confirmés
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20">
                {candidate.strengths?.length || 0} atouts
              </Badge>
            </div>

            <ul className="space-y-2.5">
              {candidate.strengths && candidate.strengths.length > 0 ? (
                candidate.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted-foreground italic">Aucun point fort spécifique répertorié.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Points de vigilance */}
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Points de vigilance & lacunes
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/5 border-amber-500/20">
                {candidate.weaknesses?.length || 0} à vérifier
              </Badge>
            </div>

            <ul className="space-y-2.5">
              {candidate.weaknesses && candidate.weaknesses.length > 0 ? (
                candidate.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 mt-1.5 shrink-0" />
                    <span>{weakness}</span>
                  </li>
                ))
              ) : (
                <li className="text-xs text-muted-foreground italic">Aucune réserve majeure identifiée.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Décomposition multiaxiale (7 axes) */}
      {candidate.scoreBreakdown && candidate.scoreBreakdown.length > 0 && (
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                <BarChart2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">
                Grille d'évaluation pondérée par axe
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              7 dimensions calibrées
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {candidate.scoreBreakdown.map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-md bg-muted/20 border border-border/60 hover:border-border transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {item.category}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded border tabular-nums shrink-0',
                      getScoreBadgeBg(item.score)
                    )}
                  >
                    {item.score}<span className="text-[10px] opacity-70">/100</span>
                  </span>
                </div>

                <Progress
                  value={item.score}
                  className={cn('h-1.5 bg-muted', getScoreProgressClass(item.score))}
                />

                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                  {item.reasoning}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions de réorientation interne */}
      {candidate.alternativePositions && candidate.alternativePositions.length > 0 && (
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Briefcase className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold text-foreground">
              Opportunités alternatives de recrutement
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {candidate.alternativePositions.map((alt, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 p-2.5 rounded-md border border-border/60 bg-muted/20 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    {alt.positionTitle}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {alt.reasoning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
