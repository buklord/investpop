import { NextResponse } from 'next/server'
import { BASE_PRICES } from '@/lib/marketSimulator'

// Server-side cache (best-effort; resets on cold starts)
const CACHE_TTL_MS = 60_000
const CACHE = globalThis.__INVESTPOP_CANDLE_CACHE || (globalThis.__INVESTPOP_CANDLE_CACHE = new Map())

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=60'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function getBasePrice(symbol) {
  const sym = String(symbol || '').toUpperCase()
  return Number(BASE_PRICES[sym]) || 1
}

// Stable pseudo-random in [0, 1) for a string key.
// This is intentionally stateless so adding more history doesn't change newer candles.
function unitRand(key) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h
    h = Math.imul(h, 16777619)
  }
  // xorshift32 mix
  h ^= h << 13
  h ^= h >>> 17
  h ^= h << 5
  return ((h >>> 0) / 4294967296)
}

function generateCandles({ symbol, tfSecs, limit }) {
  const sym = String(symbol || '').toUpperCase()

  const nowSec = Math.floor(Date.now() / 1000)
  const end = Math.floor(nowSec / tfSecs) * tfSecs
  const start = end - limit * tfSecs

  const base = getBasePrice(sym)

  // Volatility scales by asset type (simple heuristics)
  const isFx = sym.length === 6 && /[A-Z]{6}/.test(sym)
  const isIndex = /\d/.test(sym)
  const vol = isFx ? 0.0008 : isIndex ? 0.002 : 0.004
  const candles = []

  function priceAt(t) {
    const k = `${sym}:${tfSecs}:${t}`
    const n1 = unitRand(`${k}:n1`) - 0.5
    const n2 = unitRand(`${k}:n2`) - 0.5

    // Slow oscillation + noise; keep it subtle so it doesn't look ridiculous.
    const wave = Math.sin(t / (tfSecs * 22)) * 0.6 + Math.sin(t / (tfSecs * 67)) * 0.4
    const pct = (wave * vol * 18) + (n1 * vol * 10) + (n2 * vol * 4)

    return Math.max(0.000001, base * (1 + pct))
  }

  for (let t = start; t < end; t += tfSecs) {
    const open = priceAt(t)
    const close = priceAt(t + Math.floor(tfSecs * 0.85))

    const wickBase = Math.max(open, close)
    const w = Math.abs(unitRand(`${sym}:${tfSecs}:${t}:w`) - 0.5)
    const wick = w * vol * wickBase * 6
    const high = Math.max(open, close) + wick
    const low = Math.max(0.000001, Math.min(open, close) - wick)

    // Pseudo-random volume correlated with candle body size (bigger moves = more volume)
    const bodyPct = Math.abs(close - open) / open
    const volNoise = 0.4 + unitRand(`${sym}:${tfSecs}:${t}:vol`) * 0.6
    const value = Math.round(base * (1000 + bodyPct * 50000) * volNoise)

    candles.push({ time: t, open, high, low, close, value })
  }

  return candles
}

export async function GET(_req, { params }) {
  const symbol = params?.symbol
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  const url = new URL(_req.url)
  const tfSecs = clamp(Number(url.searchParams.get('tf') || 60), 60, 604800) // 1m..1w
  const limit = clamp(Number(url.searchParams.get('limit') || 200), 20, 500)

  const key = `${String(symbol).toUpperCase()}:${tfSecs}:${limit}`
  const cached = CACHE.get(key)
  const now = Date.now()
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { symbol: String(symbol).toUpperCase(), tf: tfSecs, candles: cached.data, cached: true },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    )
  }

  const candles = generateCandles({ symbol, tfSecs, limit })
  CACHE.set(key, { ts: now, data: candles })

  // Cache hint (works for edge/CDN too)
  return NextResponse.json(
    { symbol: String(symbol).toUpperCase(), tf: tfSecs, candles, cached: false },
    { headers: { 'Cache-Control': CACHE_CONTROL } }
  )
}
