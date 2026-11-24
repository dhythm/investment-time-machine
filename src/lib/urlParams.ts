import { datasets, datasetYearRange } from '../data'
import { clamp, type FxMode } from './types'

export interface Params { indexIds: string[]; startYear: number; monthlyAmount: number; fxMode: FxMode; lump: boolean }
export const minAmount = 1000
export const maxAmount = 1000000

function integer(raw: string | null, fallback: number) {
  if (!raw || !/^-?\d+$/.test(raw)) return fallback
  const number = Number(raw)
  return Number.isFinite(number) ? number : fallback
}

export function parseParams(search: string): Params {
  const query = new URLSearchParams(search)
  const requested = new Set(query.get('idx')?.split(','))
  const indexIds = datasets.filter(dataset => requested.has(dataset.id)).map(dataset => dataset.id)
  return {
    indexIds: indexIds.length ? indexIds : ['sp500'],
    startYear: clamp(integer(query.get('from'), 2000), ...datasetYearRange),
    monthlyAmount: clamp(integer(query.get('amt'), 30000), minAmount, maxAmount),
    fxMode: query.get('fx') === 'neutral' ? 'neutral' : 'jpy',
    lump: query.get('lump') === '1',
  }
}

export function buildParams({ indexIds, startYear, monthlyAmount, fxMode, lump }: Params) {
  const query = new URLSearchParams({ idx: indexIds.join(','), from: String(startYear), amt: String(monthlyAmount) })
  if (fxMode === 'neutral') query.set('fx', 'neutral')
  if (lump) query.set('lump', '1')
  return `?${query}`
}
