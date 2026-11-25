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
  const noWithdrawals = { withdrawalStartMonth: null, depletedMonth: null, totalWithdrawn: 0 }
  const rates = [
    { month: '2001-01', buy: 5, close: 6 },
    { month: '2001-02', buy: 2, close: 3 },
    { month: '2001-03', buy: 10, close: 5 },
  ]

  it('uses the specified start month for both year validation and the first purchase', () => {
    const result = simulate(dataset, { ...options, startYear: 1999, startMonth: '2001-02' })
    expect(result.points).toEqual([
      { month: '2001-02', units: 10, principal: 100, value: 100, lumpValue: 200 },
      { month: '2001-03', units: 12.5, principal: 200, value: 250, lumpValue: 400 },
    ])
    expect(simulate(dataset, { ...options, startMonth: '1999-12' }).points).toEqual([])
  })

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
    expect(result.summary).toEqual({ ...noWithdrawals, months: 3, totalPrincipal: 300, finalValue: 350, lumpFinalValue: 300, gain: 50, gainRate: 1 / 6, maxDrawdownRate: 0.25 })
  })

  it.each([null, 0, -1])('values existing units without contributing when buy is %s', buy => {
    const result = simulate({ ...dataset, points: [dataset.points[1], { month: '2001-02', buy, close: 10 }] }, { startYear: 2001, monthlyAmount: 100 })
    expect(result.points[1]).toEqual({ month: '2001-02', principal: 100, value: 50, units: 5, lumpValue: 50 })
    expect(result.summary).toEqual({ ...noWithdrawals, months: 1, totalPrincipal: 100, finalValue: 50, lumpFinalValue: 50, gain: -50, gainRate: -0.5, maxDrawdownRate: 0.75 })
  })

  it.each([[1999, 100], [2002, 100], [2001, 0], [2001, -10]])('returns zeroes for year %i and amount %i', (startYear, monthlyAmount) => {
    expect(simulate(dataset, { startYear, monthlyAmount })).toEqual({ points: [], summary: { ...noWithdrawals, months: 0, totalPrincipal: 0, finalValue: 0, lumpFinalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0 } })
  })

  it('uses complete adjusted prices before applying FX, skipping unavailable months', () => {
    const adjusted = { ...dataset, points: dataset.points.map((point, index) => ({ ...point, adjBuy: index < 2 ? null : 2, adjClose: 3 })) }
    const result = simulate(adjusted, { ...options, basis: 'adjusted', fx: { mode: 'jpy', points: rates } })
    expect(result.points.map(point => point.month)).toEqual(['2001-02', '2001-03'])
    expect(result.summary).toMatchObject({ totalPrincipal: 200, finalValue: 450, lumpFinalValue: 750 })
    expect(simulate(adjusted, { ...options, basis: 'adjusted' }).summary.finalValue).toBe(300)
    expect(simulate(adjusted, options).summary.finalValue).toBe(350)
  })

  it('falls back to prices when adjusted prices are all null', () => {
    const missing = { ...dataset, points: dataset.points.map(point => ({ ...point, adjBuy: null, adjClose: null })) }
    expect(simulate(missing, { ...options, basis: 'adjusted' })).toEqual(simulate(dataset, options))
  })

  it('withdraws from both balances, using close when buy is absent', () => {
    const flat = { ...dataset, points: dataset.points.map(({ month }, index) => ({ month, buy: index === 2 ? null : 10, close: 10 })) }
    const result = simulate(flat, { ...options, withdrawal: { months: 2, monthlyAmount: 60 } })
    expect(result.points.map(({ principal, units, lumpValue }) => [principal, units, lumpValue])).toEqual([[100, 10, 100], [100, 4, 40], [100, 0, 0]])
    expect(result.summary).toMatchObject({ withdrawalStartMonth: '2001-02', depletedMonth: '2001-03', totalWithdrawn: 100 })
    expect(simulate(flat, { ...options, withdrawal: { months: 2, monthlyAmount: 50 } }).summary.depletedMonth).toBeNull()
    expect(simulate(flat, { ...options, withdrawal: { months: 200, monthlyAmount: 1 } }).summary).toMatchObject({ months: 0, withdrawalStartMonth: '2001-01', depletedMonth: '2001-01' })
  })

  it.each([0, -1])('keeps the original series with %i withdrawal months', months => {
    expect(simulate(dataset, { ...options, withdrawal: { months, monthlyAmount: 60 } })).toEqual(simulate(dataset, options))
  })
})
