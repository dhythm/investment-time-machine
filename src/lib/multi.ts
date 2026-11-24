import { simulate } from './simulate'
import { clamp, yearRange, type FxMode, type IndexDataset, type MonthlyPoint } from './types'

interface MultiOptions { startYear: number; monthlyAmount: number; fxMode: FxMode; fxPoints: MonthlyPoint[] }

export function simulateAll(selected: IndexDataset[], { startYear, monthlyAmount, fxMode, fxPoints }: MultiOptions) {
  return selected.map(dataset => {
    const effectiveStartYear = clamp(startYear, ...yearRange(dataset))
    const fx = dataset.currency === 'USD' && fxMode === 'jpy' ? { mode: fxMode, points: fxPoints } : undefined
    const result = simulate(dataset, { startYear: effectiveStartYear, monthlyAmount, fx })
    return { dataset, effectiveStartYear, result }
  })
}

export type SimulationEntry = ReturnType<typeof simulateAll>[number]
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
