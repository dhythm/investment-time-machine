import { yearRange, type IndexDataset } from './types'

interface SimulationPoint {
  month: string
  principal: number
  value: number
  units: number
}

export function simulate(dataset: IndexDataset, { startYear, monthlyAmount }: { startYear: number; monthlyAmount: number }) {
  const points: SimulationPoint[] = []
  const summary = { months: 0, totalPrincipal: 0, finalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0 }
  const [first, last] = yearRange(dataset)
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || !Number.isInteger(startYear) || startYear < first || startYear > last) return { points, summary }

  let units = 0
  let peak = 0
  for (const { month, buy, close } of dataset.points) {
    if (month < `${startYear}-01`) continue
    if (buy !== null && buy > 0) {
      units += monthlyAmount / buy
      summary.totalPrincipal += monthlyAmount
      summary.months++
    }
    const value = units * close
    peak = Math.max(peak, value)
    if (peak > 0) summary.maxDrawdownRate = Math.max(summary.maxDrawdownRate, (peak - value) / peak)
    points.push({ month, principal: summary.totalPrincipal, value, units })
    summary.finalValue = value
  }
  summary.gain = summary.finalValue - summary.totalPrincipal
  summary.gainRate = summary.totalPrincipal ? summary.gain / summary.totalPrincipal : 0
  return { points, summary }
}
