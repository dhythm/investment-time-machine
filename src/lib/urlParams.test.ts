import { describe, expect, it } from 'vitest'
import { datasets } from '../data'
import { buildParams, parseParams, type Params } from './urlParams'

const defaults: Params = { indexIds: ['sp500'], startYear: 2000, monthlyAmount: 30000, fxMode: 'jpy', lump: false,
  basis: 'price', allocations: null, withdrawalYears: 0, withdrawalAmount: 100000 }

describe('URL parameters', () => {
  it('pairs shares in incoming idx order and round-trips all new parameters', () => {
    const params = parseParams('?idx=nikkei225,sp500&alloc=39.125,60.1&div=1&wy=10&wa=50000')
    expect(params).toEqual({ ...defaults, indexIds: ['sp500', 'nikkei225'], allocations: { nikkei225: 39.125, sp500: 60.1 }, basis: 'adjusted', withdrawalYears: 10, withdrawalAmount: 50000 })
    const query = buildParams(params)
    expect(new URLSearchParams(query).get('alloc')).toBe('60.1,39.13')
    expect(parseParams(query)).toEqual({ ...params, allocations: { sp500: 60.1, nikkei225: 39.13 } })
  })
  it.each(['60', '-5,105', '0,0', '50,', 'Infinity,1', 'x,1'])('ignores invalid allocation %s', alloc => {
    expect(parseParams(`?idx=sp500,nikkei225&alloc=${alloc}`).allocations).toBeNull()
  })
  it('clamps withdrawal settings and omits disabled options', () => {
    expect(parseParams('?wy=51&wa=-1')).toMatchObject({ withdrawalYears: 50, withdrawalAmount: 0 })
    expect(parseParams('?wy=1.2&wa=10000001')).toMatchObject({ withdrawalYears: 0, withdrawalAmount: 10000000 })
    expect(buildParams(defaults)).toBe('?idx=sp500&from=2000&amt=30000')
  })
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
