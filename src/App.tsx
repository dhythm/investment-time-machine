import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { datasets, fxDataset, getDataset } from './data'
import { monthLabel } from './lib/format'
import { simulate } from './lib/simulate'
import { yearRange } from './lib/types'
import { buildParams, clamp, maxAmount, minAmount, parseParams } from './lib/urlParams'
import './App.css'

const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`
const Chart = lazy(() => import('./components/Chart'))
const yearPresets = [[1999, 'ITバブル直前'], [2007, 'リーマンショック直前'], [2019, 'コロナショック直前'], [2020, 'コロナショック後']] as const
const lumpNote = '積立総額と同額を開始初月に一括投資した場合'

function App() {
  const [params, setParams] = useState(() => parseParams(location.search))
  const [draft, setDraft] = useState(String(params.monthlyAmount))
  const [notice, setNotice] = useState({ query: '', text: '' })
  const dataset = getDataset(params.indexId) ?? datasets[0]
  const [firstYear, lastYear] = yearRange(dataset)
  const { startYear, monthlyAmount, lump } = params
  const convert = dataset.currency === 'USD' && params.fxMode === 'jpy'
  const { points, summary } = useMemo(() => simulate(dataset, { startYear, monthlyAmount,
    fx: convert ? { mode: 'jpy', points: fxDataset.points } : undefined,
  }), [dataset, startYear, monthlyAmount, convert])
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
  const lastPoint = points.at(-1)
  const period = lastPoint ? `${monthLabel(points[0].month)} 〜 ${monthLabel(lastPoint.month)}` : '対象データなし'

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
          <div><label>開始年<select value={startYear} onChange={event => setParams({ ...params, startYear: Number(event.target.value) })}>{Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map(year => <option key={year} value={year}>{year}年</option>)}</select></label>
            <div className="presets years">{yearPresets.map(([year, label]) => <button key={year} disabled={year < firstYear || year > lastYear} aria-pressed={year === startYear} onClick={() => setParams({ ...params, startYear: year })}>{label} {year}年</button>)}</div>
          </div>
          <div><label>毎月積立額<span className="amount"><input type="number" min={minAmount} max={maxAmount} value={draft} onChange={event => {
            const raw = event.target.value
            setDraft(raw)
            const number = Number(raw)
            if (Number.isInteger(number) && number >= minAmount && number <= maxAmount) setParams({ ...params, monthlyAmount: number })
          }} onBlur={() => setAmount(draft && Number.isFinite(Number(draft)) ? clamp(Math.round(Number(draft)), minAmount, maxAmount) : monthlyAmount)} /><span>円</span></span></label>
            <div className="presets">{[1, 3, 5, 10].map(amount => <button key={amount} aria-pressed={monthlyAmount === amount * 10000} onClick={() => setAmount(amount * 10000)}>{amount}万円</button>)}</div>
          </div>
        </div>
        <div className="options">
          {dataset.currency === 'USD' && <fieldset><legend>為替モード</legend>{(['neutral', 'jpy'] as const).map(mode => <label key={mode}><input type="radio" name="fx" checked={params.fxMode === mode} onChange={() => setParams({ ...params, fxMode: mode })}/>{mode === 'neutral' ? '為替中立' : '円建て（ドル円換算）'}</label>)}</fieldset>}
          <label><input type="checkbox" checked={lump} onChange={event => setParams({ ...params, lump: event.target.checked })}/>一括投資と比較する</label>
        </div>
      </section>
      <section><div className="result-heading"><h2><small>02</small>シミュレーション結果</h2><div className="share"><span role="status">{notice.query === query && notice.text}</span><button onClick={copyLink}>リンクをコピー</button></div></div>
        <div className="cards">
          <article className="featured"><h3>最終評価額</h3><strong>{yen(summary.finalValue)}</strong><p>{lastPoint ? `${monthLabel(lastPoint.month)}時点` : '対象データなし'}</p></article>
          {lump && <article><h3>一括投資の最終評価額</h3><strong>{yen(summary.lumpFinalValue)}</strong><p>{lumpNote}</p></article>}
          <article><h3>元本合計</h3><strong>{yen(summary.totalPrincipal)}</strong><p>積み立てた金額</p></article>
          <article className={positive ? 'positive' : summary.gain < 0 ? 'negative' : ''}><h3>損益</h3><strong>{sign}{yen(summary.gain)}</strong><p>{sign}{(summary.gainRate * 100).toFixed(2)}%</p></article>
          <article><h3>積立月数</h3><strong>{summary.months}<span>か月</span></strong><p>{period}</p></article>
        </div>
        <div className="panel graph"><div className="graph-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>資産の推移</h2></div><div className="legend"><span>評価額</span><span>元本</span>{lump && <span className="lump">一括投資</span>}</div></div>
          <Suspense fallback={<div className="plot" role="status">グラフを読み込み中…</div>}><Chart points={points} lump={lump}/></Suspense>
        </div>
      </section>
      <footer><h2>計算の前提とデータ出典</h2><ul>
        <li>各月の月初（最初の営業日）の始値で購入し、月末の終値で評価します。</li><li>配当・分配金・税金・売買手数料は含みません。</li>
        {dataset.currency === 'USD' && <li>{convert ? '購入時は月初のドル円レート、評価時は月末のドル円レートで円換算します。' : `${dataset.name} は米ドル建てですが、為替変動は考慮せず、積立額（円）をそのまま購入に充てる為替中立の計算です。`}</li>}
        <li>一括投資の比較は、{lumpNote}の評価額です。</li>
        {dataset.notes.map(note => <li key={note}>{note}</li>)}
      </ul><p>出典：{dataset.name} ／ <a href={dataset.sourceUrl}>{dataset.source}</a>（取得日：{dataset.retrievedAt}）</p>
        {convert && <p>為替データ：{fxDataset.name} ／ <a href={fxDataset.sourceUrl}>{fxDataset.source}</a>（取得日：{fxDataset.retrievedAt}）</p>}
        <p className="disclaimer">本サービスは過去データによるシミュレーションであり、投資助言ではありません。将来の成果を保証しません</p></footer>
    </main>
  </>
}

export default App
