import { useState, useCallback, useRef } from 'react'
import { Language } from '@/lib/types'
import {
  extractTextFromFile,
  extractStructuredData,
  extractTextWithMetadata,
  optimizeTextForAnalysis,
} from '@/lib/fileUtils'
import {
  classifyDocument,
  DOCUMENT_TYPE_LABELS,
  type ClassificationResult,
} from '@/lib/documentClassifier'
import { extractFields, fieldsToKeyValuePairs, getFieldNames } from '@/lib/fieldExtractor'
import {
  preprocessImage,
  extractWithMultipleEngines,
  extractTablesFromText,
  deskewImage,
  type OcrResult,
  type TableDetectionResult,
} from '@/lib/ocrPipeline'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  UploadSimple,
  FilePdf,
  CheckCircle,
  XCircle,
  MagnifyingGlass,
  Gear,
  ImageSquare,
  Table,
  IdentificationBadge,
  Copy,
  Warning,
  Lightning,
  Info,
  Sparkle,
  CaretDown,
  CaretRight,
  Clock,
  FileText,
  Scan,
  Code,
  Play,
  Stop,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DevToolsProps {
  language: Language
}

interface TestStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'success' | 'error'
  duration?: number
  details?: string
  error?: string
}

const texts = {
  fr: {
    title: 'DevTools — Pipeline OCR',
    subtitle: 'Testez le pipeline OCR complet : extraction, classification, champs structurés, multi-engines',
    fileSelect: 'Sélectionner un fichier (PDF)',
    dropzone: 'Glissez un fichier PDF ici ou cliquez pour sélectionner',
    dropzoneMax: 'Max 5 Mo — PDF uniquement',
    extracting: 'Extraction en cours...',
    startTest: 'Lancer le pipeline complet',
    stopTest: 'Arrêter',
    pipelineSuccess: 'Pipeline terminé avec succès',
    pipelineError: 'Erreur dans le pipeline',
    stage1: 'Extraction texte (pdf.js)',
    stage2: 'Classification du document',
    stage3: 'Extraction champ structurés',
    stage4: 'OCR multi-engines (si scan)',
    stage5: 'Prétraitement image',
    stage6: 'Détection tableaux',
    stage7: 'Extraction structurée finale',
    results: 'Résultats',
    rawText: 'Texte brut',
    structured: 'Données structurées',
    debug: 'Debug',
    testImage: "Test d'image",
    imageUrl: "URL d'image (optionnel)",
    copyAll: 'Tout copier',
    copied: 'Copié !',
    noFile: 'Aucun fichier sélectionné',
    summary: 'Résumé',
    type: 'Type',
    language: 'Langue',
    confidence: 'Confiance',
    time: 'Temps',
    chars: 'caractères',
    tablesFound: 'Tableaux détectés',
    noTables: 'Aucun tableau détecté',
    fieldExtraction: 'Extraction par champ',
    classificationDetails: 'Détails de classification',
    ocrEngines: 'Résultats par engine OCR',
    tableDetection: 'Détection de tableaux',
    useImage: "Utiliser l'image ci-dessous",
    runPreprocess: 'Prétraiter',
    runDeskew: 'Redresser',
    runOcr: 'OCR direct',
    imagePreview: "Aperçu de l'image",
    preprocessed: 'Prétraitée',
    original: 'Originale',
    processingTime1: 'Temps de traitement',
    download: 'Télécharger',
    textLength: 'Longueur du texte',
    fieldCount: 'Nombre de champs',
  },
  en: {
    title: 'DevTools — OCR Pipeline',
    subtitle: 'Test the complete OCR pipeline: extraction, classification, structured fields, multi-engine',
    fileSelect: 'Select a file (PDF)',
    dropzone: 'Drop a PDF file here or click to select',
    dropzoneMax: 'Max 5 MB — PDF only',
    extracting: 'Extracting...',
    startTest: 'Run complete pipeline',
    stopTest: 'Stop',
    pipelineSuccess: 'Pipeline completed successfully',
    pipelineError: 'Pipeline error',
    stage1: 'Text extraction (pdf.js)',
    stage2: 'Document classification',
    stage3: 'Structured field extraction',
    stage4: 'Multi-engine OCR (if scan)',
    stage5: 'Image preprocessing',
    stage6: 'Table detection',
    stage7: 'Final structured extraction',
    results: 'Results',
    rawText: 'Raw text',
    structured: 'Structured data',
    debug: 'Debug',
    testImage: 'Image test',
    imageUrl: 'Image URL (optional)',
    copyAll: 'Copy all',
    copied: 'Copied!',
    noFile: 'No file selected',
    summary: 'Summary',
    type: 'Type',
    language: 'Language',
    confidence: 'Confidence',
    time: 'Time',
    chars: 'characters',
    tablesFound: 'Tables detected',
    noTables: 'No tables detected',
    fieldExtraction: 'Field extraction',
    classificationDetails: 'Classification details',
    ocrEngines: 'Results by OCR engine',
    tableDetection: 'Table detection',
    useImage: 'Use image below',
    runPreprocess: 'Preprocess',
    runDeskew: 'Deskew',
    runOcr: 'Direct OCR',
    imagePreview: 'Image preview',
    preprocessed: 'Preprocessed',
    original: 'Original',
    processingTime1: 'Processing time',
    download: 'Download',
    textLength: 'Text length',
    fieldCount: 'Field count',
  },
}

