import { describe, expect, it } from 'vitest'
import { simulate } from './simulate'
import type { IndexDataset } from './types'

const dataset: IndexDataset = {
  id: 'example', name: '例', nameEn: 'Example', currency: 'JPY', source: 'fixture', sourceUrl: '', retrievedAt: '2001-03-31', notes: [],
  points: [
    { month: '2000-12', buy: 1, close: 1 },
    { month: '2001-01', buy: 20, close: 40 },
    { month: '2001-02', buy: 10, close: 10 },
    { month: '2001-03', buy: 40, close: 20 },
  ],
}

describe('simulate', () => {
  const options = { startYear: 2001, monthlyAmount: 100 }
  const rates = [
    { month: '2001-01', buy: 5, close: 6 },
    { month: '2001-02', buy: 2, close: 3 },
    { month: '2001-03', buy: 10, close: 5 },
  ]

  it('converts purchases at opening FX and both valuations at closing FX', () => {
    const result = simulate(dataset, { ...options, fx: { mode: 'jpy', points: rates } })
    expect(result.points).toEqual([
      { month: '2001-01', units: 1, principal: 100, value: 240, lumpValue: 720 },
      { month: '2001-02', units: 6, principal: 200, value: 180, lumpValue: 90 },
      { month: '2001-03', units: 6.25, principal: 300, value: 625, lumpValue: 300 },
    ])
    expect(result.summary.lumpFinalValue).toBe(300)
  })

  it('skips months with no matching FX without adding to either budget', () => {
    const result = simulate(dataset, { ...options, fx: { mode: 'jpy', points: [rates[2], rates[0]] } })
    expect(result.points.map(point => point.month)).toEqual(['2001-01', '2001-03'])
    expect(result.summary).toMatchObject({ months: 2, totalPrincipal: 200, finalValue: 125, lumpFinalValue: 200 })
  })

  it('ignores FX rates and gaps in neutral mode', () => {
    expect(simulate(dataset, { ...options, fx: { mode: 'neutral', points: [rates[1]] } })).toEqual(simulate(dataset, options))
  })

  it('buys fractional units at the open and values them at the close', () => {
    const result = simulate(dataset, { startYear: 2001, monthlyAmount: 100 })
    expect(result.points).toEqual([
      { month: '2001-01', units: 5, principal: 100, value: 200, lumpValue: 600 },
      { month: '2001-02', units: 15, principal: 200, value: 150, lumpValue: 150 },
      { month: '2001-03', units: 17.5, principal: 300, value: 350, lumpValue: 300 },
    ])
    expect(result.summary).toEqual({ months: 3, totalPrincipal: 300, finalValue: 350, lumpFinalValue: 300, gain: 50, gainRate: 1 / 6, maxDrawdownRate: 0.25 })
  })

  it.each([null, 0, -1])('values existing units without contributing when buy is %s', buy => {
    const result = simulate({ ...dataset, points: [dataset.points[1], { month: '2001-02', buy, close: 10 }] }, { startYear: 2001, monthlyAmount: 100 })
    expect(result.points[1]).toEqual({ month: '2001-02', principal: 100, value: 50, units: 5, lumpValue: 50 })
    expect(result.summary).toEqual({ months: 1, totalPrincipal: 100, finalValue: 50, lumpFinalValue: 50, gain: -50, gainRate: -0.5, maxDrawdownRate: 0.75 })
  })

  it.each([[1999, 100], [2002, 100], [2001, 0], [2001, -10]])('returns zeroes for year %i and amount %i', (startYear, monthlyAmount) => {
    expect(simulate(dataset, { startYear, monthlyAmount })).toEqual({ points: [], summary: { months: 0, totalPrincipal: 0, finalValue: 0, lumpFinalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0 } })
  })
})
