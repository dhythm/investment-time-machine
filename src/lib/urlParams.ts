import { datasets, getDataset } from '../data'
import { yearRange, type FxMode } from './types'

export interface Params { indexId: string; startYear: number; monthlyAmount: number; fxMode: FxMode; lump: boolean }
export const minAmount = 1000
export const maxAmount = 1000000
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function integer(raw: string | null, fallback: number) {
  if (!raw || !/^-?\d+$/.test(raw)) return fallback
  const number = Number(raw)
  return Number.isFinite(number) ? number : fallback
}

export function parseParams(search: string): Params {
  const query = new URLSearchParams(search)
  const dataset = getDataset(query.get('idx') ?? '') ?? datasets[0]
  return {
    indexId: dataset.id,
    startYear: clamp(integer(query.get('from'), 2000), ...yearRange(dataset)),
    monthlyAmount: clamp(integer(query.get('amt'), 30000), minAmount, maxAmount),
    fxMode: query.get('fx') === 'jpy' ? 'jpy' : 'neutral',
    lump: query.get('lump') === '1',
  }
}

export function buildParams({ indexId, startYear, monthlyAmount, fxMode, lump }: Params) {
  const query = new URLSearchParams({ idx: indexId, from: String(startYear), amt: String(monthlyAmount) })
  if (fxMode === 'jpy') query.set('fx', 'jpy')
  if (lump) query.set('lump', '1')
  return `?${query}`
}
