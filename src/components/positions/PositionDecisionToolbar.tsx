import { Button } from '@/components/ui/button'
import { Position, Candidate, Language } from '@/lib/types'
import { BarChart3, Scale, Mail, FileDown, Layers } from 'lucide-react'

interface PositionDecisionToolbarProps {
  position: Position
  candidates: Candidate[]
  language: Language
  onOpenComparisonMatrix: () => void
  onOpenCompareScores: () => void
  onOpenEmailTemplate: () => void
  onGenerateReportPDF: () => void
}

export default function PositionDecisionToolbar({
  position,
  candidates,
  language,
  onOpenComparisonMatrix,
  onOpenCompareScores,
  onOpenEmailTemplate,
  onGenerateReportPDF,
}: PositionDecisionToolbarProps) {
  if (candidates.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-card rounded-xl border border-border/80 shadow-2xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-border/60 text-muted-foreground">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
            Outils Décisionnels
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenComparisonMatrix}
          className="h-7 text-xs gap-1.5 px-2.5 font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60"
        >
          <BarChart3 className="w-3.5 h-3.5 text-primary/80" />
          <span>Matrice Comparative</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenCompareScores}
          className="h-7 text-xs gap-1.5 px-2.5 font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60"
        >
          <Scale className="w-3.5 h-3.5 text-primary/80" />
          <span>Comparer Scores</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenEmailTemplate}
          className="h-7 text-xs gap-1.5 px-2.5 font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60"
        >
          <Mail className="w-3.5 h-3.5 text-primary/80" />
          <span>Modèles Email</span>
        </Button>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={onGenerateReportPDF}
        className="h-7 text-xs gap-1.5 px-3 font-medium bg-background hover:bg-muted/50 border-border text-foreground shadow-2xs ml-auto"
      >
        <FileDown className="w-3.5 h-3.5 text-primary" />
        <span>Rapport Global PDF</span>
      </Button>
    </div>
  )
}
