import { Language, TargetLevel } from '@/lib/types'
import { ExtractedPositionDraft } from '@/lib/positions/position-extractor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle, Sparkle, Tag, MapPin, Briefcase } from 'lucide-react'

interface PositionImportPreviewProps {
  draft: ExtractedPositionDraft
  language: Language
  onDraftChange: (updater: (prev: ExtractedPositionDraft) => ExtractedPositionDraft) => void
}

export default function PositionImportPreview({
  draft,
  language,
  onDraftChange,
}: PositionImportPreviewProps) {
  const handleRemoveSkill = (skillToRemove: string) => {
    onDraftChange((prev) => ({
      ...prev,
      keySkills: prev.keySkills.filter((s) => s !== skillToRemove),
    }))
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Bannière de confirmation IA */}
      <div className="flex items-center justify-between p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            {language === 'fr'
              ? 'Sections extraites et structurées par l\'IA. Vous pouvez les ajuster avant validation.'
              : 'Sections extracted by AI. Review and adjust before saving.'}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums font-semibold">
          <Sparkle className="w-3 h-3 text-emerald-500" />
          {Math.round(draft.confidence * 100)}% confiance
        </div>
      </div>

      {/* Titre du poste */}
      <div className="space-y-1.5">
        <Label htmlFor="preview-title" className="text-xs font-semibold text-foreground">
          {language === 'fr' ? 'Titre officiel du poste' : 'Job Title'} *
        </Label>
        <Input
          id="preview-title"
          value={draft.title}
          onChange={(e) => onDraftChange((prev) => ({ ...prev, title: e.target.value }))}
          className="text-sm font-medium"
          placeholder="ex: Lead Developer React"
        />
      </div>

      {/* Ligne des paramètres clés du poste */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-border bg-muted/30">
        {/* Niveau cible */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            {language === 'fr' ? 'Niveau d\'expérience' : 'Target Level'}
          </Label>
          <Select
            value={draft.targetLevel}
            onValueChange={(val) =>
              onDraftChange((prev) => ({ ...prev, targetLevel: val as TargetLevel }))
            }
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="junior" className="text-xs">Junior (0-2 ans)</SelectItem>
              <SelectItem value="mid" className="text-xs">Mid-level (2-5 ans)</SelectItem>
              <SelectItem value="senior" className="text-xs">Senior (5+ ans)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nombre d'ouvertures */}
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            {language === 'fr' ? 'Nombre de postes' : 'Openings'}
          </Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={99}
              value={draft.openings}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  openings: Math.max(1, parseInt(e.target.value, 10) || 1),
                }))
              }
              className="h-8 text-xs font-mono tabular-nums bg-background"
            />
          </div>
        </div>

        {/* Toggle Stage */}
        <div className="flex flex-col justify-between pt-0.5">
          <Label className="text-[11px] font-medium text-muted-foreground cursor-pointer">
            {language === 'fr' ? 'Statut Stage / Alternance' : 'Internship / Apprenticeship'}
          </Label>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-foreground font-medium">
              {draft.isInternship
                ? (language === 'fr' ? 'Oui (Stage)' : 'Yes')
                : (language === 'fr' ? 'Non (Emploi direct)' : 'No')}
            </span>
            <Switch
              checked={draft.isInternship}
              onCheckedChange={(checked) =>
                onDraftChange((prev) => ({ ...prev, isInternship: checked }))
              }
            />
          </div>
        </div>
      </div>

      {/* Métadonnées détectées (Contrat & Lieu) */}
      {(draft.contractType || draft.location) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {draft.contractType && (
            <Badge variant="outline" className="text-xs gap-1 font-normal py-0.5">
              <Briefcase className="w-3 h-3 text-muted-foreground" />
              <span>Contrat : {draft.contractType}</span>
            </Badge>
          )}
          {draft.location && (
            <Badge variant="outline" className="text-xs gap-1 font-normal py-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span>Lieu : {draft.location}</span>
            </Badge>
          )}
        </div>
      )}

      {/* Section 1 : Description & Missions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="preview-description" className="text-xs font-semibold text-foreground">
            {language === 'fr' ? 'Missions & Description du poste' : 'Duties & Description'} *
          </Label>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {draft.description.length} car.
          </span>
        </div>
        <Textarea
          id="preview-description"
          value={draft.description}
          onChange={(e) =>
            onDraftChange((prev) => ({ ...prev, description: e.target.value }))
          }
          rows={5}
          className="text-xs font-sans leading-relaxed"
        />
      </div>

      {/* Section 2 : Exigences & Qualifications */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="preview-requirements" className="text-xs font-semibold text-foreground">
            {language === 'fr' ? 'Exigences, Compétences & Profil recherché' : 'Requirements & Qualifications'} *
          </Label>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {draft.requirements.length} car.
          </span>
        </div>
        <Textarea
          id="preview-requirements"
          value={draft.requirements}
          onChange={(e) =>
            onDraftChange((prev) => ({ ...prev, requirements: e.target.value }))
          }
          rows={5}
          className="text-xs font-sans leading-relaxed"
        />
      </div>

      {/* Tags de compétences clés extraites */}
      {draft.keySkills.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Tag className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Compétences clés identifiées' : 'Key identified skills'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {draft.keySkills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-[11px] font-normal gap-1 pr-1.5 hover:bg-muted"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                  title="Supprimer"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