export function DevTools({ language }: DevToolsProps) {
  const t = texts[language]
  const isFr = language === 'fr'

  const [file, setFile] = useState<File | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [steps, setSteps] = useState<TestStep[]>([])
  const [rawText, setRawText] = useState('')
  const [classification, setClassification] = useState<ClassificationResult | null>(null)
  const [fieldPairs, setFieldPairs] = useState<Array<{ key: string; value: string; confidence: number }>>([])
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [tableResult, setTableResult] = useState<TableDetectionResult | null>(null)
  const [totalTime, setTotalTime] = useState(0)
  const [activeResultTab, setActiveResultTab] = useState('structured')
  const [activeDebugTab, setActiveDebugTab] = useState('classification')

  // Image test state
  const [imageUrl, setImageUrl] = useState('')
  const [processedImage, setProcessedImage] = useState('')
  const [imageOcrText, setImageOcrText] = useState('')
  const [imageProcessing, setImageProcessing] = useState(false)

  const dropRef = useRef<HTMLDivElement>(null)

  const resetState = () => {
    setSteps([])
    setRawText('')
    setClassification(null)
    setFieldPairs([])
    setOcrResult(null)
    setTableResult(null)
    setTotalTime(0)
  }

  const addStep = useCallback((step: TestStep) => {
    setSteps(prev => [...prev, step])
  }, [])

  const updateStep = useCallback((id: string, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  const runPipeline = async () => {
    if (!file) return
    setIsRunning(true)
    resetState()
    const startTotal = performance.now()

    try {
      // Stage 1: Text extraction
      addStep({ id: 'extract', label: t.stage1, status: 'running' })
      const stage1Start = performance.now()
      let text = ''
      let fileType: 'pdf' | 'html' | 'docx' | 'image' | 'txt' = 'pdf'
      try {
        const result = await extractTextFromFile(file)
        text = result.text
        fileType = result.fileType
        updateStep('extract', { status: 'success', duration: Math.round(performance.now() - stage1Start), details: `${text.length} ${t.chars}` })
        setRawText(text)
      } catch (e) {
        updateStep('extract', { status: 'error', duration: Math.round(performance.now() - stage1Start), error: String(e) })
        setIsRunning(false)
        return
      }

      // Stage 2: Classification
      addStep({ id: 'classify', label: t.stage2, status: 'running' })
      const stage2Start = performance.now()
      try {
        const result = classifyDocument(text)
        updateStep('classify', { status: 'success', duration: Math.round(performance.now() - stage2Start), details: DOCUMENT_TYPE_LABELS[result.documentType] })
        setClassification(result)
      } catch (e) {
        updateStep('classify', { status: 'error', duration: Math.round(performance.now() - stage2Start), error: String(e) })
      }

      // Stage 3: Field extraction
      if (classification) {
        addStep({ id: 'fields', label: t.stage3, status: 'running' })
        const stage3Start = performance.now()
        try {
          const fieldsData = extractFields(text, classification.documentType)
          const pairs = fieldsToKeyValuePairs(fieldsData.fields)
          updateStep('fields', { status: 'success', duration: Math.round(performance.now() - stage3Start), details: `${pairs.length} ${t.fieldCount.toLowerCase()}` })
          setFieldPairs(pairs)
        } catch (e) {
          updateStep('fields', { status: 'error', duration: Math.round(performance.now() - stage3Start), error: String(e) })
        }
      }

      // Stage 4: Multi-engine OCR (for scanned PDFs - test with image conversion)
      addStep({ id: 'ocr', label: t.stage4, status: 'running' })
      const stage4Start = performance.now()
      try {
        // Convert PDF page to image for OCR testing
        const dataUrl = await fileToDataUrl(file)
        const result = await extractWithMultipleEngines(dataUrl, {
          engines: [1, 2],
          preprocess: true,
        })
        updateStep('ocr', { status: 'success', duration: Math.round(performance.now() - stage4Start), details: `Engine ${result.engineResults.find(r => r.confidence === Math.max(...result.engineResults.map(x => x.confidence)))?.engine || '?'} — ${result.text.length} ${t.chars}` })
        setOcrResult(result)
      } catch (e) {
        updateStep('ocr', { status: 'error', duration: Math.round(performance.now() - stage4Start), error: String(e) })
      }

      // Stage 5: Table detection
      addStep({ id: 'tables', label: t.stage6, status: 'running' })
      const stage5Start = performance.now()
      try {
        const sourceText = ocrResult?.text || text
        const result = extractTablesFromText(sourceText)
        updateStep('tables', { status: 'success', duration: Math.round(performance.now() - stage5Start), details: result.tables.length > 0 ? `${result.tables.length} ${t.tablesFound.toLowerCase()}` : t.noTables })
        setTableResult(result)
      } catch (e) {
        updateStep('tables', { status: 'error', duration: Math.round(performance.now() - stage5Start), error: String(e) })
      }

      // Stage 6: Structured extraction (final)
      addStep({ id: 'structured', label: t.stage7, status: 'running' })
      const stage6Start = performance.now()
      try {
        const result = await extractStructuredData(file)
        updateStep('structured', { status: 'success', duration: Math.round(performance.now() - stage6Start), details: `${DOCUMENT_TYPE_LABELS[result.documentType]} — ${result.overallConfidence}%` })
      } catch (e) {
        updateStep('structured', { status: 'error', duration: Math.round(performance.now() - stage6Start), error: String(e) })
      }

      setTotalTime(Math.round(performance.now() - startTotal))
    } catch (e) {
      setTotalTime(Math.round(performance.now() - startTotal))
    } finally {
      setIsRunning(false)
    }
  }

  // Image test handlers
  const handlePreprocess = async () => {
    if (!imageUrl) return
    setImageProcessing(true)
    setProcessedImage('')
    try {
      const result = await preprocessImage(imageUrl, {
        contrast: 1.3,
        grayscale: true,
        denoise: true,
        deskew: true,
        threshold: 140,
      })
      setProcessedImage(result)
    } catch (e) {
      console.error(e)
    } finally {
      setImageProcessing(false)
    }
  }

  const handleDirectOcr = async () => {
    if (!imageUrl) return
    setImageProcessing(true)
    setImageOcrText('')
    try {
      const result = await extractWithMultipleEngines(imageUrl, { engines: [1, 2], preprocess: true })
      setImageOcrText(result.text)
      setProcessedImage(result.text ? imageUrl : processedImage)
    } catch (e) {
      console.error(e)
    } finally {
      setImageProcessing(false)
    }
  }

  const handleCopyAll = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback
    }
  }

  const statusIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'running': return <Clock size={16} weight="duotone" className="animate-spin text-blue-500" />
      case 'success': return <CheckCircle size={16} weight="fill" className="text-emerald-500" />
      case 'error': return <XCircle size={16} weight="fill" className="text-destructive" />
      default: return <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Scan size={24} weight="duotone" className="text-primary" />
          <h1 className="text-2xl font-bold">{t.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      {/* ⚠️ Rappel config */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Warning size={20} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-600">
              {isFr ? 'Configuration dev local requise' : 'Dev configuration required'}
            </p>
            <p className="text-muted-foreground">
              {isFr
                ? 'En dev local, l\'OCR utilise le proxy Vite intégré (pas besoin de Netlify Dev). Vérifiez que OCR_SPACE_API_KEY est bien dans votre .env.'
                : 'In local dev, OCR uses the built-in Vite proxy (no need for Netlify Dev). Ensure OCR_SPACE_API_KEY is in your .env.'
              }
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Test controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* File input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FilePdf size={18} weight="duotone" />
                {isFr ? 'Document PDF' : 'PDF Document'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                ref={dropRef}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.html,.htm,.txt'
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) setFile(f)
                  }
                  input.click()
                }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) {
                    setFile(f)
                  }
                }}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FilePdf size={20} weight="fill" className="text-primary" />
                    <span className="font-medium truncate">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <>
                    <UploadSimple size={32} weight="duotone" className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{t.dropzone}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.dropzoneMax}</p>
                  </>
                )}
              </div>

              <Button
                onClick={runPipeline}
                disabled={!file || isRunning}
                className="w-full gap-2"
                variant="default"
              >
                {isRunning ? (
                  <>
                    <Clock size={16} weight="duotone" className="animate-spin" />
                    {t.extracting}
                  </>
                ) : (
                  <>
                    <Play size={16} weight="fill" />
                    {t.startTest}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Execution steps */}
          {steps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gear size={16} weight="duotone" />
                  {isFr ? 'Progression' : 'Progress'}
                  {totalTime > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {totalTime}ms
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm py-1 group">
                      {statusIcon(step.status)}
                      <span className={cn(
                        'flex-1',
                        step.status === 'error' && 'text-destructive',
                        step.status === 'pending' && 'text-muted-foreground'
                      )}>
                        {step.label}
                      </span>
                      {step.details && (
                        <span className="text-xs text-muted-foreground">{step.details}</span>
                      )}
                      {step.duration !== undefined && (
                        <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                      )}
                      {step.error && (
                        <div className="w-full text-xs text-destructive mt-0.5 pl-6">{step.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-4">
          {(rawText || fieldPairs.length > 0 || classification) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkle size={18} weight="duotone" className="text-primary" />
                    {t.results}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {totalTime > 0 && <span>{t.processingTime1}: {totalTime}ms</span>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
                  <div className="px-4 pt-2">
                    <TabsList>
                      <TabsTrigger value="structured" className="gap-1.5 text-xs">
                        <IdentificationBadge size={14} weight="duotone" />
                        {isFr ? 'Champs' : 'Fields'}
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="gap-1.5 text-xs">
                        <FileText size={14} weight="duotone" />
                        {isFr ? 'Texte brut' : 'Raw text'}
                      </TabsTrigger>
                      <TabsTrigger value="debug" className="gap-1.5 text-xs">
                        <Code size={14} weight="duotone" />
                        {t.debug}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="structured" className="p-4 pt-3">
                    {classification && (
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                        <Badge variant="secondary" className="gap-1.5">
                          <IdentificationBadge size={14} weight="duotone" />
                          {DOCUMENT_TYPE_LABELS[classification.documentType]}
                        </Badge>
                        <Badge variant="outline">
                          {isFr ? 'Langue' : 'Lang'}: {classification.language.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          {isFr ? 'Confiance' : 'Confidence'}: {Math.round(classification.confidence * 100)}%
                        </Badge>
                      </div>
                    )}

                    {fieldPairs.length > 0 ? (
                      <ScrollArea className="max-h-[500px]">
                        <div className="space-y-1.5">
                          {fieldPairs.map((pair, i) => (
                            <div
                              key={`${pair.key}-${i}`}
                              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 group transition-colors"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  'shrink-0 text-[10px]',
                                  pair.confidence >= 0.8 && 'border-emerald-500/50 text-emerald-600',
                                  pair.confidence >= 0.6 && pair.confidence < 0.8 && 'border-amber-500/50 text-amber-600',
                                  pair.confidence < 0.6 && 'border-orange-500/50 text-orange-600',
                                )}
                              >
                                {pair.key}
                              </Badge>
                              <span className="flex-1 text-sm min-w-0 break-words">{pair.value}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {Math.round(pair.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {isFr ? 'Aucune donnée structurée extraite' : 'No structured data extracted'}
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="raw" className="p-4 pt-3">
                    {rawText ? (
                      <ScrollArea className="max-h-[500px]">
                        <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/50 rounded-lg p-4">
                          {rawText}
                        </pre>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {isFr ? 'Aucun texte extrait' : 'No text extracted'}
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="debug" className="p-4 pt-3">
                    <Tabs value={activeDebugTab} onValueChange={setActiveDebugTab}>
                      <TabsList className="mb-3">
                        <TabsTrigger value="classification" className="text-xs">
                          {isFr ? 'Classification' : 'Classification'}
                        </TabsTrigger>
                        <TabsTrigger value="ocr" className="text-xs">
                          {isFr ? 'OCR Engines' : 'OCR Engines'}
                        </TabsTrigger>
                        <TabsTrigger value="tables" className="text-xs">
                          {isFr ? 'Tableaux' : 'Tables'}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="classification">
                        {classification ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {Object.entries(classification.typeScores).map(([type, score]) => (
                                <div key={type} className="flex justify-between items-center p-2 rounded bg-muted/50">
                                  <span className="text-muted-foreground">{DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS]}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress value={score * 100} className="w-16 h-1.5" />
                                    <span className="text-xs font-mono">{Math.round(score * 100)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 text-xs">
                              <p className="font-medium mb-1">{isFr ? 'Raisonnement' : 'Reasoning'}:</p>
                              <p className="text-muted-foreground">{classification.reasoning}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {isFr ? 'Pas de classification disponible' : 'No classification available'}
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="ocr">
                        {ocrResult ? (
                          <div className="space-y-3">
                            {ocrResult.engineResults.map((er) => (
                              <div key={er.engine} className="p-3 rounded-lg bg-muted/30 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">Engine {er.engine}</Badge>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{isFr ? 'Confiance' : 'Conf'}: {(er.confidence * 100).toFixed(0)}%</span>
                                    <span>{er.processingTimeMs}ms</span>
                                  </div>
                                </div>
                                {er.error ? (
                                  <p className="text-xs text-destructive">{er.error}</p>
                                ) : (
                                  <ScrollArea className="max-h-[120px]">
                                    <p className="text-xs font-mono whitespace-pre-wrap">{er.text.substring(0, 500)}...</p>
                                  </ScrollArea>
                                )}
                              </div>
                            ))}
                            {ocrResult.merged && (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle size={12} />
                                {isFr ? 'Fusionné' : 'Merged'}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {isFr ? 'Pas de résultats OCR' : 'No OCR results'}
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="tables">
                        {tableResult ? (
                          tableResult.tables.length > 0 ? (
                            <div className="space-y-4">
                              {tableResult.tables.map((table, idx) => (
                                <div key={idx} className="overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-muted/50">
                                        {table.headers.map((h, i) => (
                                          <th key={i} className="p-2 text-left font-medium">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {table.rows.map((row, ri) => (
                                        <tr key={ri} className="border-t border-border/50">
                                          {row.map((cell, ci) => (
                                            <td key={ci} className="p-2">{cell}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">{t.noTables}</p>
                          )
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {isFr ? 'Pas de détection de tableaux' : 'No table detection'}
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Image test section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageSquare size={18} weight="duotone" />
                {isFr ? "Test d'OCR sur image" : 'Image OCR test'}
              </CardTitle>
              <CardDescription className="text-xs">
                {isFr
                  ? 'Collez une data URL ou sélectionnez une image pour tester le prétraitement et l\'OCR'
                  : 'Paste a data URL or select an image to test preprocessing and OCR'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={t.imageUrl}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-3 py-1.5"
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="image-test-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        setImageUrl(ev.target?.result as string)
                      }
                      reader.readAsDataURL(f)
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('image-test-input')?.click()}>
                  <UploadSimple size={14} />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handlePreprocess} disabled={!imageUrl || imageProcessing} size="sm" variant="outline" className="gap-1.5 flex-1">
                  <Gear size={14} />
                  {t.runPreprocess}
                </Button>
                <Button onClick={handleDirectOcr} disabled={!imageUrl || imageProcessing} size="sm" className="gap-1.5 flex-1">
                  <Scan size={14} />
                  {t.runOcr}
                </Button>
              </div>

              {(imageUrl || processedImage) && (
                <div className="space-y-2">
                  {processedImage && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 text-center">{t.original}</p>
                        <img src={imageUrl} alt="Original" className="w-full rounded-lg border border-border" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 text-center">{t.preprocessed}</p>
                        <img src={processedImage} alt="Preprocessed" className="w-full rounded-lg border border-border" />
                      </div>
                    </div>
                  )}

                  {imageOcrText && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        {isFr ? 'Texte OCR extrait' : 'OCR extracted text'} ({imageOcrText.length} {t.chars})
                      </p>
                      <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono max-h-[150px] overflow-auto whitespace-pre-wrap">
                        {imageOcrText}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
