import { describe, it, expect } from 'vitest'
import {
  navGo, navBack, navJumpBackTo, navToAnalyze, navReplace, navRestart, currentStep,
  PHASE_OF, NO_BACK, NO_CLOSE,
  type Step,
} from '../importTypes'

describe('import nav reducers', () => {
  it('go pushes the next step', () => {
    expect(navGo(['source'], 'confirm')).toEqual(['source', 'confirm'])
  })

  it('back pops the last step but never empties the stack', () => {
    expect(navBack(['source', 'confirm'])).toEqual(['source'])
    expect(navBack(['source'])).toEqual(['source'])
  })

  it('jumpBackTo truncates to an earlier step in history', () => {
    const hist: Step[] = ['source', 'confirm', 'startDate', 'trainingDays', 'analyze', 'review']
    expect(navJumpBackTo(hist, 'trainingDays')).toEqual(['source', 'confirm', 'startDate', 'trainingDays'])
  })

  it('jumpBackTo pushes the step when it is not in history', () => {
    expect(navJumpBackTo(['source'], 'trainingDays')).toEqual(['source', 'trainingDays'])
  })

  it('toAnalyze always starts analyze from trainingDays (drops error/review tails)', () => {
    // vanuit trainingDays: gewoon analyze erbovenop
    expect(navToAnalyze(['source', 'startDate', 'trainingDays']))
      .toEqual(['source', 'startDate', 'trainingDays', 'analyze'])
    // opnieuw proberen vanuit empty: empty valt weg, analyze zit weer op trainingDays
    expect(navToAnalyze(['source', 'startDate', 'trainingDays', 'empty']))
      .toEqual(['source', 'startDate', 'trainingDays', 'analyze'])
  })

  it('replace swaps the transient analyze step so back skips it', () => {
    // analyze → review: terug landt op trainingDays, niet op een oud percentage
    const afterAnalyze: Step[] = ['source', 'trainingDays', 'analyze']
    const onReview = navReplace(afterAnalyze, 'review')
    expect(onReview).toEqual(['source', 'trainingDays', 'review'])
    expect(navBack(onReview)).toEqual(['source', 'trainingDays'])
    // ook voor de fout-eindes
    expect(navReplace(afterAnalyze, 'empty')).toEqual(['source', 'trainingDays', 'empty'])
  })

  it('restart returns to the source step', () => {
    expect(navRestart()).toEqual(['source'])
  })

  it('currentStep reads the top of the stack', () => {
    expect(currentStep(['source', 'confirm'])).toBe('confirm')
  })
})

describe('import phase + chrome maps', () => {
  it('maps every step to a phase', () => {
    const steps: Step[] = ['source', 'excelChoice', 'sheetLink', 'confirm', 'startDate',
      'trainingDays', 'analyze', 'review', 'saving', 'done', 'empty', 'analyzeError']
    for (const s of steps) expect(PHASE_OF[s]).toBeTypeOf('number')
  })

  it('hides back on source/analyze/saving/done only', () => {
    expect(NO_BACK.source).toBe(true)
    expect(NO_BACK.analyze).toBe(true)
    expect(NO_BACK.review).toBeUndefined()
  })

  it('hides close on saving/done only', () => {
    expect(NO_CLOSE.saving).toBe(true)
    expect(NO_CLOSE.done).toBe(true)
    expect(NO_CLOSE.analyze).toBeUndefined()
  })
})
