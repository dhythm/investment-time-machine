import { clamp, TAX_RATE, yearRange, type ContributionFrequency, type FxMode, type IndexDataset, type MonthlyPoint, type PriceBasis } from './types'

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
  tax?: boolean
  feeRate?: number
  frequency?: ContributionFrequency
  withdrawal?: { months: number; monthlyAmount: number }
}

export function basisPoints(dataset: IndexDataset, basis?: PriceBasis): MonthlyPoint[] {
  if (basis !== 'adjusted' || !dataset.points.some(point => point.adjClose != null)) return dataset.points
  return dataset.points.flatMap(({ month, adjBuy, adjClose }) => adjBuy != null && adjClose != null ? [{ month, buy: adjBuy, close: adjClose }] : [])
}

export function simulate(dataset: IndexDataset, { startYear, startMonth, monthlyAmount, fx, basis, withdrawal, tax = false, feeRate = 0, frequency = 'monthly' }: Options) {
  const points: SimulationPoint[] = []
  const summary = { months: 0, totalPrincipal: 0, finalValue: 0, lumpFinalValue: 0, gain: 0, gainRate: 0, maxDrawdownRate: 0,
    totalWithdrawn: 0, totalTaxPaid: 0, depletedMonth: null as string | null, withdrawalStartMonth: null as string | null }
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
  const interval = { monthly: 1, bimonthly: 2, yearly: 12 }[frequency]
  const contributions = prices.map(({ buy }, index) => index < withdrawalIndex && index % interval === 0 && buy !== null && buy > 0 ? monthlyAmount * interval : 0)
  const totalPrincipal = contributions.reduce((sum, amount) => sum + amount, 0)
  let lumpUnits = initial && initial.month === period[0].month && initial.buy !== null && initial.buy > 0 ? totalPrincipal / initial.buy : 0
  let units = 0
  let costBasis = 0
  let lumpBasis = totalPrincipal
  const gainTax = (amount: number, cost: number) => tax ? TAX_RATE * Math.max(0, amount - cost) : 0
  let peak = 0
  for (const [index, { month, buy, close }] of prices.entries()) {
    if (withdrawal && index >= withdrawalIndex) {
      const price = buy ?? close
      const available = units * price
      const sold = Math.max(0, Math.min(withdrawal.monthlyAmount, available))
      let saleTax = 0
      if (price > 0) {
        const soldUnits = sold / price
        const soldBasis = sold >= available ? costBasis : costBasis * (soldUnits / units)
        saleTax = gainTax(sold, soldBasis)
        costBasis -= soldBasis
        units = sold >= available ? 0 : units - soldUnits
        lumpBasis = soldUnits >= lumpUnits ? 0 : lumpBasis * (1 - soldUnits / lumpUnits)
        lumpUnits = Math.max(0, lumpUnits - soldUnits)
      }
      summary.totalWithdrawn += sold - saleTax
      summary.totalTaxPaid += saleTax
      if (withdrawal.monthlyAmount - sold > Number.EPSILON * withdrawal.monthlyAmount * 8) summary.depletedMonth ??= month
    } else if (contributions[index] > 0 && buy !== null) {
      units += contributions[index] / buy
      costBasis += contributions[index]
      summary.totalPrincipal += contributions[index]
      summary.months++
    }
    if (feeRate > 0) {
      units *= 1 - feeRate / 12
      lumpUnits *= 1 - feeRate / 12
    }
    const rawValue = units * close
    const value = rawValue - gainTax(rawValue, costBasis)
    peak = Math.max(peak, value)
    if (peak > 0) summary.maxDrawdownRate = Math.max(summary.maxDrawdownRate, (peak - value) / peak)
    const rawLumpValue = lumpUnits * close
    const lumpValue = rawLumpValue - gainTax(rawLumpValue, lumpBasis)
    points.push({ month, principal: summary.totalPrincipal, value, units, lumpValue })
    summary.finalValue = value
    summary.lumpFinalValue = lumpValue
  }
  summary.gain = summary.finalValue - summary.totalPrincipal
  summary.gainRate = summary.totalPrincipal ? summary.gain / summary.totalPrincipal : 0
  return { points, summary }
}
