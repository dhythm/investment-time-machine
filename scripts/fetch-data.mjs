// 月次データセット生成スクリプト
// Yahoo Finance の chart API（無料・キー不要）から月次バーを取得し、
// src/data/<id>.json を生成する。実行: node scripts/fetch-data.mjs
//
// Stooq の CSV は 2026-11 時点でブラウザ検証（JSチャレンジ）が必須となり
// スクリプトから取得できないため、代替の無料公開ソースとして Yahoo Finance を使う。
//
// 各月の buy = 月初（最初の営業日）の始値、close = 月末（最後の営業日）の終値。
// 当月（未確定）分は除外する。価格指数（配当を含まない）。

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
    notes: [
      '価格指数（配当を含まない）',
      '米ドル建て指数。シミュレーションでは為替変動を考慮せず、積立額（円）をそのまま購入に充てる為替中立の計算とする',
    ],
  },
  {
    id: 'nikkei225',
    symbol: '%5EN225',
    name: '日経平均株価',
    nameEn: 'Nikkei 225',
    currency: 'JPY',
    notes: ['価格指数（配当を含まない）', '円建て指数'],
  },
]

const now = new Date()
const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
const retrievedAt = now.toISOString().slice(0, 10)

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

  const points = []
  for (let i = 0; i < ts.length; i++) {
    const d = new Date(ts[i] * 1000)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const buy = quote.open?.[i]
    const close = quote.close?.[i]
    if (month >= currentMonth) continue // 当月は未確定のため除外
    if (buy == null || close == null || buy <= 0 || close <= 0) continue
    points.push({ month, buy: round(buy), close: round(close) })
  }
  points.sort((a, b) => a.month.localeCompare(b.month))

  const data = {
    id: idx.id,
    name: idx.name,
    nameEn: idx.nameEn,
    currency: idx.currency,
    source: 'Yahoo Finance (chart API)',
    sourceUrl: `https://finance.yahoo.com/quote/${decodeURIComponent(idx.symbol)}`,
    retrievedAt,
    notes: idx.notes,
    points,
  }
  const out = join(root, 'src', 'data', `${idx.id}.json`)
  writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
  console.log(
    `${idx.id}: ${points.length} months, ${points[0].month} .. ${points[points.length - 1].month} -> ${out}`,
  )
}

function round(v) {
  return Math.round(v * 100) / 100
}
