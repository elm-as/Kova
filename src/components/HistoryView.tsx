import { useState, useMemo } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MagnifyingGlass,
  CalendarBlank,
  Users,
  Archive,
  Funnel,
  Clock,
  ChartBar,
  CheckCircle,
  XCircle,
  Trophy,
  Target,
} from '@phosphor-icons/react'
import DateRangeFilter from './DateRangeFilter'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface HistoryViewProps {
  positions: Position[]
  candidates: Candidate[]
  language: Language
  onNavigate?: (tab: string) => void
}

const STATUS_FILTERS = ['all', 'scored', 'selected', 'rejected'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function HistoryView({ positions, candidates, language, onNavigate }: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      const query = searchQuery.toLowerCase()
      const matchesSearch = (
        position.title.toLowerCase().includes(query) ||
        position.description.toLowerCase().includes(query)
      )

      if (!matchesSearch) return false

      if (showArchivedOnly && position.status !== 'archived') {
        return false
      }
      if (!showArchivedOnly && position.status === 'archived') {
        return false
      }

      if (!dateRange.from && !dateRange.to) return true

      const positionDate = new Date(position.createdAt)
      if (dateRange.from && dateRange.to) {
        const from = new Date(dateRange.from)
        from.setHours(0, 0, 0, 0)
        const to = new Date(dateRange.to)
        to.setHours(23, 59, 59, 999)
        return positionDate >= from && positionDate <= to
      }
      if (dateRange.from) {
        const from = new Date(dateRange.from)
        from.setHours(0, 0, 0, 0)
        return positionDate >= from
      }

      return true
    }).filter(position => {
      if (statusFilter === 'all') return true
      const positionCandidates = candidates.filter(c => c.positionId === position.id)
      return positionCandidates.some(c => {
        if (statusFilter === 'scored') return c.status === 'scored'
        if (statusFilter === 'selected') return c.status === 'selected' || c.status === 'hired'
        if (statusFilter === 'rejected') return c.status === 'rejected'
        return false
      })
    })
  }, [positions, searchQuery, showArchivedOnly, dateRange, statusFilter, candidates])

  const getCandidatesForPosition = (positionId: string) => {
    return candidates.filter((c) => c.positionId === positionId)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const stats = useMemo(() => {
    const allScored = candidates.filter(c => c.status === 'scored' || c.status === 'selected' || c.status === 'rejected')
    const allSelected = candidates.filter(c => c.status === 'selected' || c.status === 'hired')
    const avgScore = allScored.length > 0
      ? Math.round(allScored.reduce((s, c) => s + c.score, 0) / allScored.length)
      : 0

    return {
      totalPositions: positions.length,
      totalEvaluated: allScored.length,
      totalSelected: allSelected.length,
      averageScore: avgScore,
    }
  }, [candidates, positions])

  const hasData = positions.length > 0

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('history.title', language)}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('history.description', language)}</p>
        </div>
      </div>

      {!hasData ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="py-10 text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 mx-auto mb-4">
                <Clock size={28} weight="duotone" className="text-primary/40" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {t('history.noHistory', language)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                {t('history.noHistoryDesc', language)}
              </p>
              {onNavigate && (
                <Button
                  className="mt-4 gap-2"
                  size="sm"
                  onClick={() => onNavigate('positions')}
                >
                  <Target size={16} weight="bold" />
                  {language === 'fr' ? 'Créer un poste' : language === 'es' ? 'Crear un puesto' : 'Create a position'}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="h-full shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'fr' ? 'Postes' : language === 'es' ? 'Puestos' : 'Positions'}
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target size={18} weight="duotone" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <span className="text-2xl font-bold tracking-tight tabular-nums">{stats.totalPositions}</span>
              </CardContent>
            </Card>

            <Card className="h-full shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'fr' ? 'Évalués' : language === 'es' ? 'Evaluados' : 'Evaluated'}
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                  <ChartBar size={18} weight="duotone" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <span className="text-2xl font-bold tracking-tight tabular-nums">{stats.totalEvaluated}</span>
              </CardContent>
            </Card>

            <Card className="h-full shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'fr' ? 'Score Moyen' : language === 'es' ? 'Promedio' : 'Average Score'}
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Trophy size={18} weight="duotone" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight tabular-nums">{stats.averageScore}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'fr' ? 'Sélectionnés' : language === 'es' ? 'Seleccionados' : 'Selected'}
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <CheckCircle size={18} weight="duotone" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <span className="text-2xl font-bold tracking-tight tabular-nums">{stats.totalSelected}</span>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="relative flex-1 w-full min-w-0">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                weight="duotone"
              />
              <Input
                placeholder={t('history.search', language)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <DateRangeFilter
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                language={language}
              />
              <Button
                variant={showArchivedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowArchivedOnly(!showArchivedOnly)}
                className="gap-1.5 whitespace-nowrap h-9 text-xs"
              >
                <Archive size={14} weight={showArchivedOnly ? 'fill' : 'duotone'} />
                <span className="hidden sm:inline">
                  {showArchivedOnly ? t('history.hideArchived', language) : t('history.showArchived', language)}
                </span>
                <span className="sm:hidden">{showArchivedOnly ? (language === 'fr' ? 'Tous' : 'All') : (language === 'fr' ? 'Archives' : 'Archives')}</span>
              </Button>
              <div className="flex rounded-lg border border-border bg-card p-0.5">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                      statusFilter === filter
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {filter === 'all'
                      ? t('history.filterAll', language)
                      : filter === 'scored'
                        ? t('status.scored', language)
                        : filter === 'selected'
                          ? t('history.filterSelected', language)
                          : t('history.filterRejected', language)
                    }
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredPositions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-dashed border-2">
                <CardContent className="py-8 text-center px-4">
                  <Funnel size={32} className="text-muted-foreground mx-auto mb-3" weight="duotone" />
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('history.noResults', language)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <ScrollArea className="h-[calc(100vh-360px)]">
              <div className="space-y-3 pr-2">
                {filteredPositions.map((position, index) => {
                  const positionCandidates = getCandidatesForPosition(position.id)
                  const scoredCandidates = positionCandidates.filter(
                    (c) => c.status === 'scored' || c.status === 'selected' || c.status === 'rejected'
                  )
                  const selectedCandidates = positionCandidates.filter(
                    (c) => c.status === 'selected' || c.status === 'hired'
                  )
                  const rejectedCandidates = positionCandidates.filter(
                    (c) => c.status === 'rejected'
                  )

                  const displayCandidates = statusFilter === 'all'
                    ? scoredCandidates
                    : statusFilter === 'scored'
                      ? scoredCandidates.filter(c => c.status === 'scored')
                      : statusFilter === 'selected'
                        ? selectedCandidates
                        : rejectedCandidates

                  return (
                    <motion.div
                      key={position.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:border-accent/50 transition-all hover:shadow-sm">
                        <CardHeader className="p-3 pb-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                                position.status === 'active' || !position.status
                                  ? 'bg-primary/10 text-primary'
                                  : position.status === 'archived'
                                    ? 'bg-muted-foreground/10 text-muted-foreground'
                                    : 'bg-success/10 text-success',
                              )}
                            >
                              <Target size={18} weight="duotone" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-semibold break-words leading-tight">
                                {position.title}
                              </CardTitle>
                              {position.description && (
                                <CardDescription className="line-clamp-1 mt-0.5 text-xs">
                                  {position.description}
                                </CardDescription>
                              )}
                            </div>
                            <Badge
                              variant={position.status === 'active' || !position.status ? 'default' : position.status === 'archived' ? 'outline' : 'secondary'}
                              className="shrink-0 text-xs h-6"
                            >
                              {position.status === 'active' || !position.status
                                ? t('history.active', language)
                                : position.status === 'archived'
                                  ? language === 'fr' ? 'Archivé' : language === 'es' ? 'Archivado' : 'Archived'
                                  : t('history.closed', language)
                              }
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
                            <div className="flex items-center gap-1.5">
                              <CalendarBlank size={13} weight="duotone" />
                              <span>{t('history.created', language)} {formatDate(position.createdAt)}</span>
                            </div>
                            <Separator orientation="vertical" className="h-3 hidden sm:block" />
                            <div className="flex items-center gap-1.5">
                              <Users size={13} weight="duotone" />
                              <span>{positionCandidates.length} {positionCandidates.length <= 1 ? (language === 'fr' ? 'candidat' : 'candidate') : (language === 'fr' ? 'candidats' : 'candidates')}</span>
                            </div>
                            <Separator orientation="vertical" className="h-3 hidden sm:block" />
                            <div className="flex items-center gap-1.5">
                              <ChartBar size={13} weight="duotone" />
                              <span>{scoredCandidates.length} {t('history.evaluated', language).toLowerCase()}</span>
                            </div>
                            {selectedCandidates.length > 0 && (
                              <>
                                <Separator orientation="vertical" className="h-3 hidden sm:block" />
                                <div className="flex items-center gap-1.5 text-success">
                                  <CheckCircle size={13} weight="fill" />
                                  <span className="font-medium">{selectedCandidates.length} {t('history.selected', language).toLowerCase()}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </CardHeader>

                        {displayCandidates.length > 0 && (
                          <CardContent className="p-3 pt-2">
                            <>
                              <Separator className="mb-2" />
                              <div className="space-y-1.5">
                                {displayCandidates
                                  .sort((a, b) => b.score - a.score)
                                  .slice(0, 8)
                                  .map((candidate, cidx) => {
                                    const statusColor = candidate.status === 'selected' || candidate.status === 'hired'
                                      ? 'border-l-green-500'
                                      : candidate.status === 'rejected'
                                        ? 'border-l-red-500'
                                        : 'border-l-info'

                                    const statusIcon = candidate.status === 'selected' || candidate.status === 'hired'
                                      ? <CheckCircle size={13} weight="fill" className="text-green-500" />
                                      : candidate.status === 'rejected'
                                        ? <XCircle size={13} weight="fill" className="text-red-500" />
                                        : <ChartBar size={13} weight="fill" className="text-info" />

                                    return (
                                      <div
                                        key={candidate.id}
                                        className={cn(
                                          'flex items-center justify-between text-sm p-2 rounded-md bg-muted/30 border-l-2 hover:bg-muted/50 transition-colors',
                                          statusColor,
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <Badge variant="outline" className="text-xs h-5 shrink-0">
                                            #{cidx + 1}
                                          </Badge>
                                          <div className="min-w-0">
                                            <span className="font-medium text-sm truncate block">
                                              {candidate.name}
                                            </span>
                                            {candidate.analyzedAt && (
                                              <span className="text-[10px] text-muted-foreground">
                                                {t('history.evaluatedOn', language)} {formatDate(candidate.analyzedAt)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                          {statusIcon}
                                          <span className="font-semibold text-sm tabular-nums">
                                            {candidate.score}/100
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                {displayCandidates.length > 8 && (
                                  <p className="text-xs text-muted-foreground text-center pt-1">
                                    {language === 'fr'
                                      ? `+ ${displayCandidates.length - 8} autres candidats`
                                      : language === 'es'
                                        ? `+ ${displayCandidates.length - 8} más candidatos`
                                        : `+ ${displayCandidates.length - 8} more candidates`
                                    }
                                  </p>
                                )}
                              </div>
                            </>
                          </CardContent>
                        )}

                        {displayCandidates.length === 0 && statusFilter !== 'all' && (
                          <CardContent className="p-3 pt-2">
                            <Separator className="mb-2" />
                            <p className="text-xs text-muted-foreground text-center py-2">
                              {language === 'fr'
                                ? 'Aucun candidat ne correspond à ce filtre'
                                : language === 'es'
                                  ? 'Ningún candidato coincide con este filtro'
                                  : 'No candidates match this filter'
                              }
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  )
}
