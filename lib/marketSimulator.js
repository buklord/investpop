/**
 * MT-style Market Simulator — singleton price engine
 *
 * Prices are stored in-memory and synced to the `market_prices` table on
 * every tick.  The DB is the shared source-of-truth across serverless
 * restarts; on cold-start we seed from DB (falling back to SIM_BASE_PRICES).
 *
 * Architecture:
 *   - One tick every 2 s (triggered by GET /api/market/tick via client setInterval)
 *   - Bid/ask derived from spread_pips (no bid > ask guard needed – spread > 0 always)
 *   - Admin can change: volatility, trendBias, spreadPips, and per-symbol overrides
 */

// ── Base mid-prices ──────────────────────────────────────────────────────────
export const BASE_PRICES = {
  // Forex
  EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, USDCHF: 0.8950,
  USDCAD: 1.3550, AUDUSD: 0.6550, NZDUSD: 0.6100, EURGBP: 0.8560,
  EURJPY: 162.20, GBPJPY: 189.00,
  // Indices
  US30: 38200, US100: 17500, SPX500: 5050, GER40: 18100, UK100: 7820,
  FRA40: 7480, JPN225: 38600, AUS200: 7640, HK50: 16500, CHN50: 11800,
  // Stocks
  AAPL: 178.50, MSFT: 425.80, GOOGL: 175.20, AMZN: 185.40, TSLA: 245.30,
  NVDA: 135.60, META: 510.20, JPM: 198.40, NFLX: 620.50, AMD: 172.30,
  // Crypto
  BTCUSD: 67500, ETHUSD: 3450, BNBUSD: 420, SOLUSD: 145.20, XRPUSD: 0.52,
  ADAUSD: 0.48, DOGEUSD: 0.142, AVAXUSD: 38.50, DOTUSD: 8.20, LTCUSD: 82.40,
}

// Default pip sizes per symbol (used to compute spread in price units)
const PIP_SIZE = {
  USDJPY: 0.01, EURJPY: 0.01, GBPJPY: 0.01,
  default: 0.0001,
}
function getPipSize(symbol) {
  if (PIP_SIZE[symbol]) return PIP_SIZE[symbol]
  if (symbol.length <= 6 && !symbol.endsWith('USD')) return PIP_SIZE.default
  return 1  // Indices / Stocks / Crypto — spread expressed as absolute price units / 10
}

// Max change per tick as a fraction of price (prevents insane spikes)
const MAX_TICK_CHANGE = 0.005  // 0.5% max per tick

// ── Simulator state (module-level singleton) ─────────────────────────────────
const SIM = {
  prices: {},          // { [symbol]: { mid, bid, ask, updatedAt } }
  initialized: false,
  settings: {
    volatility: 0.3,   // 0 – 1 (scale applied to random noise)
    trendBias: 'NEUTRAL',   // 'BULL' | 'BEAR' | 'NEUTRAL'
    spreadPips: 2,     // default spread in pips
  },
  overrides: {},       // { [symbol]: { price, expiresAt } }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function clampChange(price, change) {
  const maxDelta = price * MAX_TICK_CHANGE
  return Math.max(-maxDelta, Math.min(maxDelta, change))
}

function deriveBidAsk(mid, symbol, spreadPips) {
  const pip = getPipSize(symbol)
  const halfSpread = (spreadPips * pip) / 2
  return {
    bid: parseFloat((mid - halfSpread).toFixed(6)),
    ask: parseFloat((mid + halfSpread).toFixed(6)),
  }
}

// ── Core tick ────────────────────────────────────────────────────────────────
export function tick() {
  const { volatility, trendBias, spreadPips } = SIM.settings
  const drift = trendBias === 'BULL' ? 0.0003 : trendBias === 'BEAR' ? -0.0003 : 0
  const noiseScale = 0.001 * volatility  // max noise = 0.1% * volatility

  const updates = {}
  for (const [symbol, base] of Object.entries(BASE_PRICES)) {
    // Check admin override
    const override = SIM.overrides[symbol]
    if (override && override.expiresAt > Date.now()) {
      const { bid, ask } = deriveBidAsk(override.price, symbol, spreadPips)
      updates[symbol] = { mid: override.price, bid, ask, source: 'OVERRIDE', updatedAt: Date.now() }
      SIM.prices[symbol] = updates[symbol]
      continue
    }
    // Random walk
    const current = SIM.prices[symbol]?.mid || base
    const noise = (Math.random() * 2 - 1) * noiseScale * current
    const rawChange = drift * current + noise
    const clampedChange = clampChange(current, rawChange)
    const mid = parseFloat((current + clampedChange).toFixed(6))
    const { bid, ask } = deriveBidAsk(mid, symbol, spreadPips)
    updates[symbol] = { mid, bid, ask, source: 'SIMULATED', updatedAt: Date.now() }
    SIM.prices[symbol] = updates[symbol]
  }
  return updates
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Return all current prices (initialise if needed) */
export function getAllPrices() {
  if (!SIM.initialized) {
    // Seed from base prices on first call
    for (const [symbol, base] of Object.entries(BASE_PRICES)) {
      if (!SIM.prices[symbol]) {
        const { bid, ask } = deriveBidAsk(base, symbol, SIM.settings.spreadPips)
        SIM.prices[symbol] = { mid: base, bid, ask, source: 'SIMULATED', updatedAt: Date.now() }
      }
    }
    SIM.initialized = true
  }
  return SIM.prices
}

/** Get bid/ask for a single symbol */
export function getQuote(symbol) {
  getAllPrices()  // ensure initialized
  const p = SIM.prices[symbol?.toUpperCase()]
  if (!p) return null
  return { symbol: symbol.toUpperCase(), bid: p.bid, ask: p.ask, mid: p.mid, source: p.source }
}

/** Advance prices by one tick and return updated prices */
export function advanceTick() {
  getAllPrices()  // ensure initialized
  return tick()
}

/** Update simulator settings (called by admin control API) */
export function updateSettings({ volatility, trendBias, spreadPips }) {
  if (volatility !== undefined) SIM.settings.volatility = Math.max(0, Math.min(1, Number(volatility)))
  if (trendBias !== undefined && ['BULL', 'BEAR', 'NEUTRAL'].includes(trendBias)) {
    SIM.settings.trendBias = trendBias
  }
  if (spreadPips !== undefined) SIM.settings.spreadPips = Math.max(0.1, Number(spreadPips))
  return SIM.settings
}

/** Set per-symbol admin price override (expires after durationMs) */
export function setOverride(symbol, price, durationMs = 60000) {
  if (price <= 0) throw new Error('Price must be positive')
  SIM.overrides[symbol.toUpperCase()] = {
    price: parseFloat(price),
    expiresAt: Date.now() + durationMs,
  }
  // Update immediately
  const { bid, ask } = deriveBidAsk(price, symbol, SIM.settings.spreadPips)
  SIM.prices[symbol.toUpperCase()] = { mid: price, bid, ask, source: 'OVERRIDE', updatedAt: Date.now() }
}

/** Clear all overrides */
export function clearOverride(symbol) {
  delete SIM.overrides[symbol?.toUpperCase()]
}

/** Get current settings */
export function getSettings() {
  return { ...SIM.settings }
}
