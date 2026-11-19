import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookmarkCheck, Check, Copy, Sparkles, X } from 'lucide-react';
import type { CandidateProfile, ApplicationStage } from './candidate-profile-types';
import type { OfferMatchAnalysis } from '../matching/offer-matcher';
import { generateApplicationCoachPlan, type AiApplicationCoachPlan } from '../matching/ai-coach-service';

interface OfferCoachModalProps {
  analysis: OfferMatchAnalysis | null;
  profile: CandidateProfile;
  trackedStage: ApplicationStage | null;
  onTrack: (analysis: OfferMatchAnalysis, stage: ApplicationStage) => void;
  onClose: () => void;
}

const BREAKDOWN_LABELS: Array<{ key: keyof OfferMatchAnalysis['breakdown']; label: string }> = [
  { key: 'skills', label: 'Compétences' },
  { key: 'roleAlignment', label: 'Alignement poste' },
  { key: 'seniority', label: 'Séniorité' },
  { key: 'locationAndMode', label: 'Lieu & Mode' },
  { key: 'language', label: 'Langue' },
];

/**
 * Native top-layer <dialog> displaying transparent match breakdown, what to emphasize on the CV,
 * honest gaps, and an on-demand AI application coach (pitch + CV adjustments + interview questions).
 */
