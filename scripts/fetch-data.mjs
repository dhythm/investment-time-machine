// 月次データセット生成スクリプト
// 無料・キー不要の公開ソースから月次バーを取得し、src/data/*.json を生成する。
// 実行: node scripts/fetch-data.mjs
//
// 指数: Yahoo Finance の chart API（Stooq の CSV は 2026-11 時点でブラウザ検証が
// 必須となりスクリプトから取得できないため代替として使用）
// 為替（ドル円）: FRED（Federal Reserve Economic Data）の DEXJPUS 日次CSVを月次集計
//
// 各月の buy = 月初（最初の営業日）の始値、close = 月末（最後の営業日）の終値。
// 当月（未確定）分は除外する。buy/close は価格ベース（配当・分配金を含まない）。
// 配当込み計算用に adjBuy/adjClose も併記する:
// - ETF（1305, ACWI）: Yahoo の adjclose を adjClose とし、adjBuy は同月の調整比率を始値に掛ける
// - S&P 500: 指数自体の adjclose は価格と同一のため、配当込み指数 ^SP500TR の月次価格を使う（1988-01以降）
// - 日経平均: 配当込み指数の無料データが取得できないため null（アプリ側は価格ベースにフォールバック）

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const INDICES = [
  {
    id: 'sp500',
    symbol: '%5EGSPC',
    name: 'S&P 500',
    nameEn: 'S&P 500',
    currency: 'USD',
    adjSymbol: '%5ESP500TR',
    notes: [
      '価格指数（配当を含まない）',
      '配当込みモードでは配当込み指数「S&P 500 Total Return（^SP500TR）」の価格で計算する（1988年1月以降）',
      '米ドル建て指数。円建てモードではドル円レート（FRED DEXJPUS）で換算する',
    ],
  },
  {
    id: 'nikkei225',
    symbol: '%5EN225',
    name: '日経平均株価',
    nameEn: 'Nikkei 225',
    currency: 'JPY',
    notes: [
      '価格指数（配当を含まない）',
      '配当込み指数の無料月次データが取得できないため、配当込みモードでも価格ベースで計算する',
      '円建て指数',
    ],
  },
  {
    id: 'topix',
    symbol: '1305.T',
    adjMode: 'adjclose',
    name: 'TOPIX（連動ETFで代替）',
    nameEn: 'TOPIX (via ETF 1305)',
    currency: 'JPY',
    notes: [
      'TOPIX指数そのものの無料月次データが取得できないため、TOPIX連動ETF「ダイワ上場投信-TOPIX（1305）」の市場価格で代替（1306は分割で価格系列が不連続だったため1305を採用）',
      'ETFの価格ベース（分配金を含まない）。信託報酬等の影響を受けうる',
      '配当込みモードでは調整後終値（Adj Close、分配金再投資ベース）で計算する',
      'データは2007年12月以降（Yahoo Finance で取得可能な範囲）',
    ],
  },
  {
    id: 'acwi',
    symbol: 'ACWI',
    adjMode: 'adjclose',
    name: '全世界株式（MSCI ACWI連動ETF）',
    nameEn: 'MSCI ACWI (via iShares ACWI ETF)',
    currency: 'USD',
    notes: [
      'MSCIワールド（先進国のみ）ではなく、新興国を含むMSCI ACWIに連動するETF「iShares MSCI ACWI ETF」の価格で代替',
      'ETFの価格ベース（分配金を含まない）。米ドル建て。円建てモードではドル円レート（FRED DEXJPUS）で換算する',
      '配当込みモードでは調整後終値（Adj Close、分配金再投資ベース）で計算する',
      'データは2008年3月以降（ETF設定来）',
    ],
  },
]

const now = new Date()
const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
const retrievedAt = now.toISOString().slice(0, 10)

function round(v) {
  return Math.round(v * 100) / 100
}

function save(data) {
  const out = join(root, 'src', 'data', `${data.id}.json`)
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
  const p = data.points
  console.log(`${data.id}: ${p.length} months, ${p[0].month} .. ${p[p.length - 1].month} -> ${out}`)
}

