import React from 'react';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import type { ApplicationStage, TrackedApplication } from './candidate-profile-types';

interface ApplicationTrackerViewProps {
  applications: TrackedApplication[];
  onStageChange: (offerId: string, stage: ApplicationStage) => void;
  onRemove: (offerId: string) => void;
  onGoToRadar: () => void;
}

const STAGE_OPTIONS: Array<{ value: ApplicationStage; label: string }> = [
  { value: 'saved', label: 'À préparer' },
  { value: 'applied', label: 'Postulé' },
  { value: 'interview', label: 'Entretien' },
  { value: 'offer', label: 'Offre reçue' },
  { value: 'rejected', label: 'Non retenu' },
];

/**
 * Individual candidate application tracker with stage progression and tabular match telemetry.
 */
export default function ApplicationTrackerView({
  applications,
  onStageChange,
  onRemove,
  onGoToRadar,
}: ApplicationTrackerViewProps) {
  if (applications.length === 0) {
    return (
      <div className="p-12 bg-[#FFFFFF] border border-[#0F1419]/12 text-center space-y-4">
        <h2 className="font-editorial text-3xl text-[#0F1419]">
          Aucune candidature suivie pour le moment
        </h2>
        <p className="text-sm text-[#525866] max-w-md mx-auto">
          Enregistrez les offres pertinentes depuis le Radar pour suivre vos envois, relances et
          entretiens au même endroit.
        </p>
        <button
          type="button"
          onClick={onGoToRadar}
          className="px-5 py-2.5 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] cursor-pointer"
        >
          Explorer le Radar d&apos;offres
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#0F1419]/12 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#0F1419]/12 bg-[#F6F5F0] font-mono text-[11px] text-[#525866]">
            <th className="py-3.5 px-5 font-medium">Match</th>
            <th className="py-3.5 px-5 font-medium">Offre &amp; Entreprise</th>
            <th className="py-3.5 px-5 font-medium">Source</th>
            <th className="py-3.5 px-5 font-medium">Statut</th>
            <th className="py-3.5 px-5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#0F1419]/10 text-sm">
          {applications.map((app) => (
            <tr key={app.offerId} className="hover:bg-[#F6F5F0]/50">
              <td className="py-4 px-5 font-mono font-semibold text-[#0F1419] tabular-nums">
                {app.matchScore}%
              </td>
              <td className="py-4 px-5">
                <div className="font-medium text-[#0F1419]">{app.offerTitle}</div>
                <div className="text-xs text-[#525866]">
                  {app.company} · {app.location}
                </div>
              </td>
              <td className="py-4 px-5 font-mono text-xs text-[#525866]">{app.sourceLabel}</td>
              <td className="py-4 px-5">
                <select
                  aria-label={`Statut pour ${app.offerTitle}`}
                  value={app.stage}
                  onChange={(e) => onStageChange(app.offerId, e.target.value as ApplicationStage)}
                  className="px-2.5 py-1.5 bg-[#F6F5F0] border border-[#0F1419]/15 font-mono text-xs text-[#0F1419] focus:border-[#0F1419] focus:outline-none"
                >
                  {STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-4 px-5">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={app.offerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#0F1419]/15 text-xs font-medium text-[#0F1419] hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors"
                  >
                    <span>Ouvrir</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    aria-label={`Supprimer ${app.offerTitle}`}
                    onClick={() => onRemove(app.offerId)}
                    className="p-1.5 border border-[#0F1419]/12 text-[#7B8190] hover:text-red-700 hover:border-red-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
