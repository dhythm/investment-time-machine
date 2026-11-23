import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthLabel } from '../lib/format'
import type { SimulationPoint } from '../lib/simulate'

const man = (value: number) => `${(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`

export default function Chart({ points, lump }: { points: SimulationPoint[]; lump: boolean }) {
  const ticks = points.filter((point, index) => index === 0 || point.month.endsWith('-01')).map(point => point.month)
  return <div className="plot"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
    <defs><linearGradient id="value-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48ac80" stopOpacity={0.28}/><stop offset="100%" stopColor="#48ac80" stopOpacity={0.02}/></linearGradient></defs>
    <CartesianGrid stroke="#e2e9e5" strokeDasharray="3 4" vertical={false}/>
    <XAxis dataKey="month" ticks={ticks} minTickGap={32} tickFormatter={month => String(month).slice(0, 4)} tickLine={false} axisLine={false}/>
    <YAxis tickFormatter={man} width={88} tickLine={false} axisLine={false}/>
    <Tooltip labelFormatter={month => monthLabel(String(month))} formatter={value => man(Number(value))}/>
    <Area dataKey="value" name="評価額" stroke="#217953" strokeWidth={2.4} fill="url(#value-fill)" isAnimationActive={false}/>
    <Line dataKey="principal" name="元本" stroke="#67788e" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false}/>
    {lump && <Line dataKey="lumpValue" name="一括投資" stroke="#a45723" strokeDasharray="3 4" strokeWidth={2} dot={false} isAnimationActive={false}/>}
  </ComposedChart></ResponsiveContainer></div>
}
