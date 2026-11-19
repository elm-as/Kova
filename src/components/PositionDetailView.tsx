import { useState, useMemo } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import AddCandidateDialog from './AddCandidateDialog'
import EditPositionDialog from './EditPositionDialog'
import CompareScoresDialog from './CompareScoresDialog'
import { ComparisonMatrixDialog } from './ComparisonMatrixDialog'
import EmailTemplateDialog from './EmailTemplateDialog'
import CandidateMasterList from './candidates/CandidateMasterList'
import CandidateDetailPane from './candidates/CandidateDetailPane'
import PositionDetailHeader from './positions/PositionDetailHeader'
import PositionDecisionToolbar from './positions/PositionDecisionToolbar'
import { generatePositionReportPDF } from '@/lib/pdfExport'

interface PositionDetailViewProps {
  position: Position
  onBack: () => void
  candidates: Candidate[]
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  positions: Position[]
  setPositions: (updater: (prev: Position[]) => Position[]) => void
  language: Language
}

export default function PositionDetailView({
  position,
  onBack,
  candidates,
  setCandidates,
  positions,
  setPositions,
  language,
}: PositionDetailViewProps) {
  const [addCandidateOpen, setAddCandidateOpen] = useState(false)
  const [editPositionOpen, setEditPositionOpen] = useState(false)
  const [compareScoresOpen, setCompareScoresOpen] = useState(false)
  const [comparisonMatrixOpen, setComparisonMatrixOpen] = useState(false)
  const [emailTemplateOpen, setEmailTemplateOpen] = useState(false)

  // Position's candidates
  const positionCandidates = useMemo(() => {
    return candidates.filter((c) => c.positionId === position.id)
  }, [candidates, position.id])

  // Selected candidate state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => {
    return positionCandidates.length > 0 ? positionCandidates[0].id : null
  })

  // Selected candidate object & computed rank
  const activeCandidate = useMemo(() => {
    if (!positionCandidates.length) return null
    const found = positionCandidates.find((c) => c.id === selectedCandidateId)
    return found || positionCandidates[0]
  }, [positionCandidates, selectedCandidateId])

  const activeCandidateRank = useMemo(() => {
    if (!activeCandidate) return 1
    const sorted = [...positionCandidates].sort((a, b) => b.score - a.score)
    const index = sorted.findIndex((c) => c.id === activeCandidate.id)
    return index !== -1 ? index + 1 : 1
  }, [positionCandidates, activeCandidate])

  // Statistics
  const hiredCount = useMemo(() => {
    return positionCandidates.filter((c) => c.status === 'hired').length
  }, [positionCandidates])

  const isPositionLocked = hiredCount > 0

  const pendingEvaluationsCount = useMemo(() => {
    return positionCandidates.reduce((count, candidate) => {
      const answered = candidate.questionAnswers?.length || 0
      const scored = candidate.questionAnswers?.filter((qa) => qa.aiScore).length || 0
      return count + (answered - scored)
    }, 0)
  }, [positionCandidates])

  // Actions
  const handleArchivePosition = () => {
    if (isPositionLocked) {
      toast.error(t('positions.cannotArchiveLocked', language))
      return
    }

    const archivedPosition = { ...position, status: 'archived' as const, archivedAt: Date.now() }
    setPositions((prev) => prev.map((p) => (p.id === position.id ? archivedPosition : p)))
    toast.success(t('positions.archiveSuccess', language))
    onBack()
  }

  const handleDeletePosition = () => {
    if (isPositionLocked) {
      toast.error(t('positions.cannotDeleteLocked', language))
      return
    }

    setPositions((prev) => prev.filter((p) => p.id !== position.id))
    setCandidates((prev) => prev.filter((c) => c.positionId !== position.id))
    dispatchWebhookEvent(position.companyId, 'position.deleted', {
      positionId: position.id,
      title: position.title,
    })
    toast.success(t('positions.deleteSuccess', language))
    onBack()
  }

  const handleDeleteSingleCandidate = (id: string) => {
    const target = positionCandidates.find((c) => c.id === id)
    setCandidates((prev) => prev.filter((c) => c.id !== id))
    if (target) {
      dispatchWebhookEvent(position.companyId, 'candidate.deleted', {
        candidateId: target.id,
        name: target.name,
        positionId: position.id,
      })
    }
    toast.success('Candidat supprimé.')
    if (selectedCandidateId === id) {
      const remaining = positionCandidates.filter((c) => c.id !== id)
      setSelectedCandidateId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const handleBulkDeleteCandidates = (ids: string[]) => {
    setCandidates((prev) => prev.filter((c) => !ids.includes(c.id)))
    ids.forEach((id) => {
      const target = positionCandidates.find((c) => c.id === id)
      if (target) {
        dispatchWebhookEvent(position.companyId, 'candidate.deleted', {
          candidateId: target.id,
          name: target.name,
          positionId: position.id,
        })
      }
    })
    toast.success(`${ids.length} candidat(s) supprimé(s).`)
    if (selectedCandidateId && ids.includes(selectedCandidateId)) {
      const remaining = positionCandidates.filter((c) => !ids.includes(c.id))
      setSelectedCandidateId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  return (
    <div className="space-y-3.5">
      {/* En-tête exécutif du poste */}
      <PositionDetailHeader
        position={position}
        candidates={positionCandidates}
        hiredCount={hiredCount}
        pendingEvaluationsCount={pendingEvaluationsCount}
        language={language}
        onBack={onBack}
        onEdit={() => setEditPositionOpen(true)}
        onArchive={handleArchivePosition}
        onDelete={handleDeletePosition}
        onAddCandidate={() => setAddCandidateOpen(true)}
      />

      {/* Barre d'outils décisionnelle */}
      <PositionDecisionToolbar
        position={position}
        candidates={positionCandidates}
        language={language}
        onOpenComparisonMatrix={() => setComparisonMatrixOpen(true)}
        onOpenCompareScores={() => setCompareScoresOpen(true)}
        onOpenEmailTemplate={() => setEmailTemplateOpen(true)}
        onGenerateReportPDF={() => generatePositionReportPDF(position, positionCandidates, language)}
      />

      {/* Disposition Master-Detail */}
      {positionCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/50">
          <p className="text-base font-semibold text-foreground">
            Aucun candidat pour ce poste pour le moment.
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Importez un CV au format PDF ou saisissez les informations du candidat pour lancer l'évaluation automatisée.
          </p>
          <Button
            size="sm"
            onClick={() => setAddCandidateOpen(true)}
            className="mt-4 gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un candidat
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Colonne gauche (Master) : Liste scannable compacte */}
          <div className="lg:col-span-5 xl:col-span-4 h-[calc(100vh-13rem)] min-h-[500px]">
            <CandidateMasterList
              candidates={positionCandidates}
              selectedCandidateId={activeCandidate?.id || null}
              onSelectCandidate={setSelectedCandidateId}
              onAddCandidate={() => setAddCandidateOpen(true)}
              openings={position.openings}
              language={language}
              onDeleteCandidate={handleDeleteSingleCandidate}
              onBulkDelete={handleBulkDeleteCandidates}
            />
          </div>

          {/* Colonne droite (Detail) : Panneau d'analyse approfondie */}
          <div className="lg:col-span-7 xl:col-span-8 h-[calc(100vh-13rem)] min-h-[500px]">
            <CandidateDetailPane
              candidate={activeCandidate}
              position={position}
              positions={positions}
              setCandidates={setCandidates}
              language={language}
              rank={activeCandidateRank}
              onOpenEmailDialog={() => setEmailTemplateOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddCandidateDialog
        open={addCandidateOpen}
        onOpenChange={setAddCandidateOpen}
        position={position}
        setCandidates={setCandidates}
        positions={positions}
        language={language}
      />

      <EditPositionDialog
        open={editPositionOpen}
        onOpenChange={setEditPositionOpen}
        position={position}
        onSave={(updated) => {
          setPositions((prev) => prev.map((p) => (p.id === position.id ? updated : p)))
        }}
        language={language}
      />

      <CompareScoresDialog
        open={compareScoresOpen}
        onOpenChange={setCompareScoresOpen}
        candidates={positionCandidates}
        language={language}
      />

      <ComparisonMatrixDialog
        open={comparisonMatrixOpen}
        onOpenChange={setComparisonMatrixOpen}
        candidates={positionCandidates}
        position={position}
        language={language}
      />

      <EmailTemplateDialog
        open={emailTemplateOpen}
        onOpenChange={setEmailTemplateOpen}
        candidates={positionCandidates}
        position={position}
        language={language}
      />
    </div>
  )
}
