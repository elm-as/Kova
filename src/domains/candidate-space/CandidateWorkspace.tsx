import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Compass, FileUser, ListChecks } from 'lucide-react';
import { fetchJobRadarOffers } from '../job-radar/job-radar-service';
import type { JobMarket, JobOffer, SourceHealth } from '../job-radar/job-radar-types';
import type { ApplicationStage, CandidateProfile, TrackedApplication } from './candidate-profile-types';
import {
  loadCandidateProfile,
  loadTrackedApplications,
  saveCandidateProfile,
  saveTrackedApplications,
  updateApplicationStage,
  upsertTrackedApplication,
} from './candidate-profile-storage';
import type { OfferMatchAnalysis } from '../matching/offer-matcher';
import CandidateProfilePanel from './CandidateProfilePanel';
import JobRadarFeed from './JobRadarFeed';
import OfferCoachModal from './OfferCoachModal';
import ApplicationTrackerView from './ApplicationTrackerView';

interface CandidateWorkspaceProps {
  onSwitchToRecruiter: () => void;
}

type CandidateTab = 'radar' | 'profile' | 'tracker';

/**
 * Kova Individual Workspace: live multi-source job radar (Ivory Coast/Africa + Tech Remote),
 * CV-powered profile calibration, deterministic + AI application coach, and personal tracker.
 */
export default function CandidateWorkspace({ onSwitchToRecruiter }: CandidateWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<CandidateTab>('radar');
  const [profile, setProfile] = useState<CandidateProfile>(() => loadCandidateProfile());
  const [applications, setApplications] = useState<TrackedApplication[]>(() => loadTrackedApplications());
  const [market, setMarket] = useState<'all' | JobMarket>('all');
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<OfferMatchAnalysis | null>(null);

  const loadRadar = useCallback(
    async (targetMarket: 'all' | JobMarket, query?: string, refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchJobRadarOffers({ market: targetMarket, query, refresh });
        setOffers(res.offers);
        setSources(res.sources);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des offres.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadRadar(market);
  }, [market, loadRadar]);

  const trackedStages = useMemo(() => {
    const map = new Map<string, ApplicationStage>();
    for (const app of applications) map.set(app.offerId, app.stage);
    return map;
  }, [applications]);

  const handleSaveProfile = (next: CandidateProfile) => {
    const saved = saveCandidateProfile(next);
    setProfile(saved);
  };

  const handleTrackOffer = (analysis: OfferMatchAnalysis, stage: ApplicationStage) => {
    const next = upsertTrackedApplication(applications, {
      offerId: analysis.offer.id,
      offerTitle: analysis.offer.title,
      company: analysis.offer.company,
      sourceLabel: analysis.offer.sourceLabel,
      offerUrl: analysis.offer.url,
      location: analysis.offer.location,
      matchScore: analysis.score,
      stage,
      notes: '',
    });
    setApplications(next);
    saveTrackedApplications(next);
  };

  const handleStageChange = (offerId: string, stage: ApplicationStage) => {
    const next = updateApplicationStage(applications, offerId, stage);
    setApplications(next);
    saveTrackedApplications(next);
  };

  const handleRemoveTracked = (offerId: string) => {
    const next = applications.filter((a) => a.offerId !== offerId);
    setApplications(next);
    saveTrackedApplications(next);
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#0F1419] flex flex-col">
      {/* Architectural Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F6F5F0]/92 backdrop-blur-md border-b border-[#0F1419]/12">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 shrink-0 bg-[#0F1419] text-[#F6F5F0] font-mono text-sm font-semibold flex items-center justify-center">
              K
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-sm tracking-tight text-[#0F1419] block leading-none">
                Kova
              </span>
              <span className="hidden sm:block font-mono text-[10px] text-[#525866] truncate mt-0.5">
                Radar d&apos;offres &amp; Coach Candidat
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation Espace Particulier">
            {[
              { id: 'radar' as const, label: "Radar d'offres", icon: Compass },
              { id: 'profile' as const, label: 'Mon Profil & CV', icon: FileUser },
              { id: 'tracker' as const, label: `Candidatures (${applications.length})`, icon: ListChecks },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  activeTab === id
                    ? 'text-[#0F1419] border-[#0F1419]'
                    : 'text-[#525866] border-transparent hover:text-[#0F1419]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={onSwitchToRecruiter}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#0F1419]/20 bg-[#FFFFFF] text-xs font-semibold text-[#0F1419] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Espace Recruteur (ATS)</span>
          </button>
        </div>

        {/* Mobile Tab Strip */}
        <div className="md:hidden border-t border-[#0F1419]/10 px-4 py-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          {[
            { id: 'radar' as const, label: 'Radar' },
            { id: 'profile' as const, label: 'Profil & CV' },
            { id: 'tracker' as const, label: `Suivi (${applications.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap border ${
                activeTab === tab.id
                  ? 'bg-[#0F1419] text-[#F6F5F0] border-[#0F1419]'
                  : 'bg-[#FFFFFF] text-[#525866] border-[#0F1419]/12'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#0F1419]/12 pb-6">
          <div>
            <p className="font-mono text-[11px] text-[#525866]">
              Profil actif :{' '}
              {profile.fullName ? (
                <>
                  <strong className="text-[#0F1419]">{profile.fullName}</strong> ·{' '}
                </>
              ) : null}
              <strong className="text-[#0F1419]">{profile.headline}</strong> · {profile.location} ·{' '}
              {profile.skills.length} compétences
            </p>
            <h1
              className="font-editorial text-[#0F1419] leading-[0.95] mt-2"
              style={{ fontSize: 'clamp(2.2rem, 4.4vw, 3.8rem)' }}
            >
              {activeTab === 'radar' && (
                <>
                  Les offres où vous avez <em className="italic text-[#0F1419]/65">vraiment vos chances.</em>
                </>
              )}
              {activeTab === 'profile' && (
                <>
                  Calibrez votre <em className="italic text-[#0F1419]/65">profil candidat.</em>
                </>
              )}
              {activeTab === 'tracker' && (
                <>
                  Suivi de vos <em className="italic text-[#0F1419]/65">candidatures.</em>
                </>
              )}
            </h1>
          </div>

          {activeTab === 'radar' && (
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="self-start lg:self-end px-4 py-2 border border-[#0F1419]/18 bg-[#FFFFFF] text-xs font-semibold text-[#0F1419] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer"
            >
              Importer mon CV / Ajuster mon profil
            </button>
          )}
        </div>

        {activeTab === 'radar' && (
          <JobRadarFeed
            offers={offers}
            sources={sources}
            loading={loading}
            error={error}
            market={market}
            profile={profile}
            trackedStages={trackedStages}
            onMarketChange={setMarket}
            onRefresh={(q) => void loadRadar(market, q, true)}
            onSelectOffer={setSelectedAnalysis}
          />
        )}

        {activeTab === 'profile' && (
          <CandidateProfilePanel
            profile={profile}
            onSaveProfile={handleSaveProfile}
            onGoToRadar={() => setActiveTab('radar')}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            applications={applications}
            onStageChange={handleStageChange}
            onRemove={handleRemoveTracked}
            onGoToRadar={() => setActiveTab('radar')}
          />
        )}
      </main>

      <OfferCoachModal
        analysis={selectedAnalysis}
        profile={profile}
        trackedStage={selectedAnalysis ? trackedStages.get(selectedAnalysis.offer.id) ?? null : null}
        onTrack={handleTrackOffer}
        onClose={() => setSelectedAnalysis(null)}
      />
    </div>
  );
}
