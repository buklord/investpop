// Shared pip/tick helpers for the trading UI

export function getPipSize({ symbolId, type }) {
  if (!symbolId) return 0.01
  const sym = String(symbolId).toUpperCase()

  if (type === 'forex') {
    // JPY pairs typically quote to 2dp
    return sym.includes('JPY') ? 0.01 : 0.0001
  }

  if (type === 'index') return 1

  // Stocks/crypto: treat 0.01 as a "pip" for UI purposes
  return 0.01
}

export function roundToTick(price, tickSize) {
  const p = Number(price)
  const t = Number(tickSize)
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null
  return Math.round(p / t) * t
}

export function formatPrice(price, pipSize) {
  const p = Number(price)
  const ps = Number(pipSize)
  if (!Number.isFinite(p)) return '—'

  // Keep more decimals for FX
  if (ps > 0 && ps < 0.01) return p.toFixed(5)
  if (ps > 0 && ps < 0.1) return p.toFixed(2)
  return p.toFixed(2)
}

export function pipsToPriceDelta(pips, pipSize) {
  const pp = Number(pips)
  const ps = Number(pipSize)
  if (!Number.isFinite(pp) || !Number.isFinite(ps)) return 0
  return pp * ps
}
