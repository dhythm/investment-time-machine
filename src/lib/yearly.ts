import type { SimulationEntry } from './multi'

interface YearlyRow { year: number; principal: number; value: number; gain: number; gainRate: number }

export function yearlyTotals(entries: SimulationEntry[]): YearlyRow[] {
  const totals = new Map<number, { principal: number; value: number }>()
  for (const { result } of entries) {
    const lastPoints = new Map(result.points.map(point => [Number(point.month.slice(0, 4)), point]))
    for (const [year, point] of lastPoints) {
      const total = totals.get(year) ?? { principal: 0, value: 0 }
      total.principal += point.principal
      total.value += point.value
      totals.set(year, total)
    }
  }
  return [...totals].sort(([first], [second]) => first - second).map(([year, { principal, value }]) => {
    const gain = value - principal
    return { year, principal, value, gain, gainRate: principal ? gain / principal : 0 }
  })
}

export function toYearlyCsv(rows: YearlyRow[]): string {
  return ['年,元本累計,評価額,損益,損益率(%)', ...rows.map(({ year, principal, value, gain, gainRate }) =>
    [year, Math.round(principal), Math.round(value), Math.round(gain), (gainRate * 100).toFixed(1)].join(','))].join('\n')
}
