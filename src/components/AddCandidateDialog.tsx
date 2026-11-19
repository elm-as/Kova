import { useState, useRef } from 'react'
import { Position, Candidate, Language } from '@/lib/types'
import { t } from '@/lib/translations'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { extractTextFromFile, validateFileSize, optimizeTextForAnalysis } from '@/lib/fileUtils'
import { classifyDocument, DOCUMENT_TYPE_LABELS } from '@/lib/documentClassifier'
import { analyzeCandidateWithAI, findAlternativePositions, validateAnalysisInput, getStoredWeights } from '@/lib/aiAnalysis'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Sparkle, UploadSimple, FileText, FilePdf, FileHtml, FileDoc, FileImage, Files, X } from '@phosphor-icons/react'
import { DocumentTypeBadge } from '@/components/DocumentPreview'
import { motion } from 'framer-motion'

/** Helper: déterminer le type de fichier et l'icône correspondante */
function getFileInfo(name: string): { type: 'pdf' | 'html' | 'docx' | 'image' | 'txt'; icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'bold' }>; iconColor: string } {
  const n = name.toLowerCase()
  if (n.endsWith('.pdf')) return { type: 'pdf', icon: FilePdf, iconColor: 'text-destructive' }
  if (n.endsWith('.html') || n.endsWith('.htm')) return { type: 'html', icon: FileHtml, iconColor: 'text-accent' }
  if (n.endsWith('.docx') || n.endsWith('.doc')) return { type: 'docx', icon: FileDoc, iconColor: 'text-blue-500' }
  if (n.match(/\.(png|jpg|jpeg|webp)$/)) return { type: 'image', icon: FileImage, iconColor: 'text-emerald-500' }
  return { type: 'txt', icon: FileText, iconColor: 'text-muted-foreground' }
}

interface BatchFile {
  file: File
  name: string
  email: string
  status: 'pending' | 'extracting' | 'ready' | 'analyzing' | 'done' | 'error'
  text?: string
  error?: string
}

interface AddCandidateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: Position
  setCandidates: (updater: (prev: Candidate[]) => Candidate[]) => void
  positions: Position[]
  language: Language
}

