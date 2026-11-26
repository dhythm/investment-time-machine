import { describe, expect, it } from 'vitest'
import { mergeSeries, portfolioSeries, simulateAll } from './multi'
import { simulate } from './simulate'
import type { IndexDataset } from './types'

function fixture(id: string, currency: string, months: string[]): IndexDataset {
  return { id, currency, name: id, nameEn: id, source: 'fixture', sourceUrl: '', retrievedAt: '', notes: [],
    points: months.map(month => ({ month, buy: 10, close: 10 })) }
}
const usd = fixture('usd', 'USD', ['2000-12', '2001-01', '2001-02', '2001-03'])
const jpy = fixture('jpy', 'JPY', ['2001-02', '2001-03'])
const options = { startYear: 1999, monthlyAmount: 100, fxMode: 'neutral', fxPoints: usd.points.map(({ month }) => ({ month, buy: 2, close: 3 })) } as const

describe('simulateAll', () => {
  it('discounts every index from the aligned simulation start', () => {
    for (const { result } of simulateAll([usd, jpy], { ...options, inflationRate: 0.12 }).entries) {
      expect(result.points[0]).toMatchObject({ month: '2001-02', principal: 50, value: 50 })
      expect(result.summary.finalValue).toBeCloseTo(100 / 1.12 ** (1 / 12))
    }
  })
  it('forwards taxes, fees and frequency to every index', () => {
    const settings = { tax: true, feeRate: 0.12, frequency: 'bimonthly' } as const
    const selected = [usd, jpy].map(dataset => ({ ...dataset, points: dataset.points.map(point => ({ ...point, close: 20 })) }))
    for (const { dataset, result } of simulateAll(selected, { ...options, ...settings }).entries) {
      expect(result).toEqual(simulate(dataset, { startYear: 2001, startMonth: '2001-02', monthlyAmount: 50, ...settings }))
    }
  })
  it('aligns all contributions to the latest first month', () => {
    const third = fixture('third', 'JPY', ['2001-01', '2001-02', '2001-03'])
    const { entries, alignedStartMonth } = simulateAll([usd, jpy, third], options)
    expect(alignedStartMonth).toBe('2001-02')
    for (const { startMonth, result } of entries) {
      expect(startMonth).toBe(alignedStartMonth)
      expect(result.points[0].month).toBe(startMonth)
      expect(result.summary.months).toBe(2)
      expect(result.summary.totalPrincipal).toBeCloseTo(200 / 3)
    }
  })
  it('uses the requested January when all indices already have data', () => {
    const other = fixture('other', 'JPY', ['2000-11', ...usd.points.map(point => point.month)])
    const { entries, alignedStartMonth } = simulateAll([usd, other], { ...options, startYear: 2001 })
    expect(alignedStartMonth).toBe('2001-01')
    for (const entry of entries) expect(entry.result.points[0].month).toBe(alignedStartMonth)
  })
  it('keeps a single index on its own year-clamped period', () => {
    const { entries, alignedStartMonth } = simulateAll([usd], options)
    expect(alignedStartMonth).toBeNull()
    expect(entries[0]).toMatchObject({ startMonth: '2000-12', result: { summary: { months: 4, totalPrincipal: 400 } } })
    expect(simulateAll([usd], { ...options, startYear: 2005 }).entries[0].startMonth).toBe('2001-01')
  })
  it('applies FX only to USD indices', () => {
    const { entries: neutral } = simulateAll([usd, jpy], options)
    const { entries: converted } = simulateAll([usd, jpy], { ...options, fxMode: 'jpy' })
    expect(neutral[0].result.summary.finalValue).toBe(100)
    expect(converted[0].result.summary.finalValue).toBe(150)
    expect(converted[1]).toEqual(neutral[1])
  })

  it('normalizes allocations and divides one contribution budget', () => {
    for (const [allocations, weights] of [[{ usd: 60, jpy: 40 }, [0.6, 0.4]], [{ usd: 50, jpy: 25 }, [2 / 3, 1 / 3]],
      [{ usd: 0, jpy: 0 }, [0.5, 0.5]], [null, [0.5, 0.5]]] as const) {
      const { entries } = simulateAll([usd, jpy], { ...options, allocations })
      expect(entries.map(entry => entry.weight)).toEqual(weights)
      entries.forEach((entry, index) => expect(entry.result.summary.totalPrincipal).toBeCloseTo(200 * weights[index]))
    }
  })

  it('splits withdrawals using the same weights as contributions', () => {
    const months = ['2000-12', ...Array.from({ length: 12 }, (_, index) => `2001-${String(index + 1).padStart(2, '0')}`)]
    const { entries } = simulateAll(['first', 'second'].map(id => fixture(id, 'JPY', months)), { ...options,
      allocations: { first: 60, second: 40 }, withdrawal: { years: 1, monthlyAmount: 5 } })
    expect(entries.map(entry => entry.result.summary.totalWithdrawn)).toEqual([36, 24])
    expect(entries[0].result.summary.withdrawalStartMonth).toBe('2001-01')
  })

  it('aligns the price-only fallback to the first available adjusted month', () => {
    const adjusted = { ...usd, points: usd.points.map(point => ({ ...point, adjBuy: point.month === '2001-03' ? 5 : null, adjClose: 5 })) }
    const { entries, alignedStartMonth } = simulateAll([adjusted, jpy], { ...options, basis: 'adjusted' })
    expect(alignedStartMonth).toBe('2001-03')
    expect(entries.map(entry => entry.result.points[0].month)).toEqual([alignedStartMonth, alignedStartMonth])
  })
})

describe('mergeSeries', () => {
  it('carries the last value and principal through missing months of the portfolio', () => {
    const sparse = { ...usd, points: [usd.points[0], { ...usd.points[3], close: 20 }] }
    expect(portfolioSeries([jpy, sparse].flatMap(dataset => simulateAll([dataset], options).entries))).toEqual([
      { month: '2000-12', value: 100, principal: 100 },
      { month: '2001-02', value: 200, principal: 200 },
      { month: '2001-03', value: 600, principal: 400 },
    ])
  })
  it('merges months in order, omits missing keys and sums principals across series', () => {
    const sparse = fixture('usd', 'USD', ['2000-12', '2001-01', '2001-03'])
    expect(mergeSeries([jpy, sparse].flatMap(dataset => simulateAll([dataset], options).entries))).toEqual([
      { month: '2000-12', principal: 100, usd: 100, usdLump: 300 },
      { month: '2001-01', principal: 200, usd: 200, usdLump: 300 },
      { month: '2001-02', principal: 300, jpy: 100, jpyLump: 200 },
      { month: '2001-03', principal: 500, usd: 300, usdLump: 300, jpy: 200, jpyLump: 200 },
    ])
  })
  it('counts a series principal from its own first month when summing', () => {
    const earlier = fixture('earlier', 'JPY', ['1999-01'])
    expect(mergeSeries([earlier, usd].flatMap(dataset => simulateAll([dataset], options).entries))[0].principal).toBe(100)
  })
})
