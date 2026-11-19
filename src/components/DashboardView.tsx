import { useState, useMemo } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Target, Users, TrendingUp, CheckCircle2, Plus, Sparkles, FolderPlus } from 'lucide-react'
import DashboardMetricCard from './dashboard/DashboardMetricCard'
import TopPerformersCard from './dashboard/TopPerformersCard'
import ScoreDistributionCard from './dashboard/ScoreDistributionCard'
import RecentActivityCard from './dashboard/RecentActivityCard'

interface DashboardViewProps {
  positions: Position[]
  candidates: Candidate[]
  language: Language
  onNavigate?: (view: string) => void
}

export function DashboardView({
  positions,
  candidates,
  language,
  onNavigate,
}: DashboardViewProps) {
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('all')

  const now = Date.now()
  const periodMs: Record<typeof period, number> = {
    '7': 7 * 24 * 60 * 60 * 1000,
    '30': 30 * 24 * 60 * 60 * 1000,
    '90': 90 * 24 * 60 * 60 * 1000,
    'all': Infinity,
  }

  const filteredCandidates = useMemo(() => {
    const cutoff = now - periodMs[period]
    return candidates.filter((c) => c.createdAt >= cutoff)
  }, [candidates, period, now])

  const filteredPositions = useMemo(() => {
    const cutoff = now - periodMs[period]
    return positions.filter((p) => p.createdAt >= cutoff)
  }, [positions, period, now])

  const metrics = useMemo(() => {
    const activePositions = filteredPositions.filter(
      (p) => p.status === 'active' || !p.status
    ).length
    const totalCandidates = filteredCandidates.length
    const scoredCandidates = filteredCandidates.filter(
      (c) => c.status === 'scored' || c.status === 'selected' || c.status === 'hired'
    )
    const averageScore =
      scoredCandidates.length > 0
        ? Math.round(
            scoredCandidates.reduce((sum, c) => sum + c.score, 0) / scoredCandidates.length
          )
        : 0
    const candidatesSelected = filteredCandidates.filter(
      (c) => c.status === 'selected' || c.status === 'hired'
    ).length

    return {
      activePositions,
      totalCandidates,
      averageScore,
      candidatesSelected,
    }
  }, [filteredCandidates, filteredPositions])

  const hasData = candidates.length > 0 || positions.length > 0

  return (
    <div className="space-y-5">
      {/* En-tête + sélecteur de période */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('dashboard.title', language)}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('dashboard.subtitle', language)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[150px] h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('dashboard.last7Days', language)}</SelectItem>
              <SelectItem value="30">{t('dashboard.last30Days', language)}</SelectItem>
              <SelectItem value="90">{t('dashboard.last90Days', language)}</SelectItem>
              <SelectItem value="all">{t('dashboard.allTime', language)}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => onNavigate?.('positions')}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau poste
          </Button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-border bg-card">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('dashboard.emptyDashboard', language)}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {t('dashboard.emptyDashboardDesc', language)}
          </p>
          <Button
            size="sm"
            onClick={() => onNavigate?.('positions')}
            className="mt-4 gap-1.5 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            {t('dashboard.newPosition', language)}
          </Button>
        </div>
      ) : (
        <>
          {/* Grille des 4 métriques clés */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <DashboardMetricCard
              title={t('dashboard.activePositions', language)}
              value={metrics.activePositions}
              icon={Target}
            />
            <DashboardMetricCard
              title={t('dashboard.totalCandidates', language)}
              value={metrics.totalCandidates}
              icon={Users}
            />
            <DashboardMetricCard
              title={t('dashboard.averageScore', language)}
              value={metrics.averageScore}
              subtitle="/100"
              icon={TrendingUp}
            />
            <DashboardMetricCard
              title={t('dashboard.candidatesSelected', language)}
              value={metrics.candidatesSelected}
              icon={CheckCircle2}
            />
          </div>

          {/* Cartes d'analyse et distribution */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
            <TopPerformersCard
              candidates={filteredCandidates}
              positions={positions}
            />
            <ScoreDistributionCard
              candidates={filteredCandidates}
            />
            <RecentActivityCard
              candidates={filteredCandidates}
              positions={positions}
              language={language}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default DashboardView