export default function AddCandidateDialog({
  open,
  onOpenChange,
  position,
  setCandidates,
  positions,
  language,
}: AddCandidateDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileText, setProfileText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadMethod, setUploadMethod] = useState<'file' | 'paste' | 'batch'>('file')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [detectedDocType, setDetectedDocType] = useState<string>('')
  const [detectedDocLang, setDetectedDocLang] = useState<'fr' | 'en' | 'es' | ''>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([])
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  const handleFileUpload = async (file: File) => {
    if (!validateFileSize(file, 5)) {
      toast.error(t('addCandidate.errorFileSize', language))
      return
    }

    setIsExtracting(true)
    toast.info(t('addCandidate.extracting', language))

    try {
      const { text, fileType } = await extractTextFromFile(file)
      setProfileText(text)
      setUploadedFile(file)

      // Classifier le document pour détecter le type (CV, lettre, diplôme...)
      try {
        const classification = classifyDocument(text)
        setDetectedDocType(classification.documentType)
        setDetectedDocLang(classification.language === 'unknown' ? '' : classification.language as 'fr' | 'en' | 'es')
      } catch {
        // Classification silencieuse — non bloquante
      }

      toast.success(t('addCandidate.fileUploaded', language, { name: file.name }))
    } catch (error) {
      toast.error(t('addCandidate.errorFileRead', language))
      console.error(error)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const analyzeCandidate = async (candidate: Candidate) => {
    setIsAnalyzing(true)
    setProgress(10)

    try {
      setProgress(20)
      
      const otherPositions = positions.filter((p) => p.id !== position.id && (p.status === 'active' || !p.status))
      
      setProgress(30)
      
      const analysis = await analyzeCandidateWithAI(candidate, position, language, getStoredWeights())

      setProgress(70)

      const alternativePositions = await findAlternativePositions(
        candidate,
        position,
        otherPositions,
        analysis.score,
        language
      )

      setProgress(95)

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                score: analysis.score,
                scoreBreakdown: analysis.scoreBreakdown,
                strengths: analysis.strengths,
                weaknesses: analysis.weaknesses,
                overallAssessment: analysis.overallAssessment,
                alternativePositions,
                status: 'scored' as const,
                analyzedAt: Date.now(),
              }
            : c
        )
      )

      setProgress(100)

      dispatchWebhookEvent(position.companyId, 'candidate.analyzed', { candidateId: candidate.id, name: candidate.name, positionId: position.id, score: analysis.score })

      toast.success(t('addCandidate.success', language), {
        description: `${language === 'fr' ? 'Score' : 'Score'}: ${analysis.score}/100`,
        duration: 5000,
      })
    } catch (error) {
      let errorMessage = t('addCandidate.errorAnalysis', language)
      
      if (error instanceof Error) {
        errorMessage += ': ' + error.message
      }
      
      toast.error(errorMessage, {
        duration: 8000,
      })
      
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))
    } finally {
      setIsAnalyzing(false)
      setProgress(0)
    }
  }

  // --- Batch upload ---
  const handleBatchFiles = async (files: FileList) => {
    const newBatchFiles: BatchFile[] = []
    for (const file of Array.from(files)) {
      if (!validateFileSize(file, 5)) {
        toast.error(`${file.name}: ${t('addCandidate.errorFileSize', language)}`)
        continue
      }
      const baseName = file.name.replace(/\.(pdf|html?|txt)$/i, '').replace(/[_-]/g, ' ')
      newBatchFiles.push({
        file,
        name: baseName,
        email: '',
        status: 'pending',
      })
    }
    setBatchFiles(prev => [...prev, ...newBatchFiles])

    // Auto-extract text from all new files
    for (const bf of newBatchFiles) {
      setBatchFiles(prev => prev.map(f => f === bf ? { ...f, status: 'extracting' } : f))
      try {
        const { text } = await extractTextFromFile(bf.file)
        setBatchFiles(prev => prev.map(f => f === bf ? { ...f, status: 'ready', text } : f))
      } catch {
        setBatchFiles(prev => prev.map(f => f === bf ? { ...f, status: 'error', error: t('addCandidate.errorFileRead', language) } : f))
      }
    }
  }

  const removeBatchFile = (index: number) => {
    setBatchFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateBatchFile = (index: number, field: 'name' | 'email', value: string) => {
    setBatchFiles(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  const handleBatchSubmit = async () => {
    const readyFiles = batchFiles.filter(f => f.status === 'ready' && f.name.trim())
    if (readyFiles.length === 0) {
      toast.error(language === 'fr' ? 'Aucun fichier prêt à analyser.' : 'No files ready to analyze.')
      return
    }

    setBatchProcessing(true)
    setBatchProgress({ current: 0, total: readyFiles.length })
    onOpenChange(false)

    for (let i = 0; i < readyFiles.length; i++) {
      const bf = readyFiles[i]
      setBatchProgress({ current: i + 1, total: readyFiles.length })

      const optimizedText = optimizeTextForAnalysis(bf.text!)

      // Classifier
      let docType: string | undefined
      let docLang: 'fr' | 'en' | 'es' | undefined
      try {
        const cls = classifyDocument(bf.text!)
        docType = cls.documentType
        if (cls.language !== 'unknown') docLang = cls.language as 'fr' | 'en' | 'es'
      } catch { /* ignore */ }

      const newCandidate: Candidate = {
        id: `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        positionId: position.id,
        name: bf.name.trim(),
        email: bf.email.trim() || `${bf.name.trim().toLowerCase().replace(/\s+/g, '.')}@pending.review`,
        profileText: optimizedText,
        fileName: bf.file.name,
        fileType: getFileInfo(bf.file.name).type,
        documentType: docType,
        documentLanguage: docLang,
        score: 0,
        scoreBreakdown: [],
        strengths: [],
        weaknesses: [],
        overallAssessment: '',
        status: 'analyzing',
        createdAt: Date.now(),
      }

      setCandidates(prev => [...prev, newCandidate])

      try {
        await analyzeCandidate(newCandidate)
      } catch {
        // analyzeCandidate handles its own errors
      }
    }

    setBatchProcessing(false)
    setBatchFiles([])
    toast.success(language === 'fr'
      ? `${readyFiles.length} candidat(s) analysé(s) avec succès.`
      : `${readyFiles.length} candidate(s) analyzed successfully.`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (uploadMethod === 'batch') {
      await handleBatchSubmit()
      return
    }

    const validation = validateAnalysisInput(name.trim(), email.trim(), profileText.trim())
    
    if (!validation.valid) {
      toast.error(validation.error || t('addCandidate.errorFields', language))
      return
    }

    const optimizedProfileText = optimizeTextForAnalysis(profileText.trim())

    const newCandidate: Candidate = {
      id: `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      positionId: position.id,
      name: name.trim(),
      email: email.trim(),
      profileText: optimizedProfileText,
      fileName: uploadedFile?.name,
      fileType: uploadedFile ? getFileInfo(uploadedFile.name).type : undefined,
      documentType: detectedDocType || undefined,
      documentLanguage: detectedDocLang || undefined,
      score: 0,
      scoreBreakdown: [],
      strengths: [],
      weaknesses: [],
      overallAssessment: '',
      status: 'analyzing',
      createdAt: Date.now(),
    }

    setCandidates((prev) => [...prev, newCandidate])
    dispatchWebhookEvent(position.companyId, 'candidate.created', { candidateId: newCandidate.id, name: newCandidate.name, positionId: position.id })

    setName('')
    setEmail('')
    setProfileText('')
    setUploadedFile(null)
    onOpenChange(false)

    await analyzeCandidate(newCandidate)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Sparkle size={24} className="text-accent" weight="duotone" />
            {t('addCandidate.title', language)}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('addCandidate.description', language)}
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 space-y-6"
          >
            <div className="text-center space-y-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkle size={64} className="text-accent mx-auto mb-4" weight="duotone" />
              </motion.div>
              <div>
                <h3 className="text-xl font-semibold mb-2">{t('addCandidate.analyzing', language)}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {progress < 30 ? (language === 'fr' ? 'Préparation de l\'analyse...' : 'Preparing analysis...') :
                   progress < 70 ? (language === 'fr' ? 'Évaluation approfondie en cours...' : 'Deep evaluation in progress...') :
                   progress < 95 ? (language === 'fr' ? 'Recherche de correspondances alternatives...' : 'Finding alternative matches...') :
                   (language === 'fr' ? 'Finalisation...' : 'Finalizing...')}
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="w-full h-3" />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as 'file' | 'paste' | 'batch')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file" className="gap-2">
                  <UploadSimple size={18} weight="duotone" />
                  {t('addCandidate.file', language)}
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-2">
                  <FileText size={18} weight="duotone" />
                  {t('addCandidate.paste', language)}
                </TabsTrigger>
                <TabsTrigger value="batch" className="gap-2">
                  <Files size={18} weight="duotone" />
                  {language === 'fr' ? 'Lot' : 'Batch'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4 mt-6">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 transition-all cursor-pointer bg-muted/20"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadedFile ? (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-3">
                      {(() => {
                        const finfo = getFileInfo(uploadedFile.name)
                        const FIcon = finfo.icon
                        return <span className={`${finfo.iconColor} block`}><FIcon size={48} weight="duotone" /></span>
                      })()}
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024).toFixed(2)} KB
                      </p>
                      {detectedDocType && (
                        <div className="flex justify-center gap-2">
                          <DocumentTypeBadge documentType={detectedDocType as any} confidence={0.8} />
                          {detectedDocLang && (
                            <Badge variant="outline" className="text-xs">{detectedDocLang.toUpperCase()}</Badge>
                          )}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUploadedFile(null)
                          setProfileText('')
                          setDetectedDocType('')
                          setDetectedDocLang('')
                        }}
                      >
                        {t('candidate.changeFile', language)}
                      </Button>
                    </motion.div>
                  ) : (
                    <>
                      <UploadSimple size={48} className="text-muted-foreground mx-auto mb-4" weight="duotone" />
                      <p className="text-base font-medium mb-2">
                        {t('addCandidate.dragDrop', language)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('addCandidate.uploadDesc', language)}
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.html,.htm,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <Sparkle size={18} className="text-accent mt-0.5 shrink-0" weight="duotone" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {language === 'fr' 
                      ? "Les CV volumineux sont automatiquement optimisés pour une analyse IA efficace. Seules les sections les plus pertinentes (compétences, expérience, formation) sont conservées."
                      : "Large CVs are automatically optimized for efficient AI analysis. Only the most relevant sections (skills, experience, education) are retained."}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="profile-text-paste">
                    {t('addCandidate.profileText', language)} *
                  </Label>
                  <Textarea
                    id="profile-text-paste"
                    placeholder={t('addCandidate.profileTextPlaceholder', language)}
                    value={profileText}
                    onChange={(e) => setProfileText(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="batch" className="space-y-4 mt-6">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-all cursor-pointer bg-muted/20"
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleBatchFiles(e.dataTransfer.files) }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => batchInputRef.current?.click()}
                >
                  <Files size={48} className="text-muted-foreground mx-auto mb-3" weight="duotone" />
                  <p className="text-sm font-medium">
                    {language === 'fr' ? 'Glissez-déposez plusieurs CVs ici' : 'Drag & drop multiple CVs here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, HTML, TXT, PNG, JPG — {language === 'fr' ? 'max 5 Mo chacun' : 'max 5 MB each'}</p>
                  <input
                    ref={batchInputRef}
                    type="file"
                    accept=".pdf,.html,.htm,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.length) handleBatchFiles(e.target.files) }}
                  />
                </div>

                {batchFiles.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {batchFiles.map((bf, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg bg-card text-sm">
                        {(() => {
                           const finfo = getFileInfo(bf.file.name)
                           const FIcon = finfo.icon
                           return <span className={`${finfo.iconColor} shrink-0`}><FIcon size={20} weight="duotone" /></span>
                         })()}
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder={language === 'fr' ? 'Nom' : 'Name'}
                            value={bf.name}
                            onChange={(e) => updateBatchFile(idx, 'name', e.target.value)}
                            className="h-7 text-xs"
                          />
                          <Input
                            placeholder="Email"
                            value={bf.email}
                            onChange={(e) => updateBatchFile(idx, 'email', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {bf.status === 'extracting' ? '⏳' : bf.status === 'ready' ? '✓' : bf.status === 'error' ? '✗' : '…'}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeBatchFile(idx)}>
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {uploadMethod !== 'batch' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="candidate-name" className="text-sm">
                    {t('addCandidate.candidateName', language)} *
                  </Label>
                  <Input
                    id="candidate-name"
                    placeholder={t('addCandidate.candidateNamePlaceholder', language)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="candidate-email" className="text-sm">
                    {t('addCandidate.candidateEmail', language)} *
                  </Label>
                  <Input
                    id="candidate-email"
                    type="email"
                    placeholder={t('addCandidate.candidateEmailPlaceholder', language)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                {t('addCandidate.cancel', language)}
              </Button>
              <Button type="submit" className="gap-2 w-full sm:w-auto" disabled={isExtracting || batchProcessing}>
                <Sparkle size={18} weight="duotone" />
                {uploadMethod === 'batch'
                  ? (language === 'fr' ? `Analyser ${batchFiles.filter(f => f.status === 'ready').length} CV(s)` : `Analyze ${batchFiles.filter(f => f.status === 'ready').length} CV(s)`)
                  : t('addCandidate.analyze', language)}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
