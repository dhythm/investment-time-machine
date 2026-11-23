import { useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { datasets, getDataset } from './data'
import { simulate } from './lib/simulate'
import { yearRange } from './lib/types'
import { buildParams, clamp, maxAmount, minAmount, parseParams } from './lib/urlParams'
import './App.css'

const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`
const man = (value: number) => `${(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`
const monthLabel = (month: string) => month.replace(/^(\d+)-0?(\d+)$/, '$1年$2月')

function App() {
  const [params, setParams] = useState(() => parseParams(location.search))
  const [draft, setDraft] = useState(String(params.monthlyAmount))
  const [notice, setNotice] = useState({ query: '', text: '' })
  const dataset = getDataset(params.indexId) ?? datasets[0]
  const [firstYear, lastYear] = yearRange(dataset)
  const { startYear, monthlyAmount } = params
  const { points, summary } = useMemo(() => simulate(dataset, { startYear, monthlyAmount }), [dataset, startYear, monthlyAmount])
  const query = buildParams(params)
  useEffect(() => { history.replaceState(history.state, '', `${location.pathname}${query}${location.hash}`) }, [query])

  function setAmount(amount: number) {
    setDraft(String(amount))
    setParams(previous => ({ ...previous, monthlyAmount: amount }))
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setNotice({ query, text: 'コピーしました' })
    } catch {
      setNotice({ query, text: 'アドレスバーのURLをコピーしてください' })
    }
  }
  const positive = summary.gain > 0
  const sign = positive ? '+' : ''
  const period = `${monthLabel(points[0].month)} 〜 ${monthLabel(points[points.length - 1].month)}`
  const ticks = points.filter((point, index) => index === 0 || point.month.endsWith('-01')).map(point => point.month)

  return <>
    <header><div className="bar"><span className="brand"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#237353"/><path d="M7 15a9 9 0 1 1 3 8M5 11l2 5 5-2m4-6v8l5 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>投資タイムマシン</span><span className="edition">HISTORICAL SIMULATOR</span></div></header>
    <main>
      <div className="intro"><p className="eyebrow">INVESTMENT TIME MACHINE</p><h1>投資タイムマシン</h1><p>あの年から、毎月積み立てていたら？ 過去の指数データで振り返ります。</p></div>
      <section className="panel settings"><h2><small>01</small>積立条件</h2>
        <div className="fields">
          <label>対象指数<select value={dataset.id} onChange={event => {
            const next = getDataset(event.target.value)!
            setParams({ ...params, indexId: next.id, startYear: clamp(startYear, ...yearRange(next)) })
          }}>{datasets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>開始年<select value={startYear} onChange={event => setParams({ ...params, startYear: Number(event.target.value) })}>{Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map(year => <option key={year} value={year}>{year}年</option>)}</select></label>
          <div><label>毎月積立額<span className="amount"><input type="number" min={minAmount} max={maxAmount} value={draft} onChange={event => {
            const raw = event.target.value
            setDraft(raw)
            const number = Number(raw)
            if (Number.isInteger(number) && number >= minAmount && number <= maxAmount) setParams({ ...params, monthlyAmount: number })
          }} onBlur={() => setAmount(draft && Number.isFinite(Number(draft)) ? clamp(Math.round(Number(draft)), minAmount, maxAmount) : monthlyAmount)} /><span>円</span></span></label>
            <div className="presets">{[1, 3, 5, 10].map(amount => <button key={amount} aria-pressed={monthlyAmount === amount * 10000} onClick={() => setAmount(amount * 10000)}>{amount}万円</button>)}</div>
          </div>
        </div>
      </section>
      <section><div className="result-heading"><h2><small>02</small>シミュレーション結果</h2><div className="share"><span role="status">{notice.query === query && notice.text}</span><button onClick={copyLink}>リンクをコピー</button></div></div>
        <div className="cards">
          <article className="featured"><h3>最終評価額</h3><strong>{yen(summary.finalValue)}</strong><p>{monthLabel(points[points.length - 1].month)}時点</p></article>
          <article><h3>元本合計</h3><strong>{yen(summary.totalPrincipal)}</strong><p>積み立てた金額</p></article>
          <article className={positive ? 'positive' : summary.gain < 0 ? 'negative' : ''}><h3>損益</h3><strong>{sign}{yen(summary.gain)}</strong><p>{sign}{(summary.gainRate * 100).toFixed(2)}%</p></article>
          <article><h3>積立月数</h3><strong>{summary.months}<span>か月</span></strong><p>{period}</p></article>
        </div>
        <div className="panel graph"><div className="graph-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>資産の推移</h2></div><div className="legend"><span>評価額</span><span>元本</span></div></div>
          <div className="plot"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <defs><linearGradient id="value-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48ac80" stopOpacity={0.28}/><stop offset="100%" stopColor="#48ac80" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid stroke="#e2e9e5" strokeDasharray="3 4" vertical={false}/>
            <XAxis dataKey="month" ticks={ticks} minTickGap={32} tickFormatter={month => String(month).slice(0, 4)} tickLine={false} axisLine={false}/>
            <YAxis tickFormatter={man} width={88} tickLine={false} axisLine={false}/>
            <Tooltip labelFormatter={month => monthLabel(String(month))} formatter={value => man(Number(value))}/>
            <Area dataKey="value" name="評価額" stroke="#217953" strokeWidth={2.4} fill="url(#value-fill)" isAnimationActive={false}/>
            <Line dataKey="principal" name="元本" stroke="#67788e" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false}/>
          </ComposedChart></ResponsiveContainer></div>
        </div>
      </section>
      <footer><h2>計算の前提とデータ出典</h2><ul><li>各月の月初（最初の営業日）の始値で購入し、月末の終値で評価します。</li><li>価格指数を使用し、配当・税金・手数料は含みません。</li><li>S&amp;P 500 は米ドル建て指数ですが、為替変動は考慮せず、積立額（円）をそのまま購入に充てる為替中立の計算です。</li></ul><p>出典：{dataset.name} ／ <a href={dataset.sourceUrl}>{dataset.source}</a>（取得日：{dataset.retrievedAt}）</p><p className="disclaimer">本サービスは過去データによるシミュレーションであり、投資助言ではありません。将来の成果を保証しません</p></footer>
    </main>
  </>
}

export default App
