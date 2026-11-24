import { describe, expect, it } from 'vitest'
import { mergeSeries, simulateAll } from './multi'
import type { IndexDataset } from './types'

function fixture(id: string, currency: string, months: string[]): IndexDataset {
  return { id, currency, name: id, nameEn: id, source: 'fixture', sourceUrl: '', retrievedAt: '', notes: [],
    points: months.map(month => ({ month, buy: 10, close: 10 })) }
}
const usd = fixture('usd', 'USD', ['2000-12', '2001-01', '2001-03'])
const jpy = fixture('jpy', 'JPY', ['2001-02', '2001-03'])
const options = { startYear: 1999, monthlyAmount: 100, fxMode: 'neutral', fxPoints: usd.points.map(({ month }) => ({ month, buy: 2, close: 3 })) } as const

describe('simulateAll', () => {
  it('clamps each start year and invests only in available months', () => {
    const entries = simulateAll([usd, jpy], options)
    expect(entries.map(({ effectiveStartYear, result: { summary } }) => [effectiveStartYear, summary.months, summary.totalPrincipal])).toEqual([[2000, 3, 300], [2001, 2, 200]])
    expect(simulateAll([usd], { ...options, startYear: 2005 })[0].effectiveStartYear).toBe(2001)
  })
  it('applies FX only to USD indices', () => {
    const neutral = simulateAll([usd, jpy], options)
    const converted = simulateAll([usd, jpy], { ...options, fxMode: 'jpy' })
    expect(neutral[0].result.summary.finalValue).toBe(300)
    expect(converted[0].result.summary.finalValue).toBe(450)
    expect(converted[1]).toEqual(neutral[1])
  })
})

describe('mergeSeries', () => {
  it('merges months in order, omits missing keys and carries the longest principal forward', () => {
    expect(mergeSeries(simulateAll([jpy, usd], options))).toEqual([
      { month: '2000-12', principal: 100, usd: 100, usdLump: 300 },
      { month: '2001-01', principal: 200, usd: 200, usdLump: 300 },
      { month: '2001-02', principal: 200, jpy: 100, jpyLump: 200 },
      { month: '2001-03', principal: 300, usd: 300, usdLump: 300, jpy: 200, jpyLump: 200 },
    ])
  })
  it('uses zero before the first principal of the longest series', () => {
    const earlier = fixture('earlier', 'JPY', ['1999-01'])
    expect(mergeSeries(simulateAll([earlier, usd], options))[0].principal).toBe(0)
  })
})
