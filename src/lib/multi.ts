import { simulate } from './simulate'
import { clamp, yearRange, type FxMode, type IndexDataset, type MonthlyPoint } from './types'

interface MultiOptions { startYear: number; monthlyAmount: number; fxMode: FxMode; fxPoints: MonthlyPoint[] }

export function simulateAll(selected: IndexDataset[], { startYear, monthlyAmount, fxMode, fxPoints }: MultiOptions) {
  const alignedStartMonth = selected.length > 1
    ? selected.reduce((latest, dataset) => dataset.points[0].month > latest ? dataset.points[0].month : latest, `${startYear}-01`)
    : null
  const entries = selected.map(dataset => {
    const effectiveStartYear = alignedStartMonth ? Number(alignedStartMonth.slice(0, 4)) : clamp(startYear, ...yearRange(dataset))
    const fx = dataset.currency === 'USD' && fxMode === 'jpy' ? { mode: fxMode, points: fxPoints } : undefined
    const result = simulate(dataset, { startYear: effectiveStartYear, startMonth: alignedStartMonth ?? undefined, monthlyAmount, fx })
    return { dataset, effectiveStartYear, startMonth: alignedStartMonth ?? result.points[0]?.month ?? null, result }
  })
  return { entries, alignedStartMonth }
}

export type SimulationEntry = ReturnType<typeof simulateAll>['entries'][number]
export interface ChartRow { month: string; principal: number; [key: string]: string | number | undefined }

export function mergeSeries(entries: SimulationEntry[]): ChartRow[] {
  const rows = new Map<string, ChartRow>()
  const longest = entries.reduce<SimulationEntry | undefined>((best, entry) => !best || entry.result.points.length > best.result.points.length ? entry : best, undefined)
  const principals = new Map(longest?.result.points.map(point => [point.month, point.principal]))
  for (const { dataset, result } of entries) {
    for (const { month, value, lumpValue } of result.points) {
      const row = rows.get(month) ?? { month, principal: 0 }
      row[dataset.id] = value
      row[`${dataset.id}Lump`] = lumpValue
      rows.set(month, row)
    }
  }
  let principal = 0
  return [...rows.keys()].sort().map(month => {
    principal = principals.get(month) ?? principal
    return { ...rows.get(month)!, principal }
  })
}
