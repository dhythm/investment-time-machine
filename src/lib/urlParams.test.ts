import { describe, expect, it } from 'vitest'
import { datasets } from '../data'
import { buildParams, parseParams, type Params } from './urlParams'

const defaults: Params = { indexIds: ['sp500'], startYear: 2000, monthlyAmount: 30000, fxMode: 'jpy', lump: false }

describe('URL parameters', () => {
  it('round-trips a shareable query', () => {
    const params = { ...defaults, indexIds: ['sp500', 'nikkei225'], startYear: 1999, monthlyAmount: 54321 }
    expect(buildParams(params)).toBe('?idx=sp500%2Cnikkei225&from=1999&amt=54321')
    expect(parseParams(buildParams(params))).toEqual(params)
  })
  it('keeps each known id once in dataset order', () => {
    expect(parseParams('?idx=acwi,other,nikkei225,sp500,acwi').indexIds).toEqual(['sp500', 'nikkei225', 'acwi'])
  })
  it('opens explicit fx=jpy links and omits fx when sharing them again', () => {
    const params = parseParams('?fx=jpy')
    expect(params.fxMode).toBe('jpy')
    expect(new URLSearchParams(buildParams(params)).has('fx')).toBe(false)
  })
  it.each(['fx=neutral', 'lump=1', 'fx=neutral&lump=1'])('round-trips %s', extras => {
    const query = `?idx=acwi&from=2019&amt=30000&${extras}`
    const params = parseParams(query)
    expect(params.fxMode).toBe(extras.includes('fx=neutral') ? 'neutral' : 'jpy')
    expect(params.lump).toBe(extras.includes('lump=1'))
    expect(buildParams(params)).toBe(query)
  })
  it.each(['', '?idx=', '?idx=,,', '?idx=other&from=200x&amt=NaN', '?from=&amt=', '?from=2e3&amt=2.5', '?fx=JPY&lump=true'])('uses defaults for %s', search => {
    expect(parseParams(search)).toEqual(defaults)
  })
  it('defaults only the invalid field', () => {
    expect(parseParams('?idx=nikkei225&from=unknown&amt=1200')).toEqual({ ...defaults, indexIds: ['nikkei225'], monthlyAmount: 1200 })
  })
  it.each(datasets)('uses the global year range for $id', dataset => {
    const last = Math.max(...datasets.map(item => Number(item.points.at(-1)!.month.slice(0, 4))))
    expect(parseParams(`?idx=${dataset.id}&from=1&amt=-5`)).toEqual({ ...defaults, indexIds: [dataset.id], startYear: 1984, monthlyAmount: 1000 })
    expect(parseParams(`?idx=${dataset.id}&from=9999&amt=9999999`)).toEqual({ ...defaults, indexIds: [dataset.id], startYear: last, monthlyAmount: 1000000 })
  })
})
