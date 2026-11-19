import { useState, useRef } from 'react'
import { Language } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  UploadSimple,
  FileImage,
  ClipboardText,
  X,
  FileText,
  Sparkle,
} from '@phosphor-icons/react'

interface PositionImportDropzoneProps {
  language: Language
  file: File | null
  text: string
  isProcessing: boolean
  processingStep: string
  onFileSelect: (file: File | null) => void
  onTextChange: (text: string) => void
  onStartExtract: () => void
}

export default function PositionImportDropzone({
  language,
  file,
  text,
  isProcessing,
  processingStep,
  onFileSelect,
  onTextChange,
  onStartExtract,
}: PositionImportDropzoneProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      onFileSelect(droppedFile)
      setActiveTab('image')
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      onFileSelect(selected)
    }
  }

  const handlePasteClipboardText = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText) {
        onTextChange(clipboardText)
        setActiveTab('text')
      }
    } catch {
      // Échec de lecture du presse-papier système (permissions navigateur)
    }
  }

  const canSubmit = !isProcessing && (Boolean(file) || text.trim().length >= 15)

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'text')}>
        <TabsList className="grid grid-cols-2 w-full h-9">
          <TabsTrigger value="image" className="text-xs gap-1.5">
            <FileImage className="w-3.5 h-3.5" />
            {language === 'fr' ? 'Affiche / Image de poste' : 'Job Poster / Image'}
          </TabsTrigger>
          <TabsTrigger value="text" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {language === 'fr' ? 'Texte / Message (WhatsApp, LinkedIn)' : 'Text / Message'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 : Image / Affiche */}
        <TabsContent value="image" className="mt-3 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 bg-muted/20'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadSimple size={20} weight="bold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {language === 'fr'
                      ? 'Glissez votre affiche ici ou cliquez pour parcourir'
                      : 'Drop your job flyer here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PNG, JPG, WEBP ou PDF (capture d'écran, annonce graphique, flyer)
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background px-2.5 py-1 rounded-md border border-border mt-1">
                  <span>💡</span>
                  <span>{language === 'fr' ? 'Astuce : vous pouvez faire Ctrl+V pour coller une capture directement' : 'Tip: you can press Ctrl+V to paste a screenshot'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileImage size={20} weight="duotone" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    {(file.size / 1024).toFixed(0)} KB • Prêt pour l'extraction
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFileSelect(null)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <X size={16} />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Tab 2 : Texte brut / Message */}
        <TabsContent value="text" className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {language === 'fr'
                ? "Collez ici le message d'annonce reçu par WhatsApp, LinkedIn, email..."
                : 'Paste the announcement message here (WhatsApp, LinkedIn, email)...'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePasteClipboardText}
              className="h-7 text-xs gap-1"
            >
              <ClipboardText size={14} />
              {language === 'fr' ? 'Coller le presse-papier' : 'Paste clipboard'}
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={7}
            placeholder={
              language === 'fr'
                ? "Exemple :\nNous recrutons un Chef de Projet Digital (H/F) en CDI à Abidjan.\nMissions :\n- Piloter le développement des applications web\n- Coordonner l'équipe de 5 développeurs\nProfil recherché :\n- Bac+5 informatique avec au moins 3 ans d'expérience\n- Maîtrise des méthodes agiles et de React/Node.js..."
                : 'Paste full job posting description here...'
            }
            className="text-xs leading-relaxed font-sans"
          />
          <div className="flex justify-end text-[11px] text-muted-foreground font-mono tabular-nums">
            {text.length} caractères
          </div>
        </TabsContent>
      </Tabs>

      {/* Barre de statut et d'action */}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {isProcessing ? (
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              {processingStep}
            </span>
          ) : (
            <span>{language === 'fr' ? 'Extraction automatique des missions, profil et exigences' : 'Automatic extraction of requirements, level and duties'}</span>
          )}
        </div>
        <Button
          onClick={onStartExtract}
          disabled={!canSubmit}
          size="sm"
          className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-medium"
        >
          <Sparkle size={15} weight="fill" />
          {isProcessing
            ? (language === 'fr' ? 'Extraction...' : 'Extracting...')
            : (language === 'fr' ? 'Analyser avec l\'IA' : 'Extract with AI')}
        </Button>
      </div>
    </div>
  )
}
