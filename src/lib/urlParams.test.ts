import { describe, expect, it } from 'vitest'
import { datasets } from '../data'
import { yearRange } from './types'
import { buildParams, parseParams } from './urlParams'

const defaults = { indexId: 'sp500', startYear: 2000, monthlyAmount: 30000 }

describe('URL parameters', () => {
  it('round-trips a shareable query', () => {
    const params = { indexId: 'nikkei225', startYear: 1999, monthlyAmount: 54321 }
    expect(buildParams(params)).toBe('?idx=nikkei225&from=1999&amt=54321')
    expect(parseParams(buildParams(params))).toEqual(params)
  })
  it.each(['', '?idx=other&from=200x&amt=NaN', '?from=&amt=', '?from=2e3&amt=2.5'])('uses defaults for %s', search => {
    expect(parseParams(search)).toEqual(defaults)
  })
  it('defaults only the invalid field', () => {
    expect(parseParams('?idx=nikkei225&from=unknown&amt=1200')).toEqual({ indexId: 'nikkei225', startYear: 2000, monthlyAmount: 1200 })
  })
  it.each(datasets)('clamps to the selected range for $id', dataset => {
    const [first, last] = yearRange(dataset)
    expect(parseParams(`?idx=${dataset.id}&from=1&amt=-5`)).toEqual({ indexId: dataset.id, startYear: first, monthlyAmount: 1000 })
    expect(parseParams(`?idx=${dataset.id}&from=9999&amt=9999999`)).toEqual({ indexId: dataset.id, startYear: last, monthlyAmount: 1000000 })
  })
})
