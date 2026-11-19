import { Clock, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Candidate, Position, Language } from '@/lib/types'

interface RecentActivityCardProps {
  candidates: Candidate[]
  positions: Position[]
  language: Language
}

function formatRelativeTime(ts: number, lang: Language): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return lang === 'fr' ? "À l'instant" : 'Just now'
  if (minutes < 60) return lang === 'fr' ? `Il y a ${minutes}m` : `${minutes}m ago`
  if (hours < 24) return lang === 'fr' ? `Il y a ${hours}h` : `${hours}h ago`
  if (days < 7) return lang === 'fr' ? `Il y a ${days}j` : `${days}d ago`
  return new Date(ts).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default function RecentActivityCard({
  candidates,
  positions,
  language,
}: RecentActivityCardProps) {
  const activities = candidates
    .filter((c) => c.analyzedAt)
    .sort((a, b) => (b.analyzedAt || 0) - (a.analyzedAt || 0))
    .slice(0, 6)

  return (
    <Card className="border border-border bg-card shadow-none flex flex-col">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <CardTitle className="text-sm font-semibold">Activité récente</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Historique des dernières évaluations de candidatures
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3.5 pt-1 flex-1">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Aucune activité d'évaluation récente.
          </p>
        ) : (
          <div className="space-y-1.5">
            {activities.map((c) => {
              const position = positions.find((p) => p.id === c.positionId)
              const isSelected = c.status === 'selected' || c.status === 'hired'
              const isRejected = c.status === 'rejected'

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isSelected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : isRejected ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {position?.title || 'Poste'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono font-bold text-xs tabular-nums text-foreground">
                      {c.score}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      {c.analyzedAt ? formatRelativeTime(c.analyzedAt, language) : ''}
                    </span>
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
