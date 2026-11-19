import { useState, useMemo, useEffect } from 'react'
import { Candidate, Language } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Trophy, Plus, FileText, CheckCircle2, UserCheck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CandidateMasterListProps {
  candidates: Candidate[]
  selectedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  onAddCandidate?: () => void
  language: Language
  topPicksCount?: number
  openings?: number
  onDeleteCandidate?: (id: string) => void
  onBulkDelete?: (ids: string[]) => void
}

function getCandidateInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CandidateMasterList({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onAddCandidate,
  language,
  topPicksCount = 3,
}: CandidateMasterListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Tri automatique par score décroissant (standard ATS)
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0))
  }, [candidates])

  // Filtrage combiné recherche et statut
  const filteredCandidates = useMemo(() => {
    return sortedCandidates.filter((c) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.strengths?.some((s) => s.toLowerCase().includes(term))

      if (!matchesSearch) return false

      if (statusFilter === 'all') return true
      if (statusFilter === 'top_pick') {
        const topSlice = sortedCandidates.slice(0, topPicksCount)
        return topSlice.some((top) => top.id === c.id)
      }
      if (statusFilter === 'selected') return c.status === 'selected'
      if (statusFilter === 'rejected') return c.status === 'rejected'
      if (statusFilter === 'pending') return c.status === 'pending' || !c.status
      if (statusFilter === 'hired') return c.status === 'hired'
      return true
    })
  }, [sortedCandidates, searchTerm, statusFilter, topPicksCount])

  // Navigation clavier : Flèche Haut / Bas pour naviguer dans la liste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = filteredCandidates.findIndex((c) => c.id === selectedCandidateId)
        if (currentIndex === -1 && filteredCandidates.length > 0) {
          onSelectCandidate(filteredCandidates[0].id)
          return
        }

        if (e.key === 'ArrowDown' && currentIndex < filteredCandidates.length - 1) {
          onSelectCandidate(filteredCandidates[currentIndex + 1].id)
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          onSelectCandidate(filteredCandidates[currentIndex - 1].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredCandidates, selectedCandidateId, onSelectCandidate])

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
    if (score >= 65) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25'
    if (score >= 50) return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'top_pick':
        return { label: 'Top Pick', className: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold' }
      case 'selected':
        return { label: 'Sélectionné', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' }
      case 'hired':
        return { label: 'Recruté', className: 'bg-emerald-600 text-white border-emerald-600 font-semibold' }
      case 'rejected':
        return { label: 'Écarté', className: 'bg-muted text-muted-foreground border-border/80' }
      default:
        return { label: 'À évaluer', className: 'bg-muted/80 text-foreground/80 border-border/70' }
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      {/* En-tête de la liste */}
      <div className="p-3.5 border-b border-border/70 space-y-2.5 bg-muted/15">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Candidats
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono tabular-nums font-semibold">
              {filteredCandidates.length}
            </Badge>
          </div>
          {onAddCandidate && (
            <Button
              size="sm"
              onClick={onAddCandidate}
              className="h-7 px-2.5 text-xs gap-1 font-semibold shadow-none"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter</span>
            </Button>
          )}
        </div>

        {/* Filtres compacts */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher nom, compétence..."
              className="h-8 text-xs pl-8 pr-2 bg-background border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-[11px] px-2 bg-background border-border shrink-0">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all" className="text-xs">Tous statuts</SelectItem>
              <SelectItem value="top_pick" className="text-xs">Top Picks</SelectItem>
              <SelectItem value="selected" className="text-xs">Sélectionnés</SelectItem>
              <SelectItem value="pending" className="text-xs">À évaluer</SelectItem>
              <SelectItem value="hired" className="text-xs">Recrutés</SelectItem>
              <SelectItem value="rejected" className="text-xs">Écartés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Liste défilante des candidats */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Search className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-semibold text-foreground/80">Aucun candidat trouvé</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Modifiez vos filtres ou importez un nouveau profil</p>
          </div>
        ) : (
          filteredCandidates.map((candidate, idx) => {
            const isSelected = candidate.id === selectedCandidateId
            const statusBadge = getStatusBadge(candidate.status)
            const isTop = idx < topPicksCount
            const initials = getCandidateInitials(candidate.name)

            return (
              <div
                key={candidate.id}
                onClick={() => onSelectCandidate(candidate.id)}
                className={cn(
                  'p-3 cursor-pointer transition-all select-none border-l-3',
                  isSelected
                    ? 'bg-primary/[0.04] dark:bg-primary/[0.08] border-l-primary'
                    : 'hover:bg-muted/30 border-l-transparent'
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Badge Initiales */}
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs font-mono shadow-2xs border',
                      isSelected
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-muted/70 border-border/80 text-foreground/80'
                    )}>
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold tabular-nums">
                          #{idx + 1}
                        </span>
                        <p className={cn(
                          'text-xs truncate tracking-tight',
                          isSelected ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'
                        )}>
                          {candidate.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {candidate.email || 'Aucun email'}
                      </p>
                    </div>
                  </div>

                  {/* Score global */}
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-bold tabular-nums shrink-0 shadow-2xs',
                    getScoreBadgeClass(candidate.score || 0)
                  )}>
                    {isTop && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                    <span>{candidate.score ?? '—'}</span>
                    <span className="text-[10px] opacity-70">/100</span>
                  </div>
                </div>

                {/* Métadonnées & Statut épurés (Pas de phrases tronquées à 85px) */}
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
                  <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-medium leading-none', statusBadge.className)}>
                    {statusBadge.label}
                  </span>

                  <div className="flex items-center gap-2 text-muted-foreground font-mono">
                    {candidate.fileName && (
                      <span className="flex items-center gap-1 truncate max-w-[120px]" title={candidate.fileName}>
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{candidate.fileName}</span>
                      </span>
                    )}
                    {candidate.interviewQuestions && candidate.interviewQuestions.length > 0 && (
                      <span className="tabular-nums">
                        {candidate.interviewQuestions.length} Q
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Raccourci d'aide en bas de liste */}
      <div className="px-3 py-2 border-t border-border/70 bg-muted/10 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground font-mono">
          Navigation rapide : utilisez ↑ et ↓
        </span>
      </div>
    </div>
  )
}
