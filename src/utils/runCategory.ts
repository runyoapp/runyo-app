import { ActivityColors, type Theme } from '@/constants/theme'
import type { Activity, ActivityType } from '@/types/activity'

// Display-only run-subcategorie voor de weekbouwer. Niets hiervan wordt
// opgeslagen — het is puur een afleiding uit titel/detail/km/intervals om
// runs visueel te onderscheiden (easy / tempo / long). Niet-runs vallen
// buiten dit systeem en gebruiken gewoon hun ActivityColors.
export type RunCategory = 'easy' | 'tempo' | 'long'

const TEMPO_RE = /tempo|interval|drempel|vo2|baan|fartlek/i
const LONG_RE  = /long/i

export function runCategory(activity: Activity): RunCategory | null {
  if (activity.type !== 'run') return null

  const text = `${activity.titel} ${activity.detail}`
  const hasIntervals = activity.intervals != null && activity.intervals.length > 0

  if (TEMPO_RE.test(text) || hasIntervals) return 'tempo'
  if ((activity.km ?? 0) >= 15 || LONG_RE.test(text)) return 'long'
  return 'easy'
}

// Mint-tint per intensiteit (lichter = rustiger, voller = harder). Niet-runs
// houden hun eigen type-kleur. Houdt WeekbouwerScreen/ActivityCard/WeekHeaderB
// consistent qua kleurgebruik.
const RUN_OPACITY: Record<RunCategory, number> = {
  easy: 0.45,
  long: 0.7,
  tempo: 1,
}

// rgba-mint op basis van de thema-accent. We mixen met wit-over-papier door
// de opacity zelf in de kleur te bakken (geen aparte alpha-prop nodig).
function mintTint(theme: Theme, opacity: number): string {
  // accent is hex (#RRGGBB) in beide thema's
  const hex = theme.accent.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// Streep-/dot-kleur voor een activiteit in de weekbouwer.
export function activityColor(activity: Activity, theme: Theme): string {
  const cat = runCategory(activity)
  if (cat) return mintTint(theme, RUN_OPACITY[cat])
  const colors = (ActivityColors as Record<string, { text: string }>)[activity.type as ActivityType]
  return colors?.text ?? theme.accent
}

// Categorie-sleutel voor de volumebalk: run-subcategorie of het ruwe type.
export function volumeCategory(activity: Activity): string {
  return runCategory(activity) ?? activity.type
}

// Label voor de legenda per categorie-sleutel.
const RUN_LABELS: Record<RunCategory, string> = {
  easy: 'easy', long: 'long', tempo: 'tempo',
}

export function categoryLabel(key: string): string {
  if (key in RUN_LABELS) return RUN_LABELS[key as RunCategory]
  return key
}

// Kleur voor een categorie-sleutel (zelfde tint-logica als activityColor).
export function categoryColor(key: string, theme: Theme): string {
  if (key in RUN_OPACITY) return mintTint(theme, RUN_OPACITY[key as RunCategory])
  const colors = (ActivityColors as Record<string, { text: string }>)[key]
  return colors?.text ?? theme.accent
}
