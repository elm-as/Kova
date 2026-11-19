import { useMemo } from 'react'
import { PieChart as PieChartIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Candidate } from '@/lib/types'

interface ScoreDistributionCardProps {
  candidates: Candidate[]
}

const SCORE_RANGES = [
  { name: '0-20', min: 0, max: 20, color: '#ef4444' },
  { name: '21-40', min: 21, max: 40, color: '#f97316' },
  { name: '41-60', min: 41, max: 60, color: '#eab308' },
  { name: '61-80', min: 61, max: 80, color: '#10b981' },
  { name: '81-100', min: 81, max: 100, color: '#0ea5e9' },
]

export default function ScoreDistributionCard({ candidates }: ScoreDistributionCardProps) {
  const distribution = useMemo(() => {
    const scored = candidates.filter(
      (c) => c.status === 'scored' || c.status === 'selected' || c.status === 'hired'
    )
    return SCORE_RANGES.map((range) => {
      const count = scored.filter((c) => c.score >= range.min && c.score <= range.max).length
      return { ...range, count }
    })
  }, [candidates])

  const totalScored = distribution.reduce((sum, r) => sum + r.count, 0)

  return (
    <Card className="border border-border bg-card shadow-none flex flex-col">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center gap-2">
          <PieChartIcon className="w-4 h-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-semibold">Distribution des scores</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Répartition des {totalScored} candidat{totalScored > 1 ? 's' : ''} évalué{totalScored > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3.5 pt-1 flex-1">
        {totalScored === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Aucune note calculée pour le moment.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-[130px] w-[130px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution.filter((d) => d.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="count"
                    stroke="none"
                  >
                    {distribution.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {distribution.map((range) => {
                const pct = totalScored > 0 ? Math.round((range.count / totalScored) * 100) : 0
                return (
                  <div key={range.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: range.color }}
                    />
                    <span className="font-mono text-[11px] w-12 tabular-nums">{range.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: range.color,
                        }}
                      />
                    </div>
                    <span className="font-mono text-muted-foreground w-8 text-right text-[11px] tabular-nums">
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
