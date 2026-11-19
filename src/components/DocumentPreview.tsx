/**
 * DocumentPreview.tsx - Aperçu de document avec données extraites
 *
 * Affiche :
 *  - Badge du type de document détecté
 *  - Vue par onglets : Texte brut / Données structurées / Champs
 *  - Indicateurs visuels de confiance par champ
 *  - Copie dans le presse-papier des champs extraits
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type ClassificationResult,
} from '@/lib/documentClassifier';
import type { ExtractionResult, ExtractedFields } from '@/lib/fieldExtractor';
import { extractFieldPairs } from '@/lib/fileUtils';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DocumentPreviewProps {
  documentType: DocumentType;
  classification: ClassificationResult;
  extraction: ExtractionResult;
  rawText: string;
  overallConfidence: number;
  className?: string;
}

// ─── Icônes inline (évite les dépendances supplémentaires) ──────────────────

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

// ─── Types d'onglets ─────────────────────────────────────────────────────────

type TabId = 'raw' | 'structured' | 'fields';

// ─── Formatteurs ─────────────────────────────────────────────────────────────

function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return `${pct}%`;
  if (pct >= 50) return `${pct}%`;
  return `${pct}%`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-400';
  if (confidence >= 0.6) return 'text-amber-400';
  if (confidence >= 0.4) return 'text-orange-400';
  return 'text-red-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-emerald-400/20';
  if (confidence >= 0.6) return 'bg-amber-400/20';
  if (confidence >= 0.4) return 'bg-orange-400/20';
  return 'bg-red-400/20';
}

function getDocumentTypeBadgeColor(docType: DocumentType): string {
  const map: Record<DocumentType, string> = {
    cv: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    cover_letter: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    diploma: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    certificate: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    academic_transcript: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    id_document: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    other: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return map[docType] || map.other;
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-emerald-400';
  if (confidence >= 0.6) return 'bg-amber-400';
  if (confidence >= 0.4) return 'bg-orange-400';
  return 'bg-red-400';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'Haute';
  if (confidence >= 0.6) return 'Moyenne';
  if (confidence >= 0.4) return 'Faible';
  return 'Très faible';
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function DocumentPreview({
  documentType,
  classification,
  extraction,
  rawText,
  overallConfidence,
  className,
}: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('fields');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fieldPairs = extractFieldPairs(extraction.fields);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback pour environnements sans clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  const handleCopyAll = useCallback(async () => {
    const allText = fieldPairs
      .map((p) => `${p.key}: ${p.value}`)
      .join('\n');
    await handleCopy(allText, 'all');
  }, [fieldPairs, handleCopy]);

  return (
    <div className={cn('flex flex-col rounded-lg border border-neutral-6 bg-bg overflow-hidden', className)}>
      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-6">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium', getDocumentTypeBadgeColor(documentType))}>
            <FileIcon className="w-4 h-4" />
            {DOCUMENT_TYPE_LABELS[documentType]}
          </div>

          <div className="flex items-center gap-2">
            <div className={cn('text-xs font-medium px-2 py-0.5 rounded-full', getConfidenceBg(overallConfidence), getConfidenceColor(overallConfidence))}>
              Confiance globale : {formatConfidence(overallConfidence)}
            </div>

            <span className="text-xs text-fg-secondary">
              Langue : {classification.language === 'fr' ? 'Francais' : classification.language === 'en' ? 'Anglais' : classification.language === 'es' ? 'Espagnol' : 'Inconnue'}
            </span>

            <span className="text-xs text-fg-secondary">
              Traitement : {extraction.processingTimeMs}ms
            </span>
          </div>
        </div>

        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-6 hover:bg-neutral-5 transition-colors text-fg-secondary hover:text-fg"
        >
          {copiedField === 'all' ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
              Copie !
            </>
          ) : (
            <>
              <CopyIcon className="w-3.5 h-3.5" />
              Tout copier
            </>
          )}
        </button>
      </div>

      {/* ─── Barre d'onglets ─────────────────────────────────── */}
      <div className="flex border-b border-neutral-6">
        {[
          { id: 'fields' as TabId, label: 'Champs extraits', icon: ListIcon },
          { id: 'structured' as TabId, label: 'Donnees structurees', icon: TableIcon },
          { id: 'raw' as TabId, label: 'Texte brut', icon: FileIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-accent-9 text-fg'
                : 'border-transparent text-fg-secondary hover:text-fg hover:bg-neutral-4/50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Contenu ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto max-h-[60vh]">
        {/* Onglet : Champs extraits */}
        {activeTab === 'fields' && (
          <div className="p-4 space-y-3">
            {fieldPairs.length === 0 ? (
              <div className="text-center py-12 text-fg-secondary">
                <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucun champ extrait pour ce type de document.</p>
              </div>
            ) : (
              fieldPairs.map((pair) => (
                <div
                  key={pair.key}
                  className="group flex flex-col gap-1.5 p-3 rounded-lg border border-neutral-6 hover:border-neutral-5 transition-colors bg-bg-inset/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-accent-9 uppercase tracking-wider shrink-0">
                        {pair.key.replace(/\./g, ' > ')}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                          getConfidenceBg(pair.confidence),
                          getConfidenceColor(pair.confidence)
                        )}
                        title={`Niveau de confiance : ${getConfidenceLabel(pair.confidence)}`}
                      >
                        {formatConfidence(pair.confidence)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(pair.value, pair.key)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-neutral-5 transition-all text-fg-secondary hover:text-fg shrink-0"
                    >
                      {copiedField === pair.key ? (
                        <CheckIcon className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <CopyIcon className="w-3 h-3" />
                      )}
                      {copiedField === pair.key ? 'Copie !' : 'Copier'}
                    </button>
                  </div>

                  {/* Barre de confiance visuelle */}
                  <div className="w-full h-1.5 bg-neutral-6 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', getConfidenceBarColor(pair.confidence))}
                      style={{ width: `${Math.round(pair.confidence * 100)}%` }}
                    />
                  </div>

                  <div className="text-sm text-fg mt-1 break-words font-mono text-xs bg-neutral-3/50 rounded p-2 max-h-32 overflow-y-auto">
                    {pair.value || <span className="text-fg-secondary italic">Non detecte</span>}
                  </div>
                </div>
              ))
            )}

            {/* Légende des confiances */}
            <div className="flex items-center gap-4 pt-2 text-xs text-fg-secondary border-t border-neutral-6 mt-4">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Haute (&ge;80%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Moyenne (60-79%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Faible (40-59%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Tres faible (&lt;40%)
              </span>
            </div>
          </div>
        )}

        {/* Onglet : Donnees structurees (JSON) */}
        {activeTab === 'structured' && (
          <div className="p-4">
            <div className="rounded-lg bg-neutral-3/40 p-4 overflow-auto">
              <pre className="text-xs text-fg-secondary font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(
                  {
                    type: extraction.documentType,
                    label: DOCUMENT_TYPE_LABELS[extraction.documentType],
                    confiance: {
                      globale: formatConfidence(extraction.overallConfidence),
                      classification: formatConfidence(classification.confidence),
                    },
                    langue: classification.language,
                    raisonnement: classification.reasoning,
                    champs: fieldPairs.map((p) => ({
                      nom: p.key,
                      valeur: p.value,
                      confiance: formatConfidence(p.confidence),
                    })),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}

        {/* Onglet : Texte brut */}
        {activeTab === 'raw' && (
          <div className="p-4">
            <div className="rounded-lg bg-neutral-3/40 p-4 max-h-[50vh] overflow-y-auto">
              <pre className="text-sm text-fg-secondary whitespace-pre-wrap font-sans leading-relaxed">
                {rawText || <span className="italic">Aucun texte extrait.</span>}
              </pre>
            </div>
            <div className="mt-2 text-xs text-fg-secondary">
              {rawText.length.toLocaleString()} caracteres
              {' | '}
              {rawText.split(/\s+/).length.toLocaleString()} mots
            </div>
          </div>
        )}
      </div>

      {/* ─── Pied de page ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-neutral-6 text-xs text-fg-secondary">
        <div className="flex items-center gap-4">
          <span>
            Classification : <span className="text-fg font-medium">{DOCUMENT_TYPE_LABELS[documentType]}</span>
          </span>
          <span>
            Confiance classification : <span className={cn('font-medium', getConfidenceColor(classification.confidence))}>{formatConfidence(classification.confidence)}</span>
          </span>
        </div>
        <span>
          {fieldPairs.length} champ(s) extrait(s)
        </span>
      </div>
    </div>
  );
}

/**
 * Version simplifiee pour usage rapide : juste l'indicateur de type de document.
 */
export function DocumentTypeBadge({
  documentType,
  confidence,
  className,
}: {
  documentType: DocumentType;
  confidence: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('px-3 py-1 rounded-full text-xs font-medium border', getDocumentTypeBadgeColor(documentType))}>
        {DOCUMENT_TYPE_LABELS[documentType]}
      </span>
      <span className={cn('text-xs font-medium', getConfidenceColor(confidence))}>
        {formatConfidence(confidence)}
      </span>
    </div>
  );
}

export default DocumentPreview;
