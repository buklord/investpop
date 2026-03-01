import { NextResponse } from 'next/server'
import { BASE_PRICES } from '@/lib/marketSimulator'

// Server-side cache (best-effort; resets on cold starts)
const CACHE_TTL_MS = 60_000
const CACHE = globalThis.__INVESTPOP_CANDLE_CACHE || (globalThis.__INVESTPOP_CANDLE_CACHE = new Map())

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function getBasePrice(symbol) {
  const sym = String(symbol || '').toUpperCase()
  return Number(BASE_PRICES[sym]) || 1
}

// Deterministic-ish seed per symbol so candles look stable across requests
function seededRng(seedStr) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    // xorshift32
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) / 4294967296)
  }
}

function generateCandles({ symbol, tfSecs, limit }) {
  const sym = String(symbol || '').toUpperCase()
  const rng = seededRng(`${sym}:${tfSecs}`)

  const nowSec = Math.floor(Date.now() / 1000)
  const end = Math.floor(nowSec / tfSecs) * tfSecs
  const start = end - limit * tfSecs

  const base = getBasePrice(sym)

  // Volatility scales by asset type (simple heuristics)
  const isFx = sym.length === 6 && /[A-Z]{6}/.test(sym)
  const isIndex = /\d/.test(sym)
  const vol = isFx ? 0.0008 : isIndex ? 0.002 : 0.004

  let lastClose = base
  const candles = []

  for (let t = start; t < end; t += tfSecs) {
    const open = lastClose

    // Random walk
    const drift = (rng() - 0.5) * vol * open
    const close = Math.max(0.000001, open + drift)

    // Wick range
    const wick = Math.abs((rng() - 0.5) * vol * open) * 2.5
    const high = Math.max(open, close) + wick
    const low = Math.max(0.000001, Math.min(open, close) - wick)

    candles.push({ time: t, open, high, low, close })
    lastClose = close
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
    return NextResponse.json({ symbol: String(symbol).toUpperCase(), tf: tfSecs, candles: cached.data, cached: true })
  }

  const candles = generateCandles({ symbol, tfSecs, limit })
  CACHE.set(key, { ts: now, data: candles })

  // Cache hint (works for edge/CDN too)
  return NextResponse.json(
    { symbol: String(symbol).toUpperCase(), tf: tfSecs, candles, cached: false },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } }
  )
}
