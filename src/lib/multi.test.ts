import { describe, expect, it } from 'vitest'
import { mergeSeries, simulateAll } from './multi'
import type { IndexDataset } from './types'

function fixture(id: string, currency: string, months: string[]): IndexDataset {
  return { id, currency, name: id, nameEn: id, source: 'fixture', sourceUrl: '', retrievedAt: '', notes: [],
    points: months.map(month => ({ month, buy: 10, close: 10 })) }
}
const usd = fixture('usd', 'USD', ['2000-12', '2001-01', '2001-02', '2001-03'])
const jpy = fixture('jpy', 'JPY', ['2001-02', '2001-03'])
const options = { startYear: 1999, monthlyAmount: 100, fxMode: 'neutral', fxPoints: usd.points.map(({ month }) => ({ month, buy: 2, close: 3 })) } as const

describe('simulateAll', () => {
  it('aligns all contributions to the latest first month', () => {
    const third = fixture('third', 'JPY', ['2001-01', '2001-02', '2001-03'])
    const { entries, alignedStartMonth } = simulateAll([usd, jpy, third], options)
    expect(alignedStartMonth).toBe('2001-02')
    for (const { startMonth, result } of entries) {
      expect(startMonth).toBe(alignedStartMonth)
      expect(result.points[0].month).toBe(startMonth)
      expect(result.summary).toMatchObject({ months: 2, totalPrincipal: 200 })
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
    expect(neutral[0].result.summary.finalValue).toBe(200)
    expect(converted[0].result.summary.finalValue).toBe(300)
    expect(converted[1]).toEqual(neutral[1])
  })
})

describe('mergeSeries', () => {
  it('merges months in order, omits missing keys and carries the longest principal forward', () => {
    const sparse = fixture('usd', 'USD', ['2000-12', '2001-01', '2001-03'])
    expect(mergeSeries([jpy, sparse].flatMap(dataset => simulateAll([dataset], options).entries))).toEqual([
      { month: '2000-12', principal: 100, usd: 100, usdLump: 300 },
      { month: '2001-01', principal: 200, usd: 200, usdLump: 300 },
      { month: '2001-02', principal: 200, jpy: 100, jpyLump: 200 },
      { month: '2001-03', principal: 300, usd: 300, usdLump: 300, jpy: 200, jpyLump: 200 },
    ])
  })
  it('uses zero before the first principal of the longest series', () => {
    const earlier = fixture('earlier', 'JPY', ['1999-01'])
    expect(mergeSeries([earlier, usd].flatMap(dataset => simulateAll([dataset], options).entries))[0].principal).toBe(0)
  })
})
