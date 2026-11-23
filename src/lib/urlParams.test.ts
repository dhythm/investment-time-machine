import { describe, expect, it } from 'vitest'
import { datasets } from '../data'
import { yearRange } from './types'
import { buildParams, parseParams } from './urlParams'

const defaults = { indexId: 'sp500', startYear: 2000, monthlyAmount: 30000, fxMode: 'neutral', lump: false } as const

describe('URL parameters', () => {
  it('round-trips a shareable query', () => {
    const params = { ...defaults, indexId: 'nikkei225', startYear: 1999, monthlyAmount: 54321 }
    expect(buildParams(params)).toBe('?idx=nikkei225&from=1999&amt=54321')
    expect(parseParams(buildParams(params))).toEqual(params)
  })
  it.each(['fx=jpy', 'lump=1', 'fx=jpy&lump=1'])('round-trips %s', extras => {
    const query = `?idx=acwi&from=2019&amt=30000&${extras}`
    const params = parseParams(query)
    expect(params.fxMode).toBe(extras.includes('fx=jpy') ? 'jpy' : 'neutral')
    expect(params.lump).toBe(extras.includes('lump=1'))
    expect(buildParams(params)).toBe(query)
  })
  it.each(['', '?idx=other&from=200x&amt=NaN', '?from=&amt=', '?from=2e3&amt=2.5', '?fx=JPY&lump=true'])('uses defaults for %s', search => {
    expect(parseParams(search)).toEqual(defaults)
  })
  it('defaults only the invalid field', () => {
    expect(parseParams('?idx=nikkei225&from=unknown&amt=1200')).toEqual({ ...defaults, indexId: 'nikkei225', monthlyAmount: 1200 })
  })
  it.each(datasets)('clamps to the selected range for $id', dataset => {
    const [first, last] = yearRange(dataset)
    expect(parseParams(`?idx=${dataset.id}&from=1&amt=-5`)).toEqual({ ...defaults, indexId: dataset.id, startYear: first, monthlyAmount: 1000 })
    expect(parseParams(`?idx=${dataset.id}&from=9999&amt=9999999`)).toEqual({ ...defaults, indexId: dataset.id, startYear: last, monthlyAmount: 1000000 })
  })
})
