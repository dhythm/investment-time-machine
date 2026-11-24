import { CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { indexColors } from '../data'
import { monthLabel } from '../lib/format'
import type { ChartRow } from '../lib/multi'
import type { IndexDataset } from '../lib/types'

const man = (value: number) => `${(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`

export default function Chart({ rows, selected, lump }: { rows: ChartRow[]; selected: IndexDataset[]; lump: boolean }) {
  const ticks = rows.filter((point, index) => index === 0 || point.month.endsWith('-01')).map(point => point.month)
  return <div className="plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
    <CartesianGrid stroke="#e2e9e5" strokeDasharray="3 4" vertical={false}/>
    <XAxis dataKey="month" ticks={ticks} minTickGap={32} tickFormatter={month => String(month).slice(0, 4)} tickLine={false} axisLine={false}/>
    <YAxis tickFormatter={man} width={88} tickLine={false} axisLine={false}/>
    <Tooltip labelFormatter={month => monthLabel(String(month))} formatter={value => man(Number(value))}/>
    <Line dataKey="principal" name="元本" stroke="#67788e" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false}/>
    {selected.map(({ id, name }) => <Line key={id} dataKey={id} name={`${name} 積立`} stroke={indexColors[id]} strokeWidth={2.4} dot={false} isAnimationActive={false}/>)}
    {lump && selected.map(({ id, name }) => <Line key={`${id}Lump`} dataKey={`${id}Lump`} name={`${name} 一括`} stroke={indexColors[id]} strokeDasharray="3 4" strokeWidth={2} dot={false} isAnimationActive={false}/>)}
  </LineChart></ResponsiveContainer></div>
}