for (const idx of INDICES) {
  const period2 = Math.floor(now.getTime() / 1000) + 86400
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${idx.symbol}` +
    `?period1=0&period2=${period2}&interval=1mo`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${idx.id}: HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`${idx.id}: no result`)
  const ts = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? []

  // 配当込み指数（adjSymbol）があれば、その月次価格も取得する
  let adjByMonth = null
  if (idx.adjSymbol) {
    const res2 = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${idx.adjSymbol}?period1=0&period2=${period2}&interval=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )
    if (!res2.ok) throw new Error(`${idx.id} adj: HTTP ${res2.status}`)
    const json2 = await res2.json()
    const result2 = json2?.chart?.result?.[0]
    if (!result2) throw new Error(`${idx.id} adj: no result`)
    const ts2 = result2.timestamp ?? []
    const quote2 = result2.indicators?.quote?.[0] ?? {}
    adjByMonth = new Map()
    for (let i = 0; i < ts2.length; i++) {
      const d = new Date(ts2[i] * 1000)
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      const b = quote2.open?.[i]
      const c = quote2.close?.[i]
      if (b != null && c != null && b > 0 && c > 0) adjByMonth.set(month, { buy: round(b), close: round(c) })
    }
  }

  const points = []
  for (let i = 0; i < ts.length; i++) {
    const d = new Date(ts[i] * 1000)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const buy = quote.open?.[i]
    const close = quote.close?.[i]
    if (month >= currentMonth) continue
    if (buy == null || close == null || buy <= 0 || close <= 0) continue
    let adjBuy = null
    let adjClose = null
    if (adjByMonth) {
      const a = adjByMonth.get(month)
      if (a) {
        adjBuy = a.buy
        adjClose = a.close
      }
    } else if (idx.adjMode === 'adjclose' && adj[i] != null && adj[i] > 0) {
      // ETF: adjclose ベース。adjBuy は同月の調整比率（adjclose/close）を始値に掛ける
      adjClose = round(adj[i])
      adjBuy = round(buy * (adj[i] / close))
    }
    points.push({ month, buy: round(buy), close: round(close), adjBuy, adjClose })
  }
  points.sort((a, b) => a.month.localeCompare(b.month))

  save({
    id: idx.id,
    name: idx.name,
    nameEn: idx.nameEn,
    currency: idx.currency,
    source: 'Yahoo Finance (chart API)',
    sourceUrl: `https://finance.yahoo.com/quote/${decodeURIComponent(idx.symbol)}`,
    retrievedAt,
    notes: idx.notes,
    points,
  })
}

// ドル円レート: FRED DEXJPUS（日次、円/ドル、ニューヨーク正午買いレート）を月次集計
// FRED が応答しない場合は既存の usdjpy.json を保持して続行する
try {
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXJPUS&cosd=1985-01-01&coed=2026-12-31'
  // FRED は Node の fetch ではタイムアウトするため curl で取得する（2026-11 時点）
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { stdout: text } = await promisify(execFile)('curl', [
    '-s',
    '--max-time',
    '50',
    '-A',
    'Mozilla/5.0',
    url,
  ])
  if (!text.startsWith('observation_date')) throw new Error('usdjpy: unexpected FRED response')
  const byMonth = new Map()
  for (const line of text.trim().split('\n').slice(1)) {
    const [date, raw] = line.split(',')
    const rate = Number(raw)
    if (!date || !Number.isFinite(rate) || rate <= 0) continue
    const month = date.slice(0, 7)
    if (month >= currentMonth) continue
    const entry = byMonth.get(month) ?? { buy: rate, close: rate }
    entry.close = rate
    byMonth.set(month, entry)
  }
  const points = [...byMonth.entries()]
    .map(([month, v]) => ({ month, buy: round(v.buy), close: round(v.close) }))
    .sort((a, b) => a.month.localeCompare(b.month))

  save({
    id: 'usdjpy',
    name: 'ドル円レート',
    nameEn: 'USD/JPY',
    currency: 'JPY',
    source: 'FRED (Federal Reserve Economic Data), DEXJPUS',
    sourceUrl: 'https://fred.stlouisfed.org/series/DEXJPUS',
    retrievedAt,
    notes: [
      '米ドル/円の正午買いレート（日次）を月次集計：buy=月初のレート、close=月末のレート',
      '円建てモードの換算に使用（購入時は buy、評価時は close で換算）',
    ],
    points,
  })
} catch (error) {
  console.warn(`usdjpy: fetch failed (${error.message}); keeping existing src/data/usdjpy.json`)
}
