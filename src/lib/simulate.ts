import { yearRange, type FxMode, type IndexDataset, type MonthlyPoint } from './types'

export interface SimulationPoint {
  month: string
  principal: number
  value: number
  lumpValue: number
  units: number
}

interface Options {
  startYear: number
  startMonth?: string
  monthlyAmount: number
  fx?: { mode: FxMode; points: MonthlyPoint[] }
}

export function simulate(dataset: IndexDataset, { startYear, startMonth, monthlyAmount, fx }: Options) {
  const points: SimulationPoint[] = []
  const summary = { months: 0, totalPrincipal: 0, finalValue: 0, lumpFinalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0 }
  const [first, last] = yearRange(dataset)
  const year = startMonth === undefined ? startYear : Number(startMonth.slice(0, 4))
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || !Number.isInteger(year) || year < first || year > last) return { points, summary }

  const rates = fx?.mode === 'jpy' ? new Map(fx.points.map(rate => [rate.month, rate])) : undefined
  const from = startMonth ?? `${startYear}-01`
  const period = dataset.points.filter(point => point.month >= from)
  const prices: MonthlyPoint[] = []
  let totalPrincipal = 0
  for (const point of period) {
    const rate = rates?.get(point.month)
    if (rates && !rate) continue
    const buy = point.buy !== null && (!rate || rate.buy !== null) ? point.buy * (rate?.buy ?? 1) : null
    if (buy !== null && buy > 0) totalPrincipal += monthlyAmount
    prices.push({ month: point.month, buy, close: point.close * (rate?.close ?? 1) })
  }
  const initial = prices[0]
  const lumpUnits = initial && initial.month === period[0].month && initial.buy !== null && initial.buy > 0 ? totalPrincipal / initial.buy : 0
  let units = 0
  let peak = 0
  for (const { month, buy, close } of prices) {
    if (buy !== null && buy > 0) {
      units += monthlyAmount / buy
      summary.totalPrincipal += monthlyAmount
      summary.months++
    }
    const value = units * close
    peak = Math.max(peak, value)
    if (peak > 0) summary.maxDrawdownRate = Math.max(summary.maxDrawdownRate, (peak - value) / peak)
    const lumpValue = lumpUnits * close
    points.push({ month, principal: summary.totalPrincipal, value, units, lumpValue })
    summary.finalValue = value
    summary.lumpFinalValue = lumpValue
  }
  summary.gain = summary.finalValue - summary.totalPrincipal
  summary.gainRate = summary.totalPrincipal ? summary.gain / summary.totalPrincipal : 0
  return { points, summary }
}