export default function OfferCoachModal({
  analysis,
  profile,
  trackedStage,
  onTrack,
  onClose,
}: OfferCoachModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [coachPlan, setCoachPlan] = useState<AiApplicationCoachPlan | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    setCoachPlan(null);
    setCopiedPitch(false);

    if (analysis && !dialog.open) {
      dialog.showModal();
    } else if (!analysis && dialog.open) {
      dialog.close();
    }
  }, [analysis]);

  const handleGenerateCoach = async () => {
    if (!analysis || loadingCoach) return;
    setLoadingCoach(true);
    const plan = await generateApplicationCoachPlan(analysis, profile);
    setCoachPlan(plan);
    setLoadingCoach(false);
  };

  const handleCopyPitch = async () => {
    if (!coachPlan) return;
    try {
      await navigator.clipboard.writeText(coachPlan.pitch);
      setCopiedPitch(true);
      window.setTimeout(() => setCopiedPitch(false), 2000);
    } catch {
      setCopiedPitch(false);
    }
  };

  const verdictBadgeClass =
    analysis?.verdict === 'apply_now'
      ? 'bg-[#ECFDF3] text-[#0F5132] border-[#0F5132]/25'
      : analysis?.verdict === 'apply_with_tweaks'
        ? 'bg-[#FFFBEB] text-[#92400E] border-[#92400E]/25'
        : 'bg-[#F1F5F9] text-[#475569] border-[#475569]/20';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="offer-coach-title"
      {...({ closedby: 'any' } as Record<string, string>)}
      onClose={onClose}
      onClick={(e) => {
        const dialog = dialogRef.current;
        if (!dialog || e.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!inside) dialog.close();
      }}
      className="kova-dialog m-auto w-[min(94vw,840px)] max-h-[90dvh] overflow-y-auto bg-[#FFFFFF] border border-[#0F1419]/15 p-0 text-[#0F1419] shadow-2xl"
    >
      {analysis && (
        <>
          <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#0F1419]/12 px-6 sm:px-8 py-5 flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#525866]">
                <span>{analysis.offer.sourceLabel}</span>
                <span>·</span>
                <span>{analysis.offer.company}</span>
                <span>·</span>
                <span>{analysis.offer.location}</span>
              </div>
              <h3 id="offer-coach-title" className="font-editorial text-2xl sm:text-3xl leading-tight">
                {analysis.offer.title}
              </h3>
            </div>

            <form method="dialog">
              <button
                type="submit"
                autoFocus
                aria-label="Fermer le plan de candidature"
                className="p-2 border border-[#0F1419]/15 bg-[#F6F5F0] text-[#525866] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Score + Verdict Header */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-5 bg-[#F6F5F0] border border-[#0F1419]/10">
              <div className="md:col-span-4 space-y-2">
                <span className="font-mono text-[11px] text-[#525866] block">Compatibilité estimée</span>
                <div className="font-mono text-4xl font-semibold text-[#0F1419] tabular-nums">
                  {analysis.score}%
                </div>
                <span className={`inline-block px-2.5 py-1 border font-mono text-[11px] font-medium ${verdictBadgeClass}`}>
                  {analysis.verdictLabel}
                </span>
              </div>

              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {BREAKDOWN_LABELS.map(({ key, label }) => {
                  const val = analysis.breakdown[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#525866]">{label}</span>
                        <span className="font-mono font-medium tabular-nums text-[#0F1419]">{val}%</span>
                      </div>
                      <div className="h-1.5 bg-[#0F1419]/10 w-full">
                        <div className="h-full bg-[#0F1419]" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What to Highlight vs Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="p-5 border border-[#0F5132]/20 bg-[#ECFDF3]/40 space-y-3">
                <h4 className="font-mono text-xs font-semibold text-[#0F5132] uppercase tracking-wider">
                  Ce que vous devez mettre en avant
                </h4>
                <ul className="space-y-2 text-xs text-[#1E242B] leading-relaxed">
                  {analysis.highlightsToEmphasize.map((item, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="font-mono text-[#0F5132]">0{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {analysis.matchedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {analysis.matchedSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-[#FFFFFF] border border-[#0F5132]/25 font-mono text-[11px] text-[#0F5132]"
                      >
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="p-5 border border-[#92400E]/20 bg-[#FFFBEB]/45 space-y-3">
                <h4 className="font-mono text-xs font-semibold text-[#92400E] uppercase tracking-wider">
                  Points à renforcer / Écarts
                </h4>
                <ul className="space-y-2 text-xs text-[#1E242B] leading-relaxed">
                  {analysis.gapAdvice.length > 0 ? (
                    analysis.gapAdvice.map((item, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-mono text-[#92400E]">•</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <li>Aucun écart critique détecté sur les critères affichés de cette offre.</li>
                  )}
                </ul>
                {analysis.missingSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {analysis.missingSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-[#FFFFFF] border border-[#92400E]/25 font-mono text-[11px] text-[#92400E]"
                      >
                        + {s}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h4 className="font-mono text-[11px] text-[#525866] uppercase tracking-wider">
                Extrait de l&apos;annonce ({analysis.offer.contractType} · {analysis.offer.experienceLevel})
              </h4>
              <p className="text-sm text-[#374151] leading-relaxed">{analysis.offer.summary}</p>
            </div>

            {/* Stage 2 — On-demand AI Coach */}
            <div className="p-6 border border-[#0F1419]/15 bg-[#F6F5F0] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-editorial text-2xl text-[#0F1419]">
                    Kit de candidature sur mesure
                  </h4>
                  <p className="text-xs text-[#525866]">
                    Générez un message d&apos;accroche ciblé et 3 questions probables d&apos;entretien.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingCoach}
                  onClick={handleGenerateCoach}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{loadingCoach ? 'Préparation...' : coachPlan ? 'Régénérer le kit' : 'Générer mon pitch & questions'}</span>
                </button>
              </div>

              {coachPlan && (
                <div className="space-y-4 pt-3 border-t border-[#0F1419]/10">
                  <div className="p-4 bg-[#FFFFFF] border border-[#0F1419]/12 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[#525866]">
                        Message d&apos;accroche ({coachPlan.source === 'llm' ? 'Coach IA' : 'Synthèse Kova'})
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPitch}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#0F1419] hover:underline cursor-pointer"
                      >
                        {copiedPitch ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPitch ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                    <p className="text-sm text-[#0F1419] leading-relaxed">{coachPlan.pitch}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="font-mono text-[11px] text-[#525866] block">
                      Questions probables en entretien
                    </span>
                    <ol className="space-y-1.5 text-xs text-[#1E242B]">
                      {coachPlan.interviewQuestions.map((q, idx) => (
                        <li key={idx} className="p-3 bg-[#FFFFFF] border border-[#0F1419]/10">
                          <span className="font-mono text-[#525866] mr-2">Q{idx + 1}.</span>
                          {q}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#0F1419]/12">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTrack(analysis, trackedStage === 'applied' ? 'applied' : 'saved')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0F1419]/20 bg-[#FFFFFF] text-xs font-semibold text-[#0F1419] hover:bg-[#F6F5F0] cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{trackedStage ? `Suivi : ${trackedStage}` : 'Enregistrer dans mon suivi'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTrack(analysis, 'applied')}
                  className="px-4 py-2.5 border border-[#0F5132]/30 bg-[#ECFDF3] text-[#0F5132] text-xs font-semibold hover:bg-[#0F5132] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  Marquer comme postulé
                </button>
              </div>

              <a
                href={analysis.offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] transition-colors"
              >
                <span>Postuler sur {analysis.offer.sourceLabel}</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
