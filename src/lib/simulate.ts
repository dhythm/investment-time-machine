import { clamp, yearRange, type FxMode, type IndexDataset, type MonthlyPoint, type PriceBasis } from './types'

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
  basis?: PriceBasis
  withdrawal?: { months: number; monthlyAmount: number }
}

export function basisPoints(dataset: IndexDataset, basis?: PriceBasis): MonthlyPoint[] {
  if (basis !== 'adjusted' || !dataset.points.some(point => point.adjClose != null)) return dataset.points
  return dataset.points.flatMap(({ month, adjBuy, adjClose }) => adjBuy != null && adjClose != null ? [{ month, buy: adjBuy, close: adjClose }] : [])
}

export function simulate(dataset: IndexDataset, { startYear, startMonth, monthlyAmount, fx, basis, withdrawal }: Options) {
  const points: SimulationPoint[] = []
  const summary = { months: 0, totalPrincipal: 0, finalValue: 0, lumpFinalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0,
    totalWithdrawn: 0, depletedMonth: null as string | null, withdrawalStartMonth: null as string | null }
  const [first, last] = yearRange(dataset)
  const year = startMonth === undefined ? startYear : Number(startMonth.slice(0, 4))
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || !Number.isInteger(year) || year < first || year > last) return { points, summary }

  const rates = fx?.mode === 'jpy' ? new Map(fx.points.map(rate => [rate.month, rate])) : undefined
  const from = startMonth ?? `${startYear}-01`
  const period = basisPoints(dataset, basis).filter(point => point.month >= from)
  const prices: MonthlyPoint[] = []
  for (const point of period) {
    const rate = rates?.get(point.month)
    if (rates && !rate) continue
    const buy = point.buy !== null && (!rate || rate.buy !== null) ? point.buy * (rate?.buy ?? 1) : null
    prices.push({ month: point.month, buy, close: point.close * (rate?.close ?? 1) })
  }
  const initial = prices[0]
  const withdrawalIndex = prices.length - clamp(Math.trunc(withdrawal?.months ?? 0), 0, prices.length)
  summary.withdrawalStartMonth = prices[withdrawalIndex]?.month ?? null
  const totalPrincipal = prices.slice(0, withdrawalIndex).reduce((sum, { buy }) => buy !== null && buy > 0 ? sum + monthlyAmount : sum, 0)
  let lumpUnits = initial && initial.month === period[0].month && initial.buy !== null && initial.buy > 0 ? totalPrincipal / initial.buy : 0
  let units = 0
  let peak = 0
  for (const [index, { month, buy, close }] of prices.entries()) {
    if (withdrawal && index >= withdrawalIndex) {
      const price = buy ?? close
      const available = units * price
      const sold = Math.max(0, Math.min(withdrawal.monthlyAmount, available))
      if (price > 0) {
        units = sold >= available ? 0 : units - sold / price
        lumpUnits = Math.max(0, lumpUnits - sold / price)
      }
      summary.totalWithdrawn += sold
      if (withdrawal.monthlyAmount - sold > Number.EPSILON * withdrawal.monthlyAmount * 8) summary.depletedMonth ??= month
    } else if (buy !== null && buy > 0) {
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
