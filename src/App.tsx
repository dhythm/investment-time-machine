import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { datasets, datasetYearRange, fxDataset, indexColors } from './data'
import { monthLabel } from './lib/format'
import { mergeSeries, simulateAll, type SimulationEntry } from './lib/multi'
import { clamp } from './lib/types'
import { buildParams, maxAmount, minAmount, parseParams } from './lib/urlParams'
import './App.css'

const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`
const Chart = lazy(() => import('./components/Chart'))
const yearPresets = [[1999, 'ITバブル直前'], [2007, 'リーマンショック直前'], [2019, 'コロナショック直前'], [2020, 'コロナショック後']] as const
const lumpNote = '積立総額と同額を開始初月に一括投資した場合'
const [firstYear, lastYear] = datasetYearRange

function IndexDot({ id }: { id: string }) {
  return <span aria-hidden="true" className="index-dot" style={{ backgroundColor: indexColors[id] }}/>
}

function ComparisonTable({ entries, lump }: { entries: SimulationEntry[]; lump: boolean }) {
  const highest = Math.max(...entries.map(entry => entry.result.summary.finalValue))
  return <div className="panel comparison"><table><caption>指数別の比較（開始月を揃えています）</caption>
    <thead><tr>{['指数', '最終評価額', '元本', '損益', '損益率', '倍率', '最大ドローダウン', '積立月数', ...(lump ? ['一括投資の最終評価額'] : [])].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
    <tbody>{entries.map(({ dataset, result: { summary } }) => <tr key={dataset.id} className={summary.finalValue === highest ? 'highest' : undefined}>
      <th scope="row"><IndexDot id={dataset.id}/>{dataset.name}</th><td>{yen(summary.finalValue)}</td><td>{yen(summary.totalPrincipal)}</td>
      <td>{summary.gain > 0 && '+'}{yen(summary.gain)}</td><td>{(summary.gainRate * 100).toFixed(2)}%</td>
      <td>{summary.totalPrincipal ? `${(summary.finalValue / summary.totalPrincipal).toFixed(2)}倍` : '—'}</td><td>{(summary.maxDrawdownRate * 100).toFixed(2)}%</td><td>{summary.months}か月</td>
      {lump && <td>{yen(summary.lumpFinalValue)}</td>}
    </tr>)}</tbody>
  </table></div>
}

function App() {
  const [params, setParams] = useState(() => parseParams(location.search))
  const [draft, setDraft] = useState(String(params.monthlyAmount))
  const [notice, setNotice] = useState({ query: '', text: '' })
  const { indexIds, startYear, monthlyAmount, fxMode, lump } = params
  const selected = useMemo(() => datasets.filter(dataset => indexIds.includes(dataset.id)), [indexIds])
  const hasUSD = selected.some(dataset => dataset.currency === 'USD')
  const { entries, alignedStartMonth } = useMemo(() => simulateAll(selected, { startYear, monthlyAmount, fxMode, fxPoints: fxDataset.points }), [selected, startYear, monthlyAmount, fxMode])
  const rows = useMemo(() => mergeSeries(entries), [entries])
  const { points, summary } = entries[0].result
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
          <fieldset className="indices"><legend>対象指数（複数選択可）</legend><div className="chips">{datasets.map(dataset => {
            const checked = indexIds.includes(dataset.id)
            return <label key={dataset.id}><input type="checkbox" checked={checked} disabled={checked && selected.length === 1} onChange={() => {
              setParams({ ...params, indexIds: datasets.filter(item => item.id === dataset.id ? !checked : indexIds.includes(item.id)).map(item => item.id) })
            }}/><IndexDot id={dataset.id}/>{dataset.name}</label>
          })}</div></fieldset>
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
          {hasUSD && <fieldset><legend>為替モード</legend>{(['neutral', 'jpy'] as const).map(mode => <label key={mode}><input type="radio" name="fx" checked={fxMode === mode} onChange={() => setParams({ ...params, fxMode: mode })}/>{mode === 'neutral' ? '為替中立' : '円建て（ドル円換算）'}</label>)}</fieldset>}
          <label><input type="checkbox" checked={lump} onChange={event => setParams({ ...params, lump: event.target.checked })}/>一括投資と比較する</label>
        </div>
      </section>
      <section><div className="result-heading"><h2><small>02</small>シミュレーション結果</h2><div className="share"><span role="status">{notice.query === query && notice.text}</span><button onClick={copyLink}>リンクをコピー</button></div></div>
        {alignedStartMonth && alignedStartMonth > `${startYear}-01` && <p>比較のため、全指数のデータが揃う {monthLabel(alignedStartMonth)} 開始に揃えています（指定開始年は {startYear} 年）</p>}
        {entries.length === 1 ? <div className="cards">
          <article className="featured"><h3>最終評価額</h3><strong>{yen(summary.finalValue)}</strong><p>{lastPoint ? `${monthLabel(lastPoint.month)}時点` : '対象データなし'}</p></article>
          {lump && <article><h3>一括投資の最終評価額</h3><strong>{yen(summary.lumpFinalValue)}</strong><p>{lumpNote}</p></article>}
          <article><h3>元本合計</h3><strong>{yen(summary.totalPrincipal)}</strong><p>積み立てた金額</p></article>
          <article className={positive ? 'positive' : summary.gain < 0 ? 'negative' : ''}><h3>損益</h3><strong>{sign}{yen(summary.gain)}</strong><p>{sign}{(summary.gainRate * 100).toFixed(2)}%</p></article>
          <article><h3>積立月数</h3><strong>{summary.months}<span>か月</span></strong><p>{period}</p></article>
        </div> : <ComparisonTable entries={entries} lump={lump}/>}
        <div className="panel graph"><div className="graph-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>資産の推移</h2></div><div className="legend">{selected.map(dataset => <span key={dataset.id}><IndexDot id={dataset.id}/>{dataset.name}</span>)}<span className="principal">元本（最長系列）</span><span>{lump ? '実線: 積立／破線: 一括' : '実線: 積立'}</span></div></div>
          <Suspense fallback={<div className="plot" role="status">グラフを読み込み中…</div>}><Chart rows={rows} selected={selected} lump={lump}/></Suspense>
        </div>
      </section>
      <footer><h2>計算の前提とデータ出典</h2><ul>
        <li>各月の月初（最初の営業日）の始値で購入し、月末の終値で評価します。</li><li>配当・分配金・税金・売買手数料は含みません。</li>
        <li>複数の指数を比較するときは、指定開始年の1月以降で、選択した全指数のデータが揃う最初の月から積み立てます。単一の指数では、指定開始年の1月よりデータ開始が遅い場合、その指数のデータ開始月から積み立てます。</li>
        <li>為替換算は米ドル建て指数にのみ適用します。円建てモードでは月初のドル円レートで購入し、月末のレートで評価します。為替中立モードでは為替変動を考慮しません。</li>
        <li>一括投資の比較は、{lumpNote}の評価額です。</li>
        {selected.flatMap(dataset => dataset.notes.map(note => <li key={`${dataset.id}-${note}`}>{dataset.name}：{note}</li>))}
      </ul>{selected.map(dataset => <p key={dataset.id}>出典：{dataset.name} ／ <a href={dataset.sourceUrl}>{dataset.source}</a>（取得日：{dataset.retrievedAt}）</p>)}
        {hasUSD && fxMode === 'jpy' && <p>為替データ：{fxDataset.name} ／ <a href={fxDataset.sourceUrl}>{fxDataset.source}</a>（取得日：{fxDataset.retrievedAt}）</p>}
        <p className="disclaimer">本サービスは過去データによるシミュレーションであり、投資助言ではありません。将来の成果を保証しません</p></footer>
    </main>
  </>
}

export default App
