import { useState, useEffect } from 'react'
import { Position, Language, TargetLevel } from '@/lib/types'
import { t } from '@/lib/translations'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Sparkle } from 'lucide-react'
import FastPositionImportDialog from './positions/FastPositionImportDialog'

interface PositionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: Language
  /** If provided, the dialog is in edit mode */
  position?: Position | null
  /** Called in create mode */
  onCreatePosition?: (position: Position) => void
  /** Called in edit mode */
  onSave?: (position: Position) => void
  /** Required in create mode */
  companyId?: string
}

export default function PositionFormDialog({
  open,
  onOpenChange,
  language,
  position,
  onCreatePosition,
  onSave,
  companyId,
}: PositionFormDialogProps) {
  const isEditMode = !!position
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [openings, setOpenings] = useState('1')
  const [isInternship, setIsInternship] = useState(false)
  const [targetLevel, setTargetLevel] = useState<TargetLevel>('mid')

  useEffect(() => {
    if (position) {
      setTitle(position.title)
      setDescription(position.description)
      setRequirements(position.requirements)
      setOpenings(position.openings.toString())
      setIsInternship(position.isInternship || false)
      setTargetLevel(position.targetLevel || 'mid')
    } else {
      setTitle('')
      setDescription('')
      setRequirements('')
      setOpenings('1')
      setIsInternship(false)
      setTargetLevel('mid')
    }
  }, [position])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim() || !requirements.trim()) {
      toast.error(t('createPosition.errorFields', language))
      return
    }

    const openingsNum = parseInt(openings)
    if (isNaN(openingsNum) || openingsNum < 1) {
      toast.error(t('createPosition.errorOpenings', language))
      return
    }

    if (isEditMode && position && onSave) {
      onSave({
        ...position,
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        openings: openingsNum,
        isInternship,
        targetLevel,
      })
      toast.success(language === 'fr' ? 'Poste modifié avec succès' : 'Position updated successfully')
    } else if (onCreatePosition && companyId) {
      const newPosition: Position = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        openings: openingsNum,
        createdAt: Date.now(),
        status: 'active',
        isInternship,
        targetLevel,
      }
      onCreatePosition(newPosition)
      toast.success(t('createPosition.success', language))
      setTitle('')
      setDescription('')
      setRequirements('')
      setOpenings('1')
      setIsInternship(false)
      setTargetLevel('mid')
    }

    onOpenChange(false)
  }

  const prefix = isEditMode ? 'edit-' : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {isEditMode
              ? (language === 'fr' ? 'Modifier le poste' : 'Edit Position')
              : t('createPosition.title', language)}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEditMode
              ? (language === 'fr' ? 'Modifiez les détails du poste' : 'Edit the position details')
              : t('createPosition.description', language)}
          </DialogDescription>
        </DialogHeader>

        {!isEditMode && companyId && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/25 bg-primary/5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {language === 'fr' ? 'Gagner du temps avec l\'IA' : 'Save time with AI'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {language === 'fr'
                    ? 'Collez une affiche (image) ou le texte d\'une annonce pour préremplir ce formulaire'
                    : 'Paste a flyer image or raw message to auto-fill this form'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAiImportOpen(true)}
              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            >
              <Sparkle className="w-3 h-3" />
              {language === 'fr' ? 'Importer avec l\'IA' : 'Import with AI'}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}title`} className="text-sm">
              {t('createPosition.jobTitle', language)} {t('createPosition.required', language)}
            </Label>
            <Input
              id={`${prefix}title`}
              placeholder={t('createPosition.jobTitlePlaceholder', language)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}description`} className="text-sm">
              {t('createPosition.jobDescription', language)} {t('createPosition.required', language)}
            </Label>
            <Textarea
              id={`${prefix}description`}
              placeholder={t('createPosition.jobDescriptionPlaceholder', language)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}requirements`} className="text-sm">
              {t('createPosition.requirements', language)} {t('createPosition.required', language)}
            </Label>
            <Textarea
              id={`${prefix}requirements`}
              placeholder={t('createPosition.requirementsPlaceholder', language)}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}openings`} className="text-sm">
              {t('createPosition.numberOfOpenings', language)} {t('createPosition.required', language)}
            </Label>
            <Input
              id={`${prefix}openings`}
              type="number"
              min="1"
              placeholder="1"
              value={openings}
              onChange={(e) => setOpenings(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor={`${prefix}internship`} className="text-sm font-medium cursor-pointer">
                {language === 'fr' ? 'Il s\'agit d\'un stage' : 'This is an internship'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'fr'
                  ? 'Les faiblesses seront moins pénalisantes dans l\'évaluation'
                  : 'Weaknesses will be less penalizing in the evaluation'}
              </p>
            </div>
            <Switch
              id={`${prefix}internship`}
              checked={isInternship}
              onCheckedChange={setIsInternship}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${prefix}targetLevel`} className="text-sm">
              {language === 'fr' ? 'Niveau ciblé' : language === 'es' ? 'Nivel objetivo' : 'Target Level'}
            </Label>
            <Select value={targetLevel} onValueChange={(v) => setTargetLevel(v as TargetLevel)}>
              <SelectTrigger id={`${prefix}targetLevel`} className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">
                  {language === 'fr' ? 'Junior — Potentiel > Expérience' : language === 'es' ? 'Junior — Potencial > Experiencia' : 'Junior — Potential > Experience'}
                </SelectItem>
                <SelectItem value="mid">
                  {language === 'fr' ? 'Mid-level — Équilibré' : language === 'es' ? 'Mid-level — Equilibrado' : 'Mid-level — Balanced'}
                </SelectItem>
                <SelectItem value="senior">
                  {language === 'fr' ? 'Senior — Expérience > Potentiel' : language === 'es' ? 'Senior — Experiencia > Potencial' : 'Senior — Experience > Potential'}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {language === 'fr'
                ? 'Adapte les seuils d\'évaluation au niveau d\'expérience attendu'
                : language === 'es'
                  ? 'Adapta los umbrales de evaluación al nivel de experiencia esperado'
                  : 'Adapts evaluation thresholds to the expected experience level'}
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {t('createPosition.cancel', language)}
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {isEditMode
                ? (language === 'fr' ? 'Enregistrer' : 'Save')
                : t('createPosition.create', language)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {!isEditMode && companyId && (
        <FastPositionImportDialog
          open={aiImportOpen}
          onOpenChange={setAiImportOpen}
          companyId={companyId}
          language={language}
          onCreatePosition={(newPos) => {
            onCreatePosition?.(newPos)
            onOpenChange(false)
          }}
          onPrefillForm={(draft) => {
            setTitle(draft.title)
            setDescription(draft.description)
            setRequirements(draft.requirements)
            setOpenings(draft.openings.toString())
            setIsInternship(draft.isInternship)
            setTargetLevel(draft.targetLevel)
            setAiImportOpen(false)
            toast.success(language === 'fr' ? 'Formulaire prérempli depuis l\'annonce !' : 'Form filled from announcement!')
          }}
        />
      )}
    </Dialog>
  )
}
