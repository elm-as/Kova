import { Trophy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Candidate, Position } from '@/lib/types'

interface TopPerformersCardProps {
  candidates: Candidate[]
  positions: Position[]
}

export default function TopPerformersCard({ candidates, positions }: TopPerformersCardProps) {
  const topCandidates = candidates
    .filter((c) => c.status === 'scored' || c.status === 'selected' || c.status === 'hired')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return (
    <Card className="border border-border bg-card shadow-none flex flex-col">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
          <CardTitle className="text-sm font-semibold">Meilleurs profils</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Candidats ayant obtenu les scores d'évaluation les plus élevés
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3.5 pt-1 flex-1">
        {topCandidates.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Aucun candidat évalué pour le moment.
          </p>
        ) : (
          <div className="space-y-1.5">
            {topCandidates.map((candidate, index) => {
              const position = positions.find((p) => p.id === candidate.positionId)
              return (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 text-center font-mono text-xs font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs text-foreground truncate">
                        {candidate.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {position?.title || 'Poste non assigné'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono font-bold text-xs tabular-nums text-foreground">
                      {candidate.score}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
