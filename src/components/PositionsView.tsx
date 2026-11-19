import { useState } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import {
  Briefcase,
  Plus,
  Sparkle,
  FolderArchive,
} from 'lucide-react'
import CreatePositionDialog from './CreatePositionDialog'
import PositionDetailView from './PositionDetailView'
import DateRangeFilter from './DateRangeFilter'
import PositionCardItem from './positions/PositionCardItem'
import FastPositionImportDialog from './positions/FastPositionImportDialog'
import { toast } from 'sonner'

interface PositionsViewProps {
  positions: Position[]
  setPositions: (updater: (prev: Position[]) => Position[]) => void
  candidates: Candidate[]
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  companyId: string
  language: Language
}

export default function PositionsView({
  positions,
  setPositions,
  candidates,
  setCandidates,
  companyId,
  language,
}: PositionsViewProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [fastImportOpen, setFastImportOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })

  const filterByDateRange = (position: Position) => {
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
  }

  const activePositions = positions.filter(
    (p) => (p.status === 'active' || !p.status) && filterByDateRange(p)
  )
  const archivedPositions = positions.filter(
    (p) => p.status === 'archived' && filterByDateRange(p)
  )

  const displayPositions = showArchived ? archivedPositions : activePositions

  const getCandidateCount = (positionId: string) => {
    return candidates.filter((c) => c.positionId === positionId).length
  }

  const unarchivePosition = (position: Position, e: React.MouseEvent) => {
    e.stopPropagation()
    const restoredPosition = { ...position, status: 'active' as const, archivedAt: undefined }

    setPositions((prev) => prev.map((p) => (p.id === position.id ? restoredPosition : p)))

    toast.success(t('positions.unarchiveSuccess', language), {
      action: {
        label: t('common.undo', language),
        onClick: () => {
          setPositions((prev) => prev.map((p) => (p.id === position.id ? position : p)))
          toast.success(t('common.undoAction', language))
        },
      },
      duration: 5000,
    })
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (selectedPosition) {
    const currentPosition =
      positions.find((p) => p.id === selectedPosition.id) || selectedPosition
    return (
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setSelectedPosition(null)
                }}
              >
                {t('nav.positions', language)}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPosition.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PositionDetailView
          position={currentPosition}
          onBack={() => setSelectedPosition(null)}
          candidates={candidates}
          setCandidates={setCandidates}
          positions={positions}
          setPositions={setPositions}
          language={language}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* En-tête + sélecteur d'onglets (Actifs / Archivés) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {showArchived ? 'Postes archivés' : 'Postes de recrutement'}
            </h1>
            <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                  !showArchived
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Actifs ({activePositions.length})
              </button>
              <button
                type="button"
                onClick={() => setShowArchived(true)}
                className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                  showArchived
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Archivés ({archivedPositions.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {showArchived
              ? 'Consultez les campagnes de recrutement terminées ou clôturées.'
              : 'Gérez vos postes ouverts, évaluez les CV et préparez les entretiens.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            language={language}
          />
          {!showArchived && (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => setFastImportOpen(true)}
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-medium"
              >
                <Sparkle className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Créer avec l\'IA' : 'Create with AI'}
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Nouveau poste' : 'New Position'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Grille des postes */}
      {displayPositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-border bg-card">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            {showArchived ? (
              <FolderArchive className="w-6 h-6" />
            ) : (
              <Briefcase className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {showArchived ? 'Aucun poste archivé' : 'Aucun poste actif pour le moment'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {showArchived
              ? 'Les campagnes de recrutement archivées apparaîtront dans cette section.'
              : 'Créez votre première offre d\'emploi pour commencer à recevoir et évaluer des candidatures.'}
          </p>
          {!showArchived && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Button
                onClick={() => setFastImportOpen(true)}
                size="sm"
                className="gap-1.5 text-xs bg-primary text-primary-foreground"
              >
                <Sparkle className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Importer une affiche ou annonce avec l\'IA' : 'Import flyer or announcement with AI'}
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Création manuelle' : 'Manual creation'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {displayPositions.map((position) => (
            <PositionCardItem
              key={position.id}
              position={position}
              candidates={candidates}
              showArchived={showArchived}
              language={language}
              onSelect={setSelectedPosition}
              onUnarchive={unarchivePosition}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      <CreatePositionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        companyId={companyId}
        onCreatePosition={(position) => {
          setPositions((prev) => [...prev, position])
          dispatchWebhookEvent(companyId, 'position.created', {
            positionId: position.id,
            title: position.title,
          })
        }}
        language={language}
      />

      <FastPositionImportDialog
        open={fastImportOpen}
        onOpenChange={setFastImportOpen}
        companyId={companyId}
        language={language}
        onCreatePosition={(position) => {
          setPositions((prev) => [...prev, position])
          dispatchWebhookEvent(companyId, 'position.created', {
            positionId: position.id,
            title: position.title,
          })
        }}
        onPrefillForm={(draft) => {
          setFastImportOpen(false)
          setCreateDialogOpen(true)
        }}
      />
    </div>
  )
}
