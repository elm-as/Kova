import { useState } from 'react'
import { Candidate, Position, Language } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Trash2,
  Mail,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateCandidatePDF } from '@/lib/pdfExport'
import CandidateAssessmentTab from './CandidateAssessmentTab'
import CandidateInterviewTab from './CandidateInterviewTab'
import { cn } from '@/lib/utils'

interface CandidateDetailPaneProps {
  candidate: Candidate | null
  position: Position
  positions: Position[]
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  onOpenEmailDialog?: (candidate: Candidate) => void
  language: Language
  rank?: number
}

function getCandidateInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CandidateDetailPane({
  candidate,
  position,
  positions,
  setCandidates,
  onOpenEmailDialog,
  language,
  rank = 1,
}: CandidateDetailPaneProps) {
  const [activeTab, setActiveTab] = useState<'assessment' | 'interview' | 'resume'>('assessment')

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-13rem)] rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
        <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-semibold text-foreground">Aucun candidat sélectionné</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Sélectionnez un profil dans la liste de gauche pour analyser son score, ses compétences et préparer l'entretien.
        </p>
      </div>
    )
  }

  const handleStatusChange = (newStatus: Candidate['status']) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, status: newStatus } : c))
    )
    toast.success(`Statut mis à jour : ${newStatus}`)
  }

  const handleDeleteCandidate = () => {
    if (!confirm(`Supprimer définitivement la candidature de ${candidate.name} ?`)) return
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))
    toast.success('Candidat supprimé.')
  }

  const handleExportPDF = () => {
    try {
      generateCandidatePDF(candidate, position, language)
      toast.success('Rapport PDF généré avec succès.')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la génération du PDF.')
    }
  }

  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-emerald-700 dark:text-emerald-400'
    if (val >= 60) return 'text-amber-700 dark:text-amber-400'
    return 'text-rose-700 dark:text-rose-400'
  }

  const initials = getCandidateInitials(candidate.name)

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
      {/* En-tête exécutif épuré */}
      <div className="px-5 py-4 border-b border-border/70 bg-muted/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar élégant avec initiales & badge de rang */}
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 font-bold text-sm text-primary tracking-tight shadow-xs">
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 font-mono text-[10px] font-bold px-1 py-0.2 rounded-full bg-background border border-border text-muted-foreground shadow-xs tabular-nums">
                #{rank}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
                  {candidate.name}
                </h2>
                <div className={cn(
                  'flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border tabular-nums shadow-2xs',
                  candidate.score >= 80 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25' :
                  candidate.score >= 65 ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25' :
                  candidate.score >= 50 ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30' :
                  'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                )}>
                  <span>{candidate.score}</span>
                  <span className="text-[10px] opacity-70">/100</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {candidate.email || 'Aucun email'} • Analysé le {new Date(candidate.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Actions & Statut */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Select value={candidate.status || 'pending'} onValueChange={(val: any) => handleStatusChange(val)}>
              <SelectTrigger className="h-8 w-32 text-xs bg-background border-border">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="pending" className="text-xs">À évaluer</SelectItem>
                <SelectItem value="top_pick" className="text-xs">Top Pick</SelectItem>
                <SelectItem value="selected" className="text-xs">Sélectionné</SelectItem>
                <SelectItem value="rejected" className="text-xs">Écarté</SelectItem>
                <SelectItem value="hired" className="text-xs">Recruté</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-8 text-xs gap-1.5 px-2.5 shadow-none"
              title="Exporter fiche candidat PDF"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">PDF</span>
            </Button>

            {onOpenEmailDialog && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenEmailDialog(candidate)}
                className="h-8 text-xs gap-1.5 px-2.5 shadow-none"
                title="Rédiger un email pour ce candidat"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Email</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteCandidate}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Supprimer candidat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Barre d'onglets ergonomique */}
        <div className="mt-3.5 pt-2.5 border-t border-border/60">
          <div className="inline-flex p-0.5 rounded-lg bg-muted/60 border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('assessment')}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs transition-all font-medium',
                activeTab === 'assessment'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Évaluation IA (7 axes)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('interview')}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs transition-all font-medium flex items-center gap-1.5',
                activeTab === 'interview'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Entretien Technique</span>
              {candidate.interviewQuestions && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted font-bold text-muted-foreground tabular-nums">
                  {candidate.interviewQuestions.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resume')}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs transition-all font-medium',
                activeTab === 'resume'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Texte du CV
            </button>
          </div>
        </div>
      </div>

      {/* Corps du détail défilant */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeTab === 'assessment' && (
          <CandidateAssessmentTab
            candidate={candidate}
            language={language}
            getScoreColor={getScoreColor}
          />
        )}

        {activeTab === 'interview' && (
          <CandidateInterviewTab
            candidate={candidate}
            position={position}
            setCandidates={setCandidates}
            language={language}
          />
        )}

        {activeTab === 'resume' && (
          <div className="rounded-lg border border-border/80 bg-card p-4 space-y-2 max-w-4xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>Texte extrait du document ({candidate.fileName || 'CV'})</span>
              <span className="tabular-nums">{candidate.profileText?.length || 0} caractères</span>
            </div>
            <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed p-3.5 bg-muted/20 rounded-md border border-border/50 max-h-[500px] overflow-y-auto">
              {candidate.profileText || 'Aucun texte extrait disponible.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
