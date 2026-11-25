import { expect, it } from 'vitest'
import { simulateAll } from './multi'
import { toYearlyCsv, yearlyTotals } from './yearly'

it('adds the last available point per year for each index', () => {
  const index = { id: 'first', name: '', nameEn: '', currency: 'JPY', source: '', sourceUrl: '', retrievedAt: '', notes: [],
    points: ['2000-11', '2000-12', '2001-01'].map(month => ({ month, buy: 10, close: 20 })) }
  const second = { ...index, id: 'second', points: [index.points[0], index.points[2]] }
  const { entries } = simulateAll([index, second], { startYear: 2000, monthlyAmount: 100, fxPoints: [], fxMode: 'neutral' })
  expect(yearlyTotals(entries)).toEqual([{ year: 2000, principal: 150, value: 300, gain: 150, gainRate: 1 },
    { year: 2001, principal: 250, value: 500, gain: 250, gainRate: 1 }])
})

it('formats yen as integers and return as a percentage to one decimal place', () => {
  expect(toYearlyCsv([{ year: 2001, principal: 100.4, value: 99.9, gain: -0.51, gainRate: -0.00512 }])).toBe('年,元本累計,評価額,損益,損益率(%)\n2001,100,100,-1,-0.5')
})
