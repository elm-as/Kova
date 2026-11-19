import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Plus, Sparkles, X } from 'lucide-react';
import { extractTextFromFile } from '@/lib/fileUtils';
import type { CandidateProfile, PreferredWorkMode } from './candidate-profile-types';
import { extractCandidateIdentityFromCv } from './cv-identity-extractor';
import ProfileHighlightsCard from './ProfileHighlightsCard';

interface CandidateProfilePanelProps {
  profile: CandidateProfile;
  onSaveProfile: (next: CandidateProfile) => void;
  onGoToRadar: () => void;
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 bg-[#F6F5F0] border border-[#0F1419]/15 text-sm text-[#0F1419] placeholder:text-[#7B8190] focus:bg-[#FFFFFF] focus:border-[#0F1419] focus:outline-none transition-colors';

/**
 * Individual candidate profile builder with CV upload (PDF/image/text via Kova OCR pipeline)
 * and structured editing of skills, achievements, target roles, and mobility.
 */
export default function CandidateProfilePanel({
  profile,
  onSaveProfile,
  onGoToRadar,
}: CandidateProfilePanelProps) {
  const [draft, setDraft] = useState<CandidateProfile>(profile);
  const [skillInput, setSkillInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<string>('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const handleCvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStep('Lecture du CV…');
    setImportMessage(null);
    try {
      const result = await extractTextFromFile(file);
      if (!result.text || result.text.trim().length < 20) {
        throw new Error('Aucun texte exploitable détecté dans ce fichier.');
      }

      setImportStep('Extraction de votre identité…');
      const extracted = await extractCandidateIdentityFromCv(result.text, draft);
      setDraft(extracted.profile);
      onSaveProfile(extracted.profile);

      const who = extracted.profile.fullName || 'Identité';
      const engine = extracted.source === 'llm' ? 'IA Groq' : 'analyse locale';
      setImportMessage(
        `${who} · ${extracted.profile.headline} (${extracted.profile.location}) — ${extracted.profile.skills.length} compétences et ${extracted.profile.highlights.length} réalisations chargées automatiquement (${engine}).`,
      );
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Lecture du fichier impossible.';
      setImportMessage(`Erreur d'import : ${reason}`);
    } finally {
      setImporting(false);
      setImportStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSkill = () => {
    const clean = skillInput.trim();
    if (!clean) return;
    if (draft.skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkillInput('');
      return;
    }
    setDraft((prev) => ({ ...prev, skills: [...prev.skills, clean] }));
    setSkillInput('');
  };

  const handleAddHighlight = (text: string) => {
    setDraft((prev) => ({ ...prev, highlights: [text, ...prev.highlights].slice(0, 6) }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveProfile(draft);
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 2200);
  };

  return (
    <div className="space-y-8">
      {/* CV Import Banner */}
      <section className="p-6 sm:p-8 bg-[#FFFFFF] border border-[#0F1419]/12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="font-mono text-[11px] text-[#525866] uppercase tracking-wider">
            Import automatique · OCR &amp; PDF Kova
          </p>
          <h2 className="font-editorial text-3xl text-[#0F1419] leading-tight">
            Importer votre CV pour calibrer le <em className="italic text-[#0F1419]/65">Radar d&apos;offres</em>
          </h2>
          <p className="text-sm text-[#525866] leading-relaxed">
            Déposez un CV (PDF, image ou texte) : Kova extrait vos compétences, années
            d&apos;expérience et réalisations chiffrées afin de classer chaque offre par pertinence.
          </p>
          {importMessage && (
            <p className="font-mono text-xs text-[#0F5132] bg-[#ECFDF3] border border-[#0F5132]/20 px-3 py-2">
              {importMessage}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleCvUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] transition-colors cursor-pointer disabled:opacity-60"
          >
            <FileUp className="w-4 h-4" aria-hidden="true" />
            <span>{importing ? importStep || 'Extraction en cours...' : 'Importer mon CV (PDF / Image)'}</span>
          </button>
          <button
            type="button"
            onClick={onGoToRadar}
            className="inline-flex items-center gap-2 px-5 py-3 border border-[#0F1419]/20 bg-[#F6F5F0] text-[#0F1419] text-xs font-semibold hover:bg-[#0F1419] hover:text-[#F6F5F0] transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Voir les offres matchées</span>
          </button>
        </div>
      </section>

      {/* Structured Profile Editor */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 p-6 sm:p-8 bg-[#FFFFFF] border border-[#0F1419]/12 space-y-5">
          <div className="border-b border-[#0F1419]/10 pb-4">
            <h3 className="font-editorial text-2xl text-[#0F1419]">Identité professionnelle</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="prof-name" className="block font-mono text-[11px] text-[#525866]">
                Nom complet
              </label>
              <input
                id="prof-name"
                type="text"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                placeholder="Ex. Kouassi Jean-Marc"
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prof-loc" className="block font-mono text-[11px] text-[#525866]">
                Localisation actuelle
              </label>
              <input
                id="prof-loc"
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Abidjan, Côte d'Ivoire"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-headline" className="block font-mono text-[11px] text-[#525866]">
              Intitulé de profil / Poste visé principal
            </label>
            <input
              id="prof-headline"
              type="text"
              required
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Ex. Développeur Fullstack React / Python ou Analyste Financier"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="prof-years" className="block font-mono text-[11px] text-[#525866]">
                Expérience (années)
              </label>
              <input
                id="prof-years"
                type="number"
                min={0}
                max={35}
                value={draft.yearsExperience}
                onChange={(e) =>
                  setDraft({ ...draft, yearsExperience: Math.max(0, Number(e.target.value) || 0) })
                }
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prof-mode" className="block font-mono text-[11px] text-[#525866]">
                Mode souhaité
              </label>
              <select
                id="prof-mode"
                value={draft.preferredWorkMode}
                onChange={(e) =>
                  setDraft({ ...draft, preferredWorkMode: e.target.value as PreferredWorkMode })
                }
                className={INPUT_CLASS}
              >
                <option value="any">Tous modes</option>
                <option value="remote">Remote prioritaire</option>
                <option value="hybrid">Hybride</option>
                <option value="onsite">Présentiel</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prof-langs" className="block font-mono text-[11px] text-[#525866]">
                Langues (virgules)
              </label>
              <input
                id="prof-langs"
                type="text"
                value={draft.languages.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-2.5 pt-2">
            <label htmlFor="prof-skill-add" className="block font-mono text-[11px] text-[#525866]">
              Compétences clés ({draft.skills.length})
            </label>
            <div className="flex gap-2">
              <input
                id="prof-skill-add"
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Ajouter une compétence (ex. Python, Flutter, Audit, Excel...)"
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-4 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {draft.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F6F5F0] border border-[#0F1419]/15 font-mono text-xs text-[#0F1419]"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    aria-label={`Retirer ${skill}`}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        skills: prev.skills.filter((s) => s !== skill),
                      }))
                    }
                    className="text-[#7B8190] hover:text-[#0F1419] cursor-pointer"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <ProfileHighlightsCard
          highlights={draft.highlights}
          savedFlag={savedFlag}
          onAddHighlight={handleAddHighlight}
          onRemoveHighlight={(idx) =>
            setDraft((prev) => ({
              ...prev,
              highlights: prev.highlights.filter((_, i) => i !== idx),
            }))
          }
        />
      </form>
    </div>
  );
}
