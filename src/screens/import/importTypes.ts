// runyo — import-wizard types + navigatie-state-machine.
// Pure logica (geen React/UI-imports) zodat de stap-navigatie los te testen is.
// Geport van runyo-import-flow.jsx (de ontwerp-spec).

import type { AnalyseResult, DayMode } from '@/services/import'

export type { DayMode } from '@/services/import'

// Alle schermen van de wizard. De volgorde van de happy-path is:
// source → (confirm | excelChoice → (confirm | sheetLink)) → startDate →
// trainingDays → analyze → review → saving → done.
// empty + analyzeError zijn fout-eindes vanuit analyze.
export type Step =
  | 'source'
  | 'excelChoice'
  | 'sheetLink'
  | 'confirm'
  | 'startDate'
  | 'trainingDays'
  | 'analyze'
  | 'review'
  | 'saving'
  | 'done'
  | 'empty'
  | 'analyzeError'

// 4 fasen voor de gesegmenteerde voortgangsbalk: bron, instellen, controleren, klaar.
export type Phase = 0 | 1 | 2 | 3

export type Source = 'pdf' | 'excel' | 'photo' | 'sheet'

// Fase-index per stap (voedt de ProgressBar). Fout-schermen erven de fase van analyse.
export const PHASE_OF: Record<Step, Phase> = {
  source: 0,
  excelChoice: 0,
  sheetLink: 0,
  confirm: 0,
  startDate: 1,
  trainingDays: 1,
  analyze: 2,
  review: 2,
  saving: 2,
  done: 3,
  empty: 2,
  analyzeError: 2,
}

// Geen terug-knop: bron (eerste stap), tijdens analyse/opslaan, en op klaar.
// (analyze: wél sluiten via de afbreek-sheet, maar geen terug.)
export const NO_BACK: Partial<Record<Step, true>> = {
  source: true,
  analyze: true,
  saving: true,
  done: true,
}

// Geen sluit-knop: tijdens opslaan en op klaar (import is dan al rond).
export const NO_CLOSE: Partial<Record<Step, true>> = {
  saving: true,
  done: true,
}

// Alle data die de wizard tussen stappen vasthoudt.
export type WizardData = {
  source: Source
  link: string
  fileB64: string
  fileMime: string
  fileName: string
  startDate: string
  dayMode: DayMode
  result: AnalyseResult | null
  error: string
}

// ── Pure navigatie-reducers (geport uit flow.jsx) ─────────────────────────────
// hist = stack van bezochte stappen; de laatste is de actieve stap.

export function navGo(hist: Step[], next: Step): Step[] {
  return [...hist, next]
}

export function navBack(hist: Step[]): Step[] {
  return hist.length > 1 ? hist.slice(0, -1) : hist
}

// Spring terug naar een eerdere stap (bv. "opnieuw analyseren" → trainingDays).
// Staat de stap niet in de historie, dan duwen we hem erop.
export function navJumpBackTo(hist: Step[], id: Step): Step[] {
  const i = hist.indexOf(id)
  return i >= 0 ? hist.slice(0, i + 1) : [...hist, id]
}

// Start de analyse altijd vanaf trainingDays. analyze + de fout-eindes (empty/
// analyzeError) zijn transient: ze horen niet in de terug-historie, anders strandt
// "terug" vanuit review/empty/analyzeError op een oud analyse-percentage.
export function navToAnalyze(hist: Step[]): Step[] {
  const i = hist.indexOf('trainingDays')
  const base = i >= 0 ? hist.slice(0, i + 1) : hist
  return [...base, 'analyze']
}

// Vervang de huidige (transient) stap door een andere, zodat "terug" de analyse
// overslaat: analyze → review/empty/analyzeError landt zo direct op trainingDays.
export function navReplace(hist: Step[], next: Step): Step[] {
  return hist.length > 0 ? [...hist.slice(0, -1), next] : [next]
}

export function navRestart(): Step[] {
  return ['source']
}

export const currentStep = (hist: Step[]): Step => hist[hist.length - 1]
