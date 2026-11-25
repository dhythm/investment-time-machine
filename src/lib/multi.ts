import { basisPoints, simulate } from './simulate'
import { clamp, yearRange, type FxMode, type IndexDataset, type MonthlyPoint, type PriceBasis } from './types'

interface MultiOptions { startYear: number; monthlyAmount: number; fxMode: FxMode; fxPoints: MonthlyPoint[]; basis?: PriceBasis;
  allocations?: Record<string, number> | null; withdrawal?: { years: number; monthlyAmount: number } }

export function simulateAll(selected: IndexDataset[], { startYear, monthlyAmount, fxMode, fxPoints, basis, allocations, withdrawal }: MultiOptions) {
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
    const result = simulate(prepared[index], { startYear: effectiveStartYear, startMonth: alignedStartMonth ?? undefined, monthlyAmount: monthlyAmount * weight, fx,
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
  // 元本ラインは全指数の合計（配分が均等でない場合も正しくなるよう、各指数の直近の元本を合算する）
  const principalsByEntry = entries.map(entry => new Map(entry.result.points.map(point => [point.month, point.principal])))
  const lasts = entries.map(() => 0)
  return [...rows.keys()].sort().map(month => {
    let principal = 0
    entries.forEach((_, index) => {
      lasts[index] = principalsByEntry[index].get(month) ?? lasts[index]
      principal += lasts[index]
    })
    return { ...rows.get(month)!, principal }
  })
}
