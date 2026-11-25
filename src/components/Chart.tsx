import { CartesianGrid, LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { indexColors } from '../data'
import { monthLabel } from '../lib/format'
import type { ChartRow, portfolioSeries } from '../lib/multi'
import type { ReactNode } from 'react'
import type { IndexDataset } from '../lib/types'

const man = (value: number) => `${(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`

function Plot({ rows, children }: { rows: { month: string }[]; children: ReactNode }) {
  const ticks = rows.filter((point, index) => index === 0 || point.month.endsWith('-01')).map(point => point.month)
  return <div className="plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
    <CartesianGrid stroke="#e2e9e5" strokeDasharray="3 4" vertical={false}/>
    <XAxis dataKey="month" ticks={ticks} minTickGap={32} tickFormatter={month => String(month).slice(0, 4)} tickLine={false} axisLine={false}/>
    <YAxis tickFormatter={man} width={88} tickLine={false} axisLine={false}/>
    <Tooltip labelFormatter={month => monthLabel(String(month))} formatter={value => man(Number(value))}/>
    {children}
  </LineChart></ResponsiveContainer></div>
}

export default function Chart({ rows, selected, lump, withdrawalStart }: { rows: ChartRow[]; selected: IndexDataset[]; lump: boolean; withdrawalStart?: string }) {
  return <Plot rows={rows}>
    {withdrawalStart && <ReferenceLine x={withdrawalStart} stroke="#87642e" strokeDasharray="4 3" label={{ value: '取り崩し開始', position: 'insideTop' }}/>}
    <Line dataKey="principal" name="元本" stroke="#67788e" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false}/>
    {selected.map(({ id, name }) => <Line key={id} dataKey={id} name={`${name} 積立`} stroke={indexColors[id]} strokeWidth={2.4} dot={false} isAnimationActive={false}/>)}
    {lump && selected.map(({ id, name }) => <Line key={`${id}Lump`} dataKey={`${id}Lump`} name={`${name} 一括`} stroke={indexColors[id]} strokeDasharray="3 4" strokeWidth={2} dot={false} isAnimationActive={false}/>)}
  </Plot>
}

type Portfolio = ReturnType<typeof portfolioSeries>

export function ScenarioChart({ seriesA, seriesB }: { seriesA: Portfolio; seriesB: Portfolio }) {
  const byMonthA = new Map(seriesA.map(point => [point.month, point]))
  const byMonthB = new Map(seriesB.map(point => [point.month, point]))
  const rows = [...new Set([...byMonthA.keys(), ...byMonthB.keys()])].sort().map(month =>
    ({ month, scenarioA: byMonthA.get(month), scenarioB: byMonthB.get(month) }))
  return <Plot rows={rows}>
    {(['A', 'B'] as const).flatMap(scenario => ['principal', 'value'].map(metric => {
      const principal = metric === 'principal'
      return <Line key={`${scenario}-${metric}`} dataKey={`scenario${scenario}.${metric}`} name={`${principal ? '元本' : '評価額'}${scenario}`}
        stroke={scenario === 'A' ? '#217953' : '#9333ea'} strokeDasharray={principal ? '6 4' : undefined}
        strokeWidth={principal ? 2 : 2.4} dot={false} isAnimationActive={false}/>
    }))}
  </Plot>
}
