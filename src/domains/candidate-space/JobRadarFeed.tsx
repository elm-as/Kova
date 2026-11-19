import React, { useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import type { JobMarket, JobOffer, SourceHealth } from '../job-radar/job-radar-types';
import type { CandidateProfile, ApplicationStage } from './candidate-profile-types';
import { scoreOfferForProfile, type MatchVerdict, type OfferMatchAnalysis } from '../matching/offer-matcher';

interface JobRadarFeedProps {
  offers: JobOffer[];
  sources: SourceHealth[];
  loading: boolean;
  error: string | null;
  market: 'all' | JobMarket;
  profile: CandidateProfile;
  trackedStages: Map<string, ApplicationStage>;
  onMarketChange: (next: 'all' | JobMarket) => void;
  onRefresh: (query?: string) => void;
  onSelectOffer: (analysis: OfferMatchAnalysis) => void;
}

const MARKET_TABS: Array<{ id: 'all' | JobMarket; label: string }> = [
  { id: 'all', label: 'Tous les marchés' },
  { id: 'ci_africa', label: "Côte d'Ivoire & Afrique" },
  { id: 'tech_remote', label: 'Tech & Remote mondial' },
];

const VERDICT_FILTERS: Array<{ id: 'all' | MatchVerdict; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'apply_now', label: 'Postuler maintenant' },
  { id: 'apply_with_tweaks', label: 'Avec ajustements' },
];

/**
 * Live multi-source job radar ranked against the candidate's profile with transparent match scores
 * and immediate "what to highlight" guidance per offer.
 */
