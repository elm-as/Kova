import { useState, useEffect } from 'react'
import { Language, Position } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Sparkle, ArrowLeft, Plus, Edit3 } from 'lucide-react'
import PositionImportDropzone from './PositionImportDropzone'
import PositionImportPreview from './PositionImportPreview'
import {
  ExtractedPositionDraft,
  extractTextFromJobSource,
  extractPositionWithAi,
  buildPositionFromDraft,
} from '@/lib/positions/position-extractor'

interface FastPositionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  language: Language
  onCreatePosition?: (position: Position) => void
  onPrefillForm?: (draft: ExtractedPositionDraft) => void
}

export default function FastPositionImportDialog({
  open,
  onOpenChange,
  companyId,
  language,
  onCreatePosition,
  onPrefillForm,
}: FastPositionImportDialogProps) {
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [file, setFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')
  const [draft, setDraft] = useState<ExtractedPositionDraft | null>(null)

  // Réinitialisation lors de la fermeture
  useEffect(() => {
    if (!open) {
      setStep('input')
      setFile(null)
      setRawText('')
      setIsProcessing(false)
      setProcessingStep('')
      setDraft(null)
    }
  }, [open])

  // Détection du collage global (Ctrl+V) quand la modale est active
  useEffect(() => {
    if (!open || step !== 'input') return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      // Cas 1 : Image dans le presse-papier (capture d'écran d'une affiche)
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const pastedFile = items[i].getAsFile()
          if (pastedFile) {
            setFile(pastedFile)
            toast.info(language === 'fr' ? 'Capture d\'affiche détectée depuis le presse-papier' : 'Screenshot detected from clipboard')
            return
          }
        }
      }

      // Cas 2 : Texte d'annonce collé
      const pastedText = e.clipboardData?.getData('text')
      if (pastedText && pastedText.trim().length >= 15 && !file) {
        setRawText(pastedText.trim())
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, step, file, language])

  const handleStartExtract = async () => {
    setIsProcessing(true)
    setProcessingStep(language === 'fr' ? 'Lecture de la source...' : 'Reading source...')

    try {
      if (file && file.type.startsWith('image/')) {
        setProcessingStep(language === 'fr' ? 'Extraction OCR de l\'affiche...' : 'OCR extraction...')
      }

      const extractedText = await extractTextFromJobSource({ file, text: rawText })

      setProcessingStep(language === 'fr' ? 'Analyse et structuration par l\'IA...' : 'AI structuring...')
      const resultDraft = await extractPositionWithAi(extractedText, language)

      setDraft(resultDraft)
      setStep('preview')
      toast.success(language === 'fr' ? 'Annonce analysée avec succès !' : 'Job offer successfully analyzed!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'extraction'
      toast.error(message)
    } finally {
      setIsProcessing(false)
      setProcessingStep('')
    }
  }

  const handleDirectCreate = () => {
    if (!draft || !companyId) return

    if (!draft.title.trim() || !draft.description.trim() || !draft.requirements.trim()) {
      toast.error(language === 'fr' ? 'Veuillez remplir le titre, la description et les exigences' : 'Please fill all required fields')
      return
    }

    const newPosition = buildPositionFromDraft(draft, companyId)
    onCreatePosition?.(newPosition)
    toast.success(language === 'fr' ? `Poste « ${newPosition.title} » créé avec succès !` : 'Position created successfully!')
    onOpenChange(false)
  }

  const handleOpenInFullForm = () => {
    if (!draft) return
    onPrefillForm?.(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Sparkle className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              {step === 'input'
                ? (language === 'fr' ? 'Création Rapide de Poste assistée par l\'IA' : 'AI Quick Position Import')
                : (language === 'fr' ? 'Vérification et Prévisualisation du Poste' : 'Review & Preview Extracted Position')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'input'
              ? (language === 'fr'
                ? 'Collez l\'affiche graphique (image/flyer) ou le texte brut (WhatsApp, LinkedIn, Email). L\'IA prépare automatiquement les sections.'
                : 'Paste the job flyer image or text announcement. AI extracts all fields instantly.')
              : (language === 'fr'
                ? 'Vérifiez les sections extraites ci-dessous. Vous pouvez modifier n\'importe quel champ avant de valider.'
                : 'Inspect the extracted sections. You can edit any field before saving.')}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <PositionImportDropzone
            language={language}
            file={file}
            text={rawText}
            isProcessing={isProcessing}
            processingStep={processingStep}
            onFileSelect={setFile}
            onTextChange={setRawText}
            onStartExtract={handleStartExtract}
          />
        )}

        {step === 'preview' && draft && (
          <PositionImportPreview
            draft={draft}
            language={language}
            onDraftChange={setDraft}
          />
        )}

        {step === 'preview' && (
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep('input')}
              className="gap-1.5 text-xs w-full sm:w-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Recommencer' : 'Back'}
            </Button>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto ml-auto">
              {onPrefillForm && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInFullForm}
                  className="gap-1.5 text-xs w-full sm:w-auto"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {language === 'fr' ? 'Formulaire détaillé' : 'Edit in full form'}
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleDirectCreate}
                className="gap-1.5 text-xs bg-primary text-primary-foreground font-medium w-full sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Créer le poste maintenant' : 'Create Position Now'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
