import { useState } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Pencil,
  Archive,
  Trash2,
  Plus,
  Lock,
} from 'lucide-react'

interface PositionDetailHeaderProps {
  position: Position
  candidates: Candidate[]
  hiredCount: number
  pendingEvaluationsCount: number
  language: Language
  onBack: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onAddCandidate: () => void
}

export default function PositionDetailHeader({
  position,
  candidates,
  hiredCount,
  pendingEvaluationsCount,
  onBack,
  onEdit,
  onArchive,
  onDelete,
  onAddCandidate,
}: PositionDetailHeaderProps) {
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const isPositionLocked = position.isLocked || position.status === 'archived'

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-border">
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs font-semibold">Postes</span>
          </Button>
          <div className="h-3.5 w-px bg-border/80" />
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
            {position.title}
          </h1>
        </div>

        {position.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 max-w-3xl leading-relaxed">
            {position.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Badge variant="outline" className="text-xs font-medium tabular-nums bg-background">
            {position.openings} {position.openings === 1 ? 'ouverture' : 'ouvertures'}
          </Badge>
          <Badge variant="secondary" className="text-xs font-semibold tabular-nums">
            {candidates.length} candidat{candidates.length > 1 ? 's' : ''}
          </Badge>
          {hiredCount > 0 && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs tabular-nums">
              {hiredCount} recruté{hiredCount > 1 ? 's' : ''}
            </Badge>
          )}
          {pendingEvaluationsCount > 0 && (
            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5">
              {pendingEvaluationsCount} réponse{pendingEvaluationsCount > 1 ? 's' : ''} à évaluer
            </Badge>
          )}
          {isPositionLocked && (
            <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-600 dark:text-blue-400 gap-1">
              <Lock className="w-3 h-3" /> Verrouillé
            </Badge>
          )}
        </div>
      </div>

      {/* Actions principales du poste */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="h-8 text-xs gap-1.5 bg-background shadow-2xs"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Modifier</span>
        </Button>

        <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isPositionLocked}
              className="h-8 text-xs gap-1.5 bg-background shadow-2xs"
            >
              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Archiver</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archiver ce poste ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le poste sera archivé et ne recevra plus de nouvelles candidatures.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setArchiveDialogOpen(false); onArchive() }}>
                Archiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={isPositionLocked}
              className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30 bg-background shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement ce poste ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le poste et toutes ses candidatures seront supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setDeleteDialogOpen(false); onDelete() }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          size="sm"
          onClick={onAddCandidate}
          className="h-8 text-xs gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau Candidat</span>
        </Button>
      </div>
    </div>
  )
}
