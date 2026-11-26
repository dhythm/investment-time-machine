import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { datasets, datasetYearRange, fxDataset, indexColors } from './data'
import { monthLabel } from './lib/format'
import { mergeSeries, portfolioSeries, simulateAll, type SimulationEntry } from './lib/multi'
import { clamp } from './lib/types'
import { buildParams, buildScenarioB, parseScenarioB, type Params, maxAmount, maxWithdrawalAmount, maxWithdrawalYears, minAmount, parseParams } from './lib/urlParams'
import { comparisonColumns, comparisonYears, toComparisonCsv, toYearlyCsv, yearlyTotals } from './lib/yearly'
import './App.css'

const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`
const Chart = lazy(() => import('./components/Chart'))
const ScenarioChart = lazy(() => import('./components/Chart').then(module => ({ default: module.ScenarioChart })))
const yearPresets = [[1999, 'ITバブル直前'], [2007, 'リーマンショック直前'], [2019, 'コロナショック直前'], [2020, 'コロナショック後']] as const
const lumpNote = '積立総額と同額を開始初月に一括投資した場合'
const [firstYear, lastYear] = datasetYearRange

function IndexDot({ id }: { id: string }) {
  return <span aria-hidden="true" className="index-dot" style={{ backgroundColor: indexColors[id] }}/>
}

function downloadYearly(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'investment-time-machine-yearly.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function ComparisonTable({ entries, lump }: { entries: SimulationEntry[]; lump: boolean }) {
  const highest = Math.max(...entries.map(entry => entry.result.summary.finalValue))
  return <div className="panel comparison"><table><caption>指数別の比較（開始月を揃えています）</caption>
    <thead><tr>{['指数', '最終評価額', '元本', '損益', '損益率', '倍率', '最大ドローダウン', '積立回数', ...(lump ? ['一括投資の最終評価額'] : [])].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
    <tbody>{entries.map(({ dataset, result: { summary } }) => <tr key={dataset.id} className={summary.finalValue === highest ? 'highest' : undefined}>
      <th scope="row"><IndexDot id={dataset.id}/>{dataset.name}</th><td>{yen(summary.finalValue)}</td><td>{yen(summary.totalPrincipal)}</td>
      <td>{summary.gain > 0 && '+'}{yen(summary.gain)}</td><td>{(summary.gainRate * 100).toFixed(2)}%</td>
      <td>{summary.totalPrincipal ? `${(summary.finalValue / summary.totalPrincipal).toFixed(2)}倍` : '—'}</td><td>{(summary.maxDrawdownRate * 100).toFixed(2)}%</td><td>{summary.months}回</td>
      {lump && <td>{yen(summary.lumpFinalValue)}</td>}
    </tr>)}</tbody>
  </table></div>
}

function ScenarioControls({ params, onChange }: { params: Params; onChange: (next: Params) => void }) {
  const group = useId()
  const [draft, setDraft] = useState(String(params.monthlyAmount))
  const { indexIds, startYear, monthlyAmount, fxMode, lump, basis, allocations, withdrawalYears, withdrawalAmount } = params
  const selected = useMemo(() => datasets.filter(dataset => indexIds.includes(dataset.id)), [indexIds])
  const hasUSD = selected.some(dataset => dataset.currency === 'USD')
  const displayedShares = allocations ?? Object.fromEntries(indexIds.map(id => [id, Number((100 / indexIds.length).toFixed(1))]))
  const allocationTotal = allocations ? indexIds.reduce((sum, id) => sum + allocations[id], 0) : 100
  function setAmount(amount: number) {
    setDraft(String(amount))
    onChange({ ...params, monthlyAmount: amount })
  }
  return <>
    <div className="fields">
      <fieldset className="indices"><legend>対象指数（複数選択可）</legend><div className="chips">{datasets.map(dataset => {
        const checked = indexIds.includes(dataset.id)
        return <label key={dataset.id}><input type="checkbox" checked={checked} disabled={checked && selected.length === 1} onChange={() => {
          onChange({ ...params, allocations: null, indexIds: datasets.filter(item => item.id === dataset.id ? !checked : indexIds.includes(item.id)).map(item => item.id) })
        }}/><IndexDot id={dataset.id}/>{dataset.name}</label>
      })}</div></fieldset>
      {selected.length > 1 && <fieldset className="indices"><legend>積立額・取り崩し額の配分</legend><div className="shares">{selected.map(({ id, name }) =>
        <label key={id}><IndexDot id={id}/>{name}（%）<input type="number" min="0" max="100" step="0.1" value={displayedShares[id]} onChange={event => onChange({ ...params,
          allocations: { ...displayedShares, [id]: clamp(Math.round(Number(event.target.value) * 10) / 10, 0, 100) } })}/></label>)}</div>
        <p>合計：{Number(allocationTotal.toFixed(2))}%</p>
        {Math.abs(allocationTotal - 100) >= 0.05 - Number.EPSILON * 100 && <p role="status">合計が100%ではありません。入力した比率に応じて按分して計算します</p>}
      </fieldset>}
      <div><label>開始年<select value={startYear} onChange={event => onChange({ ...params, startYear: Number(event.target.value) })}>{Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map(year => <option key={year} value={year}>{year}年</option>)}</select></label>
        <div className="presets years">{yearPresets.map(([year, label]) => <button key={year} disabled={year < firstYear || year > lastYear} aria-pressed={year === startYear} onClick={() => onChange({ ...params, startYear: year })}>{label} {year}年</button>)}</div>
      </div>
      <div><label>毎月積立額<span className="amount"><input type="number" min={minAmount} max={maxAmount} value={draft} onChange={event => {
        const raw = event.target.value
        setDraft(raw)
        const number = Number(raw)
        if (Number.isInteger(number) && number >= minAmount && number <= maxAmount) onChange({ ...params, monthlyAmount: number })
      }} onBlur={() => setAmount(draft && Number.isFinite(Number(draft)) ? clamp(Math.round(Number(draft)), minAmount, maxAmount) : monthlyAmount)} /><span>円</span></span></label>
        <div className="presets">{[1, 3, 5, 10].map(amount => <button key={amount} aria-pressed={monthlyAmount === amount * 10000} onClick={() => setAmount(amount * 10000)}>{amount}万円</button>)}</div>
      </div>
      <label>取り崩し期間（年）<input type="number" min="0" max={maxWithdrawalYears} value={withdrawalYears} onChange={event => onChange({ ...params, withdrawalYears: clamp(Math.trunc(Number(event.target.value)), 0, maxWithdrawalYears) })}/></label>
      <label>毎月の取り崩し額（円）<input type="number" min="0" max={maxWithdrawalAmount} value={withdrawalAmount} onChange={event => onChange({ ...params, withdrawalAmount: clamp(Math.trunc(Number(event.target.value)), 0, maxWithdrawalAmount) })}/></label>
      <label>信託報酬（年率 %）<input type="number" min="0" max="5" step="0.01" value={params.feeRate} onChange={event => onChange({ ...params, feeRate: clamp(Math.round(Number(event.target.value) * 100) / 100, 0, 5) })}/></label>
    </div>
    <div className="options">
      <fieldset><legend>価格の基準</legend>{(['price', 'adjusted'] as const).map(mode => <label key={mode}><input type="radio" name={`${group}-basis`} checked={basis === mode} onChange={() => onChange({ ...params, basis: mode })}/>{mode === 'price' ? '価格のみ' : '配当込み（調整後終値）'}</label>)}</fieldset>
      {hasUSD && <fieldset><legend>為替モード</legend>{(['neutral', 'jpy'] as const).map(mode => <label key={mode}><input type="radio" name={`${group}-fx`} checked={fxMode === mode} onChange={() => onChange({ ...params, fxMode: mode })}/>{mode === 'neutral' ? '為替中立' : '円建て（ドル円換算）'}</label>)}</fieldset>}
      <fieldset><legend>積立頻度</legend>{([['monthly', '毎月'], ['bimonthly', '隔月'], ['yearly', '年1回']] as const).map(([frequency, label]) => <label key={frequency}><input type="radio" name={`${group}-frequency`} checked={params.frequency === frequency} onChange={() => onChange({ ...params, frequency })}/>{label}</label>)}
        <p>年間の積立総額は同じで、1回あたりの金額が変わります</p></fieldset>
      <label><input type="checkbox" checked={params.tax} onChange={event => onChange({ ...params, tax: event.target.checked })}/>税金を反映する（特定口座 20.315%）</label>
      <fieldset><legend>インフレ調整</legend>
        <label><input type="checkbox" checked={params.inflation} onChange={event => onChange({ ...params, inflation: event.target.checked })}/>インフレ調整する（実質価値で表示）</label>
        <label>想定インフレ率（年率 %）<input type="number" min="0" max="10" step="0.1" disabled={!params.inflation} value={params.inflationRate} onChange={event => onChange({ ...params, inflationRate: clamp(Math.round(Number(event.target.value) * 10) / 10, 0, 10) })}/></label>
        <p>デフォルトは年率2%。開始時点の購買力にそろえて表示します</p>
      </fieldset>
      <label><input type="checkbox" checked={lump} onChange={event => onChange({ ...params, lump: event.target.checked })}/>一括投資と比較する</label>
    </div>
  </>
}

function runScenario(params: Params) {
  const selected = datasets.filter(dataset => params.indexIds.includes(dataset.id))
  const simulation = simulateAll(selected, { ...params, fxPoints: fxDataset.points, feeRate: params.feeRate / 100,
    inflationRate: params.inflation ? params.inflationRate / 100 : 0,
    withdrawal: { years: params.withdrawalYears, monthlyAmount: params.withdrawalAmount } })
  return { ...simulation, selected }
}

type Scenario = ReturnType<typeof runScenario>

function sumSummary(entries: SimulationEntry[], metric: 'totalWithdrawn' | 'totalTaxPaid' | 'totalPrincipal') {
  return entries.reduce((total, entry) => total + entry.result.summary[metric], 0)
}

function depletionNotes(entries: SimulationEntry[]) {
  return entries.flatMap(({ dataset, result }) => result.summary.depletedMonth ? [`${dataset.name}は${monthLabel(result.summary.depletedMonth)}に資産が尽きました`] : [])
}

function ResultNotes({ params, prefix = '' }: { params: Params; prefix?: string }) {
  return <>
    {params.tax && <p>{prefix}評価額は税引き後（概算）です</p>}
    {params.inflation && <p>{prefix}金額はインフレ調整後の実質価値です（開始時点の購買力に換算し、年率{params.inflationRate}%で割り引いています）</p>}
  </>
}

function SingleResults({ scenario, params }: { scenario: Scenario; params: Params }) {
  const { selected, entries, alignedStartMonth } = scenario
  const { startYear, lump, withdrawalYears } = params
  const rows = useMemo(() => mergeSeries(entries), [entries])
  const depletion = depletionNotes(entries)
  const withdrawalStart = entries.flatMap(({ result }) => result.summary.withdrawalStartMonth ?? []).sort()[0]
  const { points, summary } = entries[0].result
  const positive = summary.gain > 0
  const sign = positive ? '+' : ''
  const lastPoint = points.at(-1)
  const period = lastPoint ? `${monthLabel(points[0].month)} 〜 ${monthLabel(lastPoint.month)}` : '対象データなし'

  return <>
    <ResultNotes params={params}/>
    {alignedStartMonth && alignedStartMonth > `${startYear}-01` && <p>比較のため、全指数のデータが揃う {monthLabel(alignedStartMonth)} 開始に揃えています（指定開始年は {startYear} 年）</p>}
    {entries.length === 1 ? <div className="cards">
      <article className="featured"><h3>最終評価額</h3><strong>{yen(summary.finalValue)}</strong><p>{lastPoint ? `${monthLabel(lastPoint.month)}時点` : '対象データなし'}</p></article>
      {lump && <article><h3>一括投資の最終評価額</h3><strong>{yen(summary.lumpFinalValue)}</strong><p>{lumpNote}</p></article>}
      <article><h3>元本合計</h3><strong>{yen(summary.totalPrincipal)}</strong><p>積み立てた金額</p></article>
      <article className={positive ? 'positive' : summary.gain < 0 ? 'negative' : ''}><h3>損益</h3><strong>{sign}{yen(summary.gain)}</strong><p>{sign}{(summary.gainRate * 100).toFixed(2)}%</p></article>
      <article><h3>積立回数</h3><strong>{summary.months}<span>回</span></strong><p>{period}</p></article>
    </div> : <ComparisonTable entries={entries} lump={lump}/>}
    {withdrawalYears > 0 && <article><h3>取り崩し結果</h3><p>取り崩し開始月：{withdrawalStart ? monthLabel(withdrawalStart) : '対象データなし'}</p>
      <p>取り崩し総額：{yen(sumSummary(entries, 'totalWithdrawn'))}</p>{params.tax && <p>納税額（取り崩し時）：{yen(sumSummary(entries, 'totalTaxPaid'))}</p>}{depletion.length ? depletion.map(text => <p key={text}>{text}</p>) : <p>取り崩し期間が終わるまで資産が残りました</p>}</article>}
    <div className="panel graph"><div className="graph-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>資産の推移</h2></div><div className="legend">{selected.map(dataset => <span key={dataset.id}><IndexDot id={dataset.id}/>{dataset.name}</span>)}<span className="principal">元本</span><span>{lump ? '実線: 積立／破線: 一括' : '実線: 積立'}</span></div></div>
      <Suspense fallback={<div className="plot" role="status">グラフを読み込み中…</div>}><Chart rows={rows} selected={selected} lump={lump} withdrawalStart={withdrawalStart}/></Suspense>
    </div>
  </>
}

function comparisonData({ entries }: Scenario) {
  const series = portfolioSeries(entries)
  const value = series.at(-1)?.value ?? 0
  const principal = sumSummary(entries, 'totalPrincipal')
  const gain = value - principal
  return { series, metrics: [yen(value), yen(principal), yen(gain), `${(principal ? gain / principal * 100 : 0).toFixed(2)}%`,
    yen(sumSummary(entries, 'totalWithdrawn')), yen(sumSummary(entries, 'totalTaxPaid'))],
    values: new Map(entries.map(({ dataset, result }) => [dataset.id, yen(result.summary.finalValue)])) }
}

function ScenarioComparison({ first, second }: { first: Scenario; second: Scenario }) {
  const dataA = useMemo(() => comparisonData(first), [first])
  const dataB = useMemo(() => comparisonData(second), [second])
  const metrics = ['最終評価額（全指数合計）', '元本（合計）', '損益', '損益率', '取り崩し総額', '納税額（取り崩し時）']
  return <>
    <div className="panel comparison"><table><caption>シナリオ比較</caption>
      <thead><tr><th scope="col">指標</th><th scope="col">シナリオA</th><th scope="col">シナリオB</th></tr></thead>
      <tbody>{metrics.map((metric, index) => <tr key={metric}><th scope="row">{metric}</th><td>{dataA.metrics[index]}</td><td>{dataB.metrics[index]}</td></tr>)}
        {datasets.filter(({ id }) => dataA.values.has(id) || dataB.values.has(id)).map(({ id, name }) => <tr key={id}>
          <th scope="row"><IndexDot id={id}/>{name}の最終評価額</th><td>{dataA.values.get(id) ?? '―'}</td><td>{dataB.values.get(id) ?? '―'}</td></tr>)}
      </tbody></table></div>
    {depletionNotes(first.entries).map(text => <p key={text}>シナリオA：{text}</p>)}
    {depletionNotes(second.entries).map(text => <p key={text}>シナリオB：{text}</p>)}
    <div className="panel graph"><div className="graph-heading"><h2>資産の推移</h2><div className="legend">
      <span className="scenario-a">シナリオA</span><span className="scenario-b">シナリオB</span><span>実線：評価額／破線：元本</span></div></div>
      <Suspense fallback={<div className="plot" role="status">グラフを読み込み中…</div>}><ScenarioChart seriesA={dataA.series} seriesB={dataB.series}/></Suspense>
    </div>
  </>
}

function App() {
  const [params, setParams] = useState(() => parseParams(location.search))
  const [initialB] = useState(() => parseScenarioB(location.search))
  const [paramsB, setParamsB] = useState(() => initialB ?? { ...params })
  const [compare, setCompare] = useState(initialB !== null)
  const [notice, setNotice] = useState({ query: '', text: '' })
  const first = useMemo(() => runScenario(params), [params])
  const second = useMemo(() => compare ? runScenario(paramsB) : null, [compare, paramsB])
  const annual = useMemo(() => yearlyTotals(first.entries), [first])
  const annualB = useMemo(() => second && yearlyTotals(second.entries), [second])
  const selected = datasets.filter(dataset => first.selected.includes(dataset) || second?.selected.includes(dataset))
  const showFx = (params.fxMode === 'jpy' && first.selected.some(dataset => dataset.currency === 'USD')) ||
    (paramsB.fxMode === 'jpy' && second?.selected.some(dataset => dataset.currency === 'USD'))
  const query = buildParams(params) + (compare ? `&cmp=1&${buildScenarioB(paramsB)}` : '')
  useEffect(() => { history.replaceState(history.state, '', `${location.pathname}${query}${location.hash}`) }, [query])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setNotice({ query, text: 'コピーしました' })
    } catch {
      setNotice({ query, text: 'アドレスバーのURLをコピーしてください' })
    }
  }
  return <>
    <header><div className="bar"><span className="brand"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#237353"/><path d="M7 15a9 9 0 1 1 3 8M5 11l2 5 5-2m4-6v8l5 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>投資タイムマシン</span><span className="edition">HISTORICAL SIMULATOR</span></div></header>
    <main>
      <div className="intro"><p className="eyebrow">INVESTMENT TIME MACHINE</p><h1>投資タイムマシン</h1><p>あの年から、毎月積み立てていたら？ 過去の指数データで振り返ります。</p></div>
      <section className="panel settings"><h2><small>01</small>積立条件</h2>
        <label className="compare-toggle"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)}/>2つのシナリオを比較する</label>
        <div className={compare ? 'scenario-grid' : undefined}>
          <div>{compare && <h3 className="scenario-a">シナリオA</h3>}<ScenarioControls params={params} onChange={setParams}/></div>
          {compare && <div><h3 className="scenario-b">シナリオB</h3><ScenarioControls params={paramsB} onChange={setParamsB}/></div>}
        </div>
      </section>
      <section><div className="result-heading"><h2><small>02</small>シミュレーション結果</h2><div className="share"><span role="status">{notice.query === query && notice.text}</span><button onClick={copyLink}>リンクをコピー</button></div></div>
        {second ? <>
          <ResultNotes params={params} prefix="シナリオA："/>
          <ResultNotes params={paramsB} prefix="シナリオB："/>
          <ScenarioComparison first={first} second={second}/>
        </> : <SingleResults scenario={first} params={params}/>}
      </section>
      <section className="panel comparison graph" aria-labelledby="yearly-heading"><div className="graph-heading"><h2 id="yearly-heading">年ごとの推移</h2><button onClick={() => downloadYearly(annualB ? toComparisonCsv(annual, annualB) : toYearlyCsv(annual))}>CSVをダウンロード</button></div>
        <table aria-labelledby="yearly-heading"><thead><tr>{(annualB ? comparisonColumns : ['年', '元本累計', '評価額', '損益', '損益率']).map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
          <tbody>{annualB ? comparisonYears(annual, annualB).map(({ year, amounts }) => <tr key={year}><th scope="row">{year}</th>
            {amounts.map((amount, index) => <td key={comparisonColumns[index + 1]}>{amount === undefined ? '―' : yen(amount)}</td>)}</tr>) : annual.map(row => <tr key={row.year}><th scope="row">{row.year}</th><td>{yen(row.principal)}</td><td>{yen(row.value)}</td><td>{yen(row.gain)}</td><td>{(row.gainRate * 100).toFixed(1)}%</td></tr>)}</tbody></table>
      </section>
      <footer><h2>計算の前提とデータ出典</h2><ul>
        <li>各月の月初（最初の営業日）の始値で購入し、月末の終値で評価します。</li><li>価格のみの場合は配当・分配金を含みません。売買手数料は含みません。</li>
        <li>税金は特定口座の税率20.315%を利益分に適用した概算です。取り崩し時に利益分へ課税し、評価額はその時点で全て売却した場合の税引き後で表示します。信託報酬は指定した年率を毎月、口数から差し引いて計算します</li>
        <li>積立頻度を変えても年間の積立総額は同じです（隔月は2か月分、年1回は12か月分を、期間の開始月を起点に投入します）</li>
        <li>インフレ調整をオンにすると、名目値を開始時点の購買力に換算した実質価値で表示します。各時点の金額を、開始から経過した年数分だけ想定インフレ率（デフォルト年率2%）で割り引いて計算します</li>
        <li>配当込みは調整後終値で計算しています（S&P 500は配当込み指数 ^SP500TR を使用）。日経平均は配当込みデータがないため、配当込みモードでも価格ベースで計算します</li>
        <li>複数の指数を比較するときは、指定開始年の1月以降で、選択した全指数のデータが揃う最初の月から積み立てます。単一の指数では、指定開始年の1月よりデータ開始が遅い場合、その指数のデータ開始月から積み立てます。</li>
        <li>為替換算は米ドル建て指数にのみ適用します。円建てモードでは月初のドル円レートで購入し、月末のレートで評価します。為替中立モードでは為替変動を考慮しません。</li>
        <li>一括投資の比較は、{lumpNote}の評価額です。</li>
        {selected.flatMap(dataset => dataset.notes.map(note => <li key={`${dataset.id}-${note}`}>{dataset.name}：{note}</li>))}
      </ul>{selected.map(dataset => <p key={dataset.id}>出典：{dataset.name} ／ <a href={dataset.sourceUrl}>{dataset.source}</a>（取得日：{dataset.retrievedAt}）</p>)}
        {showFx && <p>為替データ：{fxDataset.name} ／ <a href={fxDataset.sourceUrl}>{fxDataset.source}</a>（取得日：{fxDataset.retrievedAt}）</p>}
        <p className="disclaimer">本サービスは過去データによるシミュレーションであり、投資助言ではありません。将来の成果を保証しません</p></footer>
    </main>
  </>
}

export default App
