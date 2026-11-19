import { useState, useEffect } from 'react'
import { Language, ScoreWeights, DEFAULT_SCORE_WEIGHTS, SCORE_WEIGHT_KEYS, WeightPreset } from '@/lib/types'
import { t } from '@/lib/translations'
import { useKV } from '@/lib/kv'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowCounterClockwise, FloppyDisk, Info, ListBullets } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface SettingsViewProps {
  language: Language
}

const WEIGHT_KEY = 'ats:score-weights'

const PRESETS: WeightPreset[] = [
  {
    id: 'balanced',
    name: 'balanced',
    description: 'balancedDesc',
    weights: DEFAULT_SCORE_WEIGHTS,
  },
  {
    id: 'corporate',
    name: 'corporate',
    description: 'corporateDesc',
    weights: {
      technicalSkills: 20,
      professionalExperience: 20,
      educationCertifications: 10,
      culturalFitSoftSkills: 10,
      careerTrajectoryGrowth: 10,
      productionReadiness: 15,
      proofOfExecution: 15,
    },
  },
  {
    id: 'builders',
    name: 'builders',
    description: 'buildersDesc',
    weights: {
      technicalSkills: 20,
      professionalExperience: 10,
      educationCertifications: 5,
      culturalFitSoftSkills: 10,
      careerTrajectoryGrowth: 15,
      productionReadiness: 15,
      proofOfExecution: 25,
    },
  },
  {
    id: 'junior',
    name: 'junior',
    description: 'juniorDesc',
    weights: {
      technicalSkills: 20,
      professionalExperience: 5,
      educationCertifications: 15,
      culturalFitSoftSkills: 10,
      careerTrajectoryGrowth: 25,
      productionReadiness: 10,
      proofOfExecution: 15,
    },
  },
  {
    id: 'senior',
    name: 'senior',
    description: 'seniorDesc',
    weights: {
      technicalSkills: 20,
      professionalExperience: 25,
      educationCertifications: 5,
      culturalFitSoftSkills: 10,
      careerTrajectoryGrowth: 10,
      productionReadiness: 15,
      proofOfExecution: 15,
    },
  },
]

export function SettingsView({ language }: SettingsViewProps) {
  const [savedWeights, setSavedWeights] = useKV<ScoreWeights>(WEIGHT_KEY, DEFAULT_SCORE_WEIGHTS)
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_SCORE_WEIGHTS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (savedWeights) {
      setWeights(savedWeights)
    }
  }, [savedWeights])

  const totalWeight = SCORE_WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0)
  const isValid = totalWeight === 100

  const updateWeight = (key: keyof ScoreWeights, value: number) => {
    setWeights(prev => {
      const next = { ...prev, [key]: value }
      setHasChanges(true)
      return next
    })
  }

  const handleSave = () => {
    if (!isValid) {
      toast.error(t('settings.totalMustBe100', language))
      return
    }
    setSavedWeights(weights)
    setHasChanges(false)
    toast.success(t('settings.saved', language))
  }

  const handleReset = () => {
    setWeights(DEFAULT_SCORE_WEIGHTS)
    setHasChanges(true)
  }

  const applyPreset = (preset: WeightPreset) => {
    setWeights(preset.weights)
    setHasChanges(true)
    toast.info(t(`settings.presets.${preset.name}`, language))
  }

  const categoryLabels: Record<keyof ScoreWeights, string> = {
    technicalSkills: t('settings.categories.technicalSkills', language),
    professionalExperience: t('settings.categories.professionalExperience', language),
    educationCertifications: t('settings.categories.educationCertifications', language),
    culturalFitSoftSkills: t('settings.categories.culturalFitSoftSkills', language),
    careerTrajectoryGrowth: t('settings.categories.careerTrajectoryGrowth', language),
    productionReadiness: t('settings.categories.productionReadiness', language),
    proofOfExecution: t('settings.categories.proofOfExecution', language),
  }

  const categoryDescriptions: Record<keyof ScoreWeights, string> = {
    technicalSkills: t('settings.descriptions.technicalSkills', language),
    professionalExperience: t('settings.descriptions.professionalExperience', language),
    educationCertifications: t('settings.descriptions.educationCertifications', language),
    culturalFitSoftSkills: t('settings.descriptions.culturalFitSoftSkills', language),
    careerTrajectoryGrowth: t('settings.descriptions.careerTrajectoryGrowth', language),
    productionReadiness: t('settings.descriptions.productionReadiness', language),
    proofOfExecution: t('settings.descriptions.proofOfExecution', language),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t('settings.title', language)}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.subtitle', language)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {t('settings.weightsTitle', language)}
              </CardTitle>
              <CardDescription>
                {t('settings.weightsDescription', language)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ListBullets size={16} />
                    {t('settings.presets.label', language)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{t('settings.presets.label', language)}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PRESETS.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className="cursor-pointer flex-col items-start"
                    >
                      <span className="font-medium text-sm">{t(`settings.presets.${preset.name}`, language)}</span>
                      <span className="text-xs text-muted-foreground">{t(`settings.presets.${preset.description}`, language)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant={isValid ? 'default' : 'destructive'} className="text-sm tabular-nums">
                {t('settings.total', language)}: {totalWeight}%
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {SCORE_WEIGHT_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium leading-none">
                    {categoryLabels[key]}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {categoryDescriptions[key]}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums ml-3 w-12 text-right">
                  {weights[key]}%
                </span>
              </div>
              <Slider
                value={[weights[key]]}
                onValueChange={([v]) => updateWeight(key, v)}
                min={0}
                max={50}
                step={5}
                className="w-full"
              />
            </div>
          ))}

          {!isValid && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <Info size={16} weight="bold" />
              {t('settings.totalMustBe100', language)} ({t('settings.current', language)}: {totalWeight}%)
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <ArrowCounterClockwise size={16} />
              {t('settings.reset', language)}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || !isValid}
              className="gap-2"
            >
              <FloppyDisk size={16} />
              {t('settings.save', language)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Info size={18} weight="duotone" />
            {t('settings.howItWorks', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>{t('settings.explanation1', language)}</p>
          <p>{t('settings.explanation2', language)}</p>
          <p>{t('settings.explanation3', language)}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export { WEIGHT_KEY }
