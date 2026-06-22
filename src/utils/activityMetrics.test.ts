import { describe, it, expect } from 'vitest'
import { intervalAmountUnit, formatIntervalBlock } from './activityMetrics'
import type { IntervalBlock } from '@/types/activity'

function block(p: Partial<IntervalBlock>): IntervalBlock {
  return { id: 'b', label: null, repeat: 1, distanceKm: null, durationMin: null, pace: null, recovery: null, ...p }
}

describe('intervalAmountUnit', () => {
  it('respecteert de opgeslagen eenheid (geen flip naar km)', () => {
    expect(intervalAmountUnit(block({ distanceKm: 1, amountUnit: 'm' }))).toEqual({ amount: '1000', unit: 'm' })
    expect(intervalAmountUnit(block({ distanceKm: 1, amountUnit: 'km' }))).toEqual({ amount: '1', unit: 'km' })
    expect(intervalAmountUnit(block({ durationMin: 2, amountUnit: 's' }))).toEqual({ amount: '120', unit: 's' })
    expect(intervalAmountUnit(block({ durationMin: 2, amountUnit: 'min' }))).toEqual({ amount: '2', unit: 'min' })
  })

  it('toont fractionele opslag exact in de bewaarde eenheid', () => {
    expect(intervalAmountUnit(block({ distanceKm: 0.4, amountUnit: 'm' }))).toEqual({ amount: '400', unit: 'm' })
    expect(intervalAmountUnit(block({ distanceKm: 0.15, amountUnit: 'm' }))).toEqual({ amount: '150', unit: 'm' })
    expect(intervalAmountUnit(block({ durationMin: 1.5, amountUnit: 's' }))).toEqual({ amount: '90', unit: 's' })
  })

  it('valt terug op afleiding zonder amountUnit (legacy/import)', () => {
    expect(intervalAmountUnit(block({ distanceKm: 1 }))).toEqual({ amount: '1', unit: 'km' })
    expect(intervalAmountUnit(block({ distanceKm: 0.4 }))).toEqual({ amount: '400', unit: 'm' })
    expect(intervalAmountUnit(block({ durationMin: 3 }))).toEqual({ amount: '3', unit: 'min' })
  })

  it('negeert een eenheid die niet bij het gevulde veld past', () => {
    // amountUnit 'km' maar alleen durationMin gevuld → afleiding uit durationMin.
    expect(intervalAmountUnit(block({ durationMin: 3, amountUnit: 'km' }))).toEqual({ amount: '3', unit: 'min' })
  })
})

describe('formatIntervalBlock', () => {
  it('gebruikt de bewaarde eenheid in de samenvatting', () => {
    expect(formatIntervalBlock(block({ repeat: 6, distanceKm: 0.4, amountUnit: 'm', pace: '3:45', recovery: '90 s' })))
      .toBe('6× 400 m · 3:45/km · 90 s herstel')
  })
})
