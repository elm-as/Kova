import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

interface ProfileHighlightsCardProps {
  highlights: string[];
  savedFlag: boolean;
  onAddHighlight: (text: string) => void;
  onRemoveHighlight: (index: number) => void;
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 bg-[#F6F5F0] border border-[#0F1419]/15 text-sm text-[#0F1419] placeholder:text-[#7B8190] focus:bg-[#FFFFFF] focus:border-[#0F1419] focus:outline-none transition-colors';

/**
 * Editable candidate achievements plate paired with the profile save action.
 */
export default function ProfileHighlightsCard({
  highlights,
  savedFlag,
  onAddHighlight,
  onRemoveHighlight,
}: ProfileHighlightsCardProps) {
  const [highlightInput, setHighlightInput] = useState('');

  const handleAdd = () => {
    const clean = highlightInput.trim();
    if (!clean) return;
    onAddHighlight(clean);
    setHighlightInput('');
  };

  return (
    <div className="lg:col-span-5 p-6 sm:p-8 bg-[#FFFFFF] border border-[#0F1419]/12 flex flex-col justify-between gap-6">
      <div className="space-y-4">
        <div className="border-b border-[#0F1419]/10 pb-4">
          <h3 className="font-editorial text-2xl text-[#0F1419]">
            Réalisations à mettre en avant
          </h3>
          <p className="text-xs text-[#525866] mt-1">
            Kova sélectionne automatiquement les preuves les plus pertinentes pour chaque offre.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={highlightInput}
            onChange={(e) => setHighlightInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Ex. Migration PostgreSQL réduisant la latence de 40%"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="divide-y divide-[#0F1419]/10 border-t border-b border-[#0F1419]/10">
          {highlights.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="py-3 flex items-start justify-between gap-3 text-xs text-[#272D36]"
            >
              <span className="leading-relaxed">{item}</span>
              <button
                type="button"
                aria-label="Retirer cette réalisation"
                onClick={() => onRemoveHighlight(idx)}
                className="text-[#7B8190] hover:text-[#0F1419] cursor-pointer shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-4 border-t border-[#0F1419]/10 flex items-center justify-between gap-4">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F1419] text-[#F6F5F0] text-xs font-semibold hover:bg-[#272D36] transition-colors cursor-pointer"
        >
          {savedFlag ? <Check className="w-4 h-4" aria-hidden="true" /> : null}
          <span>{savedFlag ? 'Profil enregistré' : 'Enregistrer et recalculer les scores'}</span>
        </button>
      </div>
    </div>
  );
}
