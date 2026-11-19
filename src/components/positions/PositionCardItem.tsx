import { Position, Candidate, Language } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Briefcase, Users, Target, Clock, RotateCcw, ArrowRight } from 'lucide-react'

interface PositionCardItemProps {
  position: Position
  candidates: Candidate[]
  showArchived: boolean
  language: Language
  onSelect: (position: Position) => void
  onUnarchive: (position: Position, e: React.MouseEvent) => void
  formatDate: (timestamp: number) => string
}

export default function PositionCardItem({
  position,
  candidates,
  showArchived,
  onSelect,
  onUnarchive,
  formatDate,
}: PositionCardItemProps) {
  const candidateCount = candidates.filter((c) => c.positionId === position.id).length
  const scoredCount = candidates.filter(
    (c) =>
      c.positionId === position.id &&
      (c.status === 'scored' || c.status === 'selected' || c.status === 'rejected')
  ).length

  return (
    <Card
      className="cursor-pointer border border-border bg-card hover:border-border/80 hover:shadow-sm transition-all flex flex-col justify-between"
      onClick={() => onSelect(position)}
    >
      <CardHeader className="p-4 pb-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <CardTitle className="text-sm font-semibold text-foreground truncate">
              {position.title}
            </CardTitle>
          </div>
          {showArchived && (
            <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
              Archivé
            </Badge>
          )}
        </div>
        {position.description && (
          <CardDescription className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {position.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{candidateCount}</span>
            </div>
            {scoredCount > 0 && (
              <div className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-primary" />
                <span className="font-mono tabular-nums">
                  {scoredCount} évalué{scoredCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums">
            <Clock className="w-3 h-3" />
            <span>{formatDate(position.createdAt)}</span>
          </div>
        </div>

        {showArchived ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => onUnarchive(position, e)}
            className="gap-1.5 text-xs w-full h-7"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurer le poste
          </Button>
        ) : (
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground">
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {position.openings}
              </span>{' '}
              {position.openings <= 1 ? 'ouverture' : 'ouvertures'}
            </span>
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              Inspecter <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
