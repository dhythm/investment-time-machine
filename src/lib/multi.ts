import { basisPoints, simulate } from './simulate'
import { clamp, yearRange, type ContributionFrequency, type FxMode, type IndexDataset, type MonthlyPoint, type PriceBasis } from './types'

interface MultiOptions { startYear: number; monthlyAmount: number; fxMode: FxMode; fxPoints: MonthlyPoint[]; basis?: PriceBasis;
  tax?: boolean; feeRate?: number; frequency?: ContributionFrequency;
  allocations?: Record<string, number> | null; withdrawal?: { years: number; monthlyAmount: number } }

export function simulateAll(selected: IndexDataset[], { startYear, monthlyAmount, fxMode, fxPoints, basis, allocations, withdrawal, tax, feeRate, frequency }: MultiOptions) {
  const prepared = selected.map(dataset => ({ ...dataset, points: basisPoints(dataset, basis) }))
  const amounts = selected.map(({ id }) => Math.max(0, allocations?.[id] ?? 0))
  const largest = Math.max(0, ...amounts)
  const shares = largest > Number.MAX_VALUE / selected.length ? amounts.map(amount => amount / largest) : amounts
  const total = shares.reduce((sum, share) => sum + share, 0)
  const alignedStartMonth = selected.length > 1
    ? prepared.reduce((latest, dataset) => dataset.points[0]?.month > latest ? dataset.points[0].month : latest, `${startYear}-01`)
    : null
  const entries = selected.map((dataset, index) => {
    const weight = total > 0 ? shares[index] / total : 1 / selected.length
    const effectiveStartYear = alignedStartMonth ? Number(alignedStartMonth.slice(0, 4)) : clamp(startYear, ...yearRange(prepared[index]))
    const fx = dataset.currency === 'USD' && fxMode === 'jpy' ? { mode: fxMode, points: fxPoints } : undefined
    const result = simulate(prepared[index], { startYear: effectiveStartYear, startMonth: alignedStartMonth ?? undefined, monthlyAmount: monthlyAmount * weight, fx, tax, feeRate, frequency,
      withdrawal: withdrawal && { months: withdrawal.years * 12, monthlyAmount: withdrawal.monthlyAmount * weight } })
    return { dataset, weight, effectiveStartYear, startMonth: alignedStartMonth ?? result.points[0]?.month ?? null, result }
  })
  return { entries, alignedStartMonth }
}

export type SimulationEntry = ReturnType<typeof simulateAll>['entries'][number]
export interface ChartRow { month: string; principal: number; [key: string]: string | number | undefined }

export function mergeSeries(entries: SimulationEntry[]): ChartRow[] {
  const rows = new Map<string, ChartRow>()
  for (const { dataset, result } of entries) {
    for (const { month, value, lumpValue } of result.points) {
      const row = rows.get(month) ?? { month, principal: 0 }
      row[dataset.id] = value
      row[`${dataset.id}Lump`] = lumpValue
      rows.set(month, row)
    }
  }
  return portfolioSeries(entries).map(({ month, principal }) => ({ ...rows.get(month)!, principal }))
}

export function portfolioSeries(entries: SimulationEntry[]) {
  const series = entries.map(entry => new Map(entry.result.points.map(point => [point.month, point])))
  const months = new Set(series.flatMap(points => [...points.keys()]))
  const latest = entries.map(() => ({ principal: 0, value: 0 }))
  return [...months].sort().map(month => {
    let principal = 0
    let value = 0
    series.forEach((points, index) => {
      latest[index] = points.get(month) ?? latest[index]
      principal += latest[index].principal
      value += latest[index].value
    })
    return { month, value, principal }
  })
}
