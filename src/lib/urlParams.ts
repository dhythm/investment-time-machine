import { datasets, datasetYearRange } from '../data'
import { clamp, type ContributionFrequency, type FxMode, type PriceBasis } from './types'

export interface Params { indexIds: string[]; startYear: number; monthlyAmount: number; fxMode: FxMode; lump: boolean;
  basis: PriceBasis; allocations: Record<string, number> | null; withdrawalYears: number; withdrawalAmount: number;
  tax: boolean; feeRate: number; inflation: boolean; inflationRate: number; frequency: ContributionFrequency }
export type ScenarioParams = Params
export const minAmount = 1000
export const maxAmount = 1000000
export const maxWithdrawalYears = 50
export const maxWithdrawalAmount = 10000000
const defaultWithdrawalAmount = 100000
const defaultInflationRate = 2

function integer(raw: string | null, fallback: number) {
  if (!raw || !/^-?\d+$/.test(raw)) return fallback
  const number = Number(raw)
  return Number.isFinite(number) ? number : fallback
}

export function parseParams(search: string): Params {
  return readParams(new URLSearchParams(search))
}

function readParams(query: URLSearchParams): Params {
  const requested = (query.get('idx') ?? 'sp500').split(',')
  const indexIds = datasets.filter(dataset => requested.includes(dataset.id)).map(dataset => dataset.id)
  const shares = query.get('alloc')?.split(',').map(raw => raw.trim() ? Number(raw) : NaN)
  const allocations = shares && shares.length === requested.length && requested.length === indexIds.length
    && shares.every(share => Number.isFinite(share) && share >= 0) && shares.some(share => share > 0)
    ? Object.fromEntries(requested.map((id, index) => [id, shares[index]])) : null
  const fee = Number(query.get('fee'))
  const inflationRate = Number(query.get('irate')?.trim() || NaN)
  const freq = query.get('freq')
  return {
    indexIds: indexIds.length ? indexIds : ['sp500'],
    startYear: clamp(integer(query.get('from'), 2000), ...datasetYearRange),
    monthlyAmount: clamp(integer(query.get('amt'), 30000), minAmount, maxAmount),
    fxMode: query.get('fx') === 'neutral' ? 'neutral' : 'jpy',
    lump: query.get('lump') === '1',
    basis: query.get('div') === '1' ? 'adjusted' : 'price', allocations,
    withdrawalYears: clamp(integer(query.get('wy'), 0), 0, maxWithdrawalYears),
    withdrawalAmount: clamp(integer(query.get('wa'), defaultWithdrawalAmount), 0, maxWithdrawalAmount),
    tax: query.get('tax') === '1',
    inflation: query.get('inf') === '1',
    inflationRate: Number.isFinite(inflationRate) && inflationRate >= 0 && inflationRate <= 10 ? inflationRate : defaultInflationRate,
    feeRate: Number.isFinite(fee) && fee >= 0 && fee <= 5 ? fee : 0,
    frequency: freq === '2' ? 'bimonthly' : freq === 'y' ? 'yearly' : 'monthly',
  }
}

function scenarioFromQuery(query: URLSearchParams): ScenarioParams | null {
  if (!query.has('bidx')) return null
  const scenario = new URLSearchParams()
  query.forEach((value, key) => {
    if (key.startsWith('b')) scenario.append(key.slice(1), value)
  })
  return readParams(scenario)
}

export function parseScenario(search: string): ScenarioParams | null {
  return scenarioFromQuery(new URLSearchParams(search))
}

export function parseScenarioB(search: string): ScenarioParams | null {
  const query = new URLSearchParams(search)
  return query.get('cmp') === '1' ? scenarioFromQuery(query) : null
}

function writeParams({ indexIds, startYear, monthlyAmount, fxMode, lump, basis, allocations, withdrawalYears, withdrawalAmount, tax, feeRate, frequency, inflation, inflationRate }: Params) {
  const query = new URLSearchParams({ idx: indexIds.join(','), from: String(startYear), amt: String(monthlyAmount) })
  if (fxMode === 'neutral') query.set('fx', 'neutral')
  if (lump) query.set('lump', '1')
  if (basis === 'adjusted') query.set('div', '1')
  if (allocations) query.set('alloc', indexIds.map(id => Number((allocations[id] ?? 0).toFixed(2))).join(','))
  if (withdrawalYears > 0) {
    query.set('wy', String(withdrawalYears))
    query.set('wa', String(withdrawalAmount))
  }
  if (tax) query.set('tax', '1')
  if (feeRate > 0) query.set('fee', String(Number(feeRate.toFixed(2))))
  if (frequency === 'bimonthly') query.set('freq', '2')
  if (frequency === 'yearly') query.set('freq', 'y')
  if (inflation) query.set('inf', '1')
  if (inflationRate !== defaultInflationRate) query.set('irate', String(inflationRate))
  return query
}

export function buildParams(params: Params) {
  return `?${writeParams(params)}`
}

export function buildScenarioB(params: ScenarioParams) {
  const query = writeParams(params)
  if (params.withdrawalAmount === defaultWithdrawalAmount) query.delete('wa')
  else query.set('wa', String(params.withdrawalAmount))
  const scenario = new URLSearchParams()
  query.forEach((value, key) => scenario.set(`b${key}`, value))
  return scenario.toString()
}
