import { datasets, datasetYearRange } from '../data'
import { clamp, type FxMode, type PriceBasis } from './types'

export interface Params { indexIds: string[]; startYear: number; monthlyAmount: number; fxMode: FxMode; lump: boolean;
  basis: PriceBasis; allocations: Record<string, number> | null; withdrawalYears: number; withdrawalAmount: number }
export const minAmount = 1000
export const maxAmount = 1000000
export const maxWithdrawalYears = 50
export const maxWithdrawalAmount = 10000000

function integer(raw: string | null, fallback: number) {
  if (!raw || !/^-?\d+$/.test(raw)) return fallback
  const number = Number(raw)
  return Number.isFinite(number) ? number : fallback
}

export function parseParams(search: string): Params {
  const query = new URLSearchParams(search)
  const requested = (query.get('idx') ?? 'sp500').split(',')
  const indexIds = datasets.filter(dataset => requested.includes(dataset.id)).map(dataset => dataset.id)
  const shares = query.get('alloc')?.split(',').map(raw => raw.trim() ? Number(raw) : NaN)
  const allocations = shares && shares.length === requested.length && requested.length === indexIds.length
    && shares.every(share => Number.isFinite(share) && share >= 0) && shares.some(share => share > 0)
    ? Object.fromEntries(requested.map((id, index) => [id, shares[index]])) : null
  return {
    indexIds: indexIds.length ? indexIds : ['sp500'],
    startYear: clamp(integer(query.get('from'), 2000), ...datasetYearRange),
    monthlyAmount: clamp(integer(query.get('amt'), 30000), minAmount, maxAmount),
    fxMode: query.get('fx') === 'neutral' ? 'neutral' : 'jpy',
    lump: query.get('lump') === '1',
    basis: query.get('div') === '1' ? 'adjusted' : 'price', allocations,
    withdrawalYears: clamp(integer(query.get('wy'), 0), 0, maxWithdrawalYears),
    withdrawalAmount: clamp(integer(query.get('wa'), 100000), 0, maxWithdrawalAmount),
  }
}

export function buildParams({ indexIds, startYear, monthlyAmount, fxMode, lump, basis, allocations, withdrawalYears, withdrawalAmount }: Params) {
  const query = new URLSearchParams({ idx: indexIds.join(','), from: String(startYear), amt: String(monthlyAmount) })
  if (fxMode === 'neutral') query.set('fx', 'neutral')
  if (lump) query.set('lump', '1')
  if (basis === 'adjusted') query.set('div', '1')
  if (allocations) query.set('alloc', indexIds.map(id => Number((allocations[id] ?? 0).toFixed(2))).join(','))
  if (withdrawalYears > 0) {
    query.set('wy', String(withdrawalYears))
    query.set('wa', String(withdrawalAmount))
  }
  return `?${query}`
}