export default function JobRadarFeed({
  offers,
  sources,
  loading,
  error,
  market,
  profile,
  trackedStages,
  onMarketChange,
  onRefresh,
  onSelectOffer,
}: JobRadarFeedProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'all' | MatchVerdict>('all');

  const rankedAnalyses = useMemo(() => {
    const scored = offers.map((offer) => scoreOfferForProfile(offer, profile));
    return scored.sort((a, b) => b.score - a.score);
  }, [offers, profile]);

  const filteredAnalyses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rankedAnalyses.filter((item) => {
      if (verdictFilter !== 'all' && item.verdict !== verdictFilter) return false;
      if (!q) return true;
      const hay = `${item.offer.title} ${item.offer.company} ${item.offer.location} ${item.offer.skills.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rankedAnalyses, searchTerm, verdictFilter]);

  const applyNowCount = rankedAnalyses.filter((a) => a.verdict === 'apply_now').length;
  const tweaksCount = rankedAnalyses.filter((a) => a.verdict === 'apply_with_tweaks').length;
  const activeSourcesCount = sources.filter((s) => s.status === 'ok').length;

  return (
    <div className="space-y-6">
      {/* KPI Telemetry Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#0F1419]/12 border border-[#0F1419]/12">
        <div className="bg-[#FFFFFF] p-5">
          <span className="font-mono text-[11px] text-[#525866] block">Offres analysées</span>
          <span className="font-mono text-2xl font-semibold text-[#0F1419] tabular-nums mt-1 block">
            {rankedAnalyses.length}
          </span>
        </div>
        <div className="bg-[#FFFFFF] p-5">
          <span className="font-mono text-[11px] text-[#0F5132] block">Postuler maintenant (≥ 72%)</span>
          <span className="font-mono text-2xl font-semibold text-[#0F5132] tabular-nums mt-1 block">
            {applyNowCount}
          </span>
        </div>
        <div className="bg-[#FFFFFF] p-5">
          <span className="font-mono text-[11px] text-[#92400E] block">Avec ajustements (50–71%)</span>
          <span className="font-mono text-2xl font-semibold text-[#92400E] tabular-nums mt-1 block">
            {tweaksCount}
          </span>
        </div>
        <div className="bg-[#FFFFFF] p-5">
          <span className="font-mono text-[11px] text-[#525866] block">Sources actives en direct</span>
          <span className="font-mono text-2xl font-semibold text-[#0F1419] tabular-nums mt-1 block">
            {activeSourcesCount} / {sources.length || 5}
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="p-4 sm:p-5 bg-[#FFFFFF] border border-[#0F1419]/12 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par marché">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={market === tab.id}
                onClick={() => onMarketChange(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                  market === tab.id
                    ? 'bg-[#0F1419] text-[#F6F5F0] border-[#0F1419]'
                    : 'bg-[#F6F5F0] text-[#525866] border-[#0F1419]/12 hover:text-[#0F1419]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#7B8190] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer poste, ville, stack..."
                aria-label="Filtrer les offres"
                className="w-full pl-9 pr-3 py-2 bg-[#F6F5F0] border border-[#0F1419]/15 text-xs text-[#0F1419] placeholder:text-[#7B8190] focus:bg-[#FFFFFF] focus:border-[#0F1419] focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => onRefresh(searchTerm)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#0F1419]/20 bg-[#FFFFFF] text-xs font-semibold text-[#0F1419] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#0F1419]/10">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7B8190]" aria-hidden="true" />
            {VERDICT_FILTERS.map((vf) => (
              <button
                key={vf.id}
                type="button"
                onClick={() => setVerdictFilter(vf.id)}
                className={`px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                  verdictFilter === vf.id
                    ? 'bg-[#0F1419] text-[#F6F5F0] border-[#0F1419]'
                    : 'bg-[#FFFFFF] text-[#525866] border-[#0F1419]/12 hover:text-[#0F1419]'
                }`}
              >
                {vf.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#525866]">
            {sources.map((src) => (
              <span
                key={src.source}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#F6F5F0] border border-[#0F1419]/10 tabular-nums"
                title={src.error || `${src.latencyMs} ms`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${src.status === 'ok' ? 'bg-[#0F5132]' : 'bg-[#B45309]'}`}
                />
                <span>{src.label}</span>
                <span className="text-[#0F1419] font-medium">{src.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs font-mono text-red-700">
          {error}
        </div>
      )}

      {loading && offers.length === 0 ? (
        <div className="p-12 bg-[#FFFFFF] border border-[#0F1419]/12 text-center space-y-2">
          <p className="font-editorial text-2xl text-[#0F1419]">Collecte des offres en direct…</p>
          <p className="font-mono text-xs text-[#525866]">
            Interrogation d&apos;Emploi.ci, Educarriere.ci, Remotive, Arbeitnow et Jobicy.
          </p>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="p-12 bg-[#FFFFFF] border border-[#0F1419]/12 text-center space-y-2">
          <p className="font-editorial text-2xl text-[#0F1419]">Aucune offre pour ce filtre</p>
          <p className="text-xs text-[#525866]">
            Essayez d&apos;élargir le filtre de verdict ou d&apos;actualiser le radar.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#0F1419]/10 border border-[#0F1419]/12 bg-[#FFFFFF]">
          {filteredAnalyses.map((analysis) => {
            const { offer } = analysis;
            const stage = trackedStages.get(offer.id);
            const scoreStyle =
              analysis.verdict === 'apply_now'
                ? 'bg-[#ECFDF3] text-[#0F5132] border-[#0F5132]/25'
                : analysis.verdict === 'apply_with_tweaks'
                  ? 'bg-[#FFFBEB] text-[#92400E] border-[#92400E]/25'
                  : 'bg-[#F1F5F9] text-[#475569] border-[#475569]/20';

            return (
              <article
                key={offer.id}
                className="p-5 sm:p-6 hover:bg-[#F6F5F0]/65 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
              >
                <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-start justify-between gap-2">
                  <div className={`px-3 py-1.5 border font-mono text-lg font-semibold tabular-nums ${scoreStyle}`}>
                    {analysis.score}%
                  </div>
                  <span className="font-mono text-[11px] text-[#525866]">{analysis.verdictLabel}</span>
                </div>

                <div className="lg:col-span-7 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#525866]">
                    <span className="font-semibold text-[#0F1419]">{offer.sourceLabel}</span>
                    <span>·</span>
                    <span>{offer.company}</span>
                    <span>·</span>
                    <span>{offer.location}</span>
                    <span>·</span>
                    <span>{offer.contractType}</span>
                    {stage && (
                      <span className="px-1.5 py-0.5 bg-[#0F1419] text-[#F6F5F0] text-[10px]">
                        {stage}
                      </span>
                    )}
                  </div>

                  <h3 className="font-editorial text-2xl text-[#0F1419] leading-snug">
                    {offer.title}
                  </h3>

                  {analysis.highlightsToEmphasize[0] && (
                    <p className="text-xs text-[#0F5132] bg-[#ECFDF3]/70 border-l-2 border-[#0F5132] pl-2.5 py-1">
                      <strong className="font-semibold">À mettre en avant :</strong>{' '}
                      {analysis.highlightsToEmphasize[0]}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {analysis.matchedSkills.slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-[#ECFDF3] border border-[#0F5132]/20 font-mono text-[10px] text-[#0F5132]"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                    {analysis.missingSkills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-[#F6F5F0] border border-[#0F1419]/12 font-mono text-[10px] text-[#525866]"
                      >
                        + {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-3 flex lg:flex-col items-stretch justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectOffer(analysis)}
                    className="px-4 py-2.5 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] transition-colors cursor-pointer text-center"
                  >
                    Plan d&apos;attaque &amp; Coach
                  </button>
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#0F1419]/18 bg-[#FFFFFF] text-xs font-medium text-[#0F1419] hover:bg-[#F6F5F0] transition-colors"
                  >
                    <span>Voir l&apos;offre</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
