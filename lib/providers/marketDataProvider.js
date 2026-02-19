// Market Data Provider - Adapter pattern for swappable data sources

// In-memory cache
const cache = new Map()
// 2-minute cache: Twelve Data free tier is 8 req/min, so we cache aggressively.
const QUOTE_CACHE_TTL = 120000 // 2 minutes for quotes
const CANDLE_CACHE_TTL = 60000 // 60 seconds for candle/chart data

function getCacheKey(symbol, type, prefix = 'quote') {
  return `${prefix}:${type}:${symbol}`
}

function getFromCache(symbol, type, prefix = 'quote') {
  const key = getCacheKey(symbol, type, prefix)
  const entry = cache.get(key)
  if (!entry) return null
  const ttl = prefix === 'candle' ? CANDLE_CACHE_TTL : QUOTE_CACHE_TTL
  if (Date.now() - entry.timestamp < ttl) return entry.data
  return null
}

// Returns stale data even if expired — used as fallback on rate-limit errors
function getStaleFromCache(symbol, type) {
  const key = getCacheKey(symbol, type)
  const entry = cache.get(key)
  return entry ? { ...entry.data, delayed: true } : null
}

function setCache(symbol, type, data, prefix = 'quote') {
  const key = getCacheKey(symbol, type, prefix)
  cache.set(key, { data, timestamp: Date.now() })
}

// Twelve Data API symbol mapping.
// Maps our internal symbol → the exact string Twelve Data expects.
const TD_SYMBOL_MAP = {
  // Forex
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY',
  USDCHF: 'USD/CHF', USDCAD: 'USD/CAD', AUDUSD: 'AUD/USD',
  NZDUSD: 'NZD/USD', EURGBP: 'EUR/GBP', EURJPY: 'EUR/JPY',
  GBPJPY: 'GBP/JPY',
  // Indices
  US30:   'DJI',   US100:  'NDX',   SPX500: 'SPX',
  GER40:  'DAX',   UK100:  'UKX',   FRA40:  'CAC40',
  JPN225: 'N225',  AUS200: 'AXJO',  HK50:   'HSI',
  CHN50:  'SHCOMP',
}

// Convert our internal symbol to Twelve Data API symbol
function toApiSymbol(symbol, type) {
  if (TD_SYMBOL_MAP[symbol]) return TD_SYMBOL_MAP[symbol]
  if (type === 'crypto') return symbol.replace(/USD$/, '/USD')
  return symbol
}

// Parse one quote entry from Twelve Data response
function parseQuoteEntry(apiSymbol, data, originalSymbol, type) {
  return {
    symbol: originalSymbol,
    type,
    price: parseFloat(data.close) || 0,
    changePercent: parseFloat(data.percent_change) || 0,
    timestamp: data.datetime || new Date().toISOString(),
    name: data.name || originalSymbol,
  }
}

// Twelve Data API adapter
export class TwelveDataProvider {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.twelvedata.com'
  }

  // Fetch a single quote (with 2-min cache + stale fallback on 429)
  async getQuote(symbol, type) {
    const cached = getFromCache(symbol, type)
    if (cached) return cached

    const apiSymbol = toApiSymbol(symbol, type)
    try {
      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${encodeURIComponent(apiSymbol)}&apikey=${this.apiKey}`
      )

      // On rate-limit, return stale cache instead of crashing
      if (response.status === 429) {
        console.warn(`TwelveData rate limit hit for ${symbol}`)
        const stale = getStaleFromCache(symbol, type)
        if (stale) return stale
        throw new Error('Rate limit reached and no cached data available')
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      if (data.code) throw new Error(data.message || 'API error')

      const result = parseQuoteEntry(apiSymbol, data, symbol, type)
      setCache(symbol, type, result)
      return result
    } catch (error) {
      // Any error: try stale cache before giving up
      const stale = getStaleFromCache(symbol, type)
      if (stale) return stale
      console.error('TwelveData getQuote error:', error.message)
      throw error
    }
  }

  // Batch fetch: ONE API call for up to ~120 symbols.
  // assets: Array of { symbol, type } objects
  // Returns: Map of symbol -> quote (with delayed:true when using stale cache)
  async getBatchQuotes(assets) {
    if (!assets || assets.length === 0) return {}

    // Separate assets with fresh cache from those that need fetching
    const toFetch = []
    const results = {}

    for (const a of assets) {
      const cached = getFromCache(a.symbol, a.type)
      if (cached) {
        results[a.symbol] = cached
      } else {
        toFetch.push(a)
      }
    }

    if (toFetch.length === 0) return results

    // Build comma-separated symbol list for Twelve Data batch endpoint
    const apiSymbols = toFetch.map(a => toApiSymbol(a.symbol, a.type))
    const symbolParam = apiSymbols.join(',')

    try {
      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbolParam)}&apikey=${this.apiKey}`
      )

      if (response.status === 429) {
        console.warn('TwelveData rate limit hit on batch request — using stale cache')
        for (const a of toFetch) {
          const stale = getStaleFromCache(a.symbol, a.type)
          results[a.symbol] = stale || null
        }
        return results
      }

      if (!response.ok) throw new Error(`Batch API error: ${response.status}`)

      const data = await response.json()

      // When fetching a single symbol, Twelve Data returns the object directly.
      // For multiple symbols it returns { SYMBOL: {...}, SYMBOL2: {...} }.
      if (toFetch.length === 1) {
        const a = toFetch[0]
        if (data.code) {
          const stale = getStaleFromCache(a.symbol, a.type)
          results[a.symbol] = stale || null
        } else {
          const result = parseQuoteEntry(apiSymbols[0], data, a.symbol, a.type)
          setCache(a.symbol, a.type, result)
          results[a.symbol] = result
        }
      } else {
        for (let i = 0; i < toFetch.length; i++) {
          const a = toFetch[i]
          const apiSym = apiSymbols[i]
          const entry = data[apiSym]
          if (!entry || entry.code) {
            const stale = getStaleFromCache(a.symbol, a.type)
            results[a.symbol] = stale || null
          } else {
            const result = parseQuoteEntry(apiSym, entry, a.symbol, a.type)
            setCache(a.symbol, a.type, result)
            results[a.symbol] = result
          }
        }
      }
    } catch (error) {
      console.error('TwelveData getBatchQuotes error:', error.message)
      // Fallback: stale cache for every asset we couldn't fetch
      for (const a of toFetch) {
        if (!results[a.symbol]) {
          results[a.symbol] = getStaleFromCache(a.symbol, a.type) || null
        }
      }
    }

    return results
  }
}

// Factory function to get the configured provider
export function getMarketDataProvider() {
  const apiKey = process.env.TWELVE_DATA_API_KEY

  if (!apiKey || apiKey === 'your_twelve_data_api_key_here') {
    return new MockProvider()
  }

  return new TwelveDataProvider(apiKey)
}

// Mock provider for development/testing — covers all 40 assets
class MockProvider {
  constructor() {
    this.mockPrices = {
      // Forex
      EURUSD:  { price: 1.0850,  name: 'Euro / US Dollar' },
      GBPUSD:  { price: 1.2650,  name: 'Pound / US Dollar' },
      USDJPY:  { price: 149.50,  name: 'US Dollar / Yen' },
      USDCHF:  { price: 0.8950,  name: 'US Dollar / Swiss Franc' },
      USDCAD:  { price: 1.3550,  name: 'US Dollar / CAD' },
      AUDUSD:  { price: 0.6550,  name: 'Australian Dollar / USD' },
      NZDUSD:  { price: 0.6100,  name: 'NZD / USD' },
      EURGBP:  { price: 0.8560,  name: 'Euro / Pound' },
      EURJPY:  { price: 162.20,  name: 'Euro / Yen' },
      GBPJPY:  { price: 189.00,  name: 'Pound / Yen' },
      // Indices
      US30:    { price: 38200,   name: 'Dow Jones Industrial' },
      US100:   { price: 17500,   name: 'Nasdaq 100' },
      SPX500:  { price: 5050,    name: 'S&P 500' },
      GER40:   { price: 18100,   name: 'Germany 40 (DAX)' },
      UK100:   { price: 7820,    name: 'UK 100 (FTSE)' },
      FRA40:   { price: 7480,    name: 'France 40 (CAC)' },
      JPN225:  { price: 38600,   name: 'Japan 225 (Nikkei)' },
      AUS200:  { price: 7640,    name: 'Australia 200 (ASX)' },
      HK50:    { price: 16500,   name: 'Hong Kong 50 (HSI)' },
      CHN50:   { price: 11800,   name: 'China 50 (CSI)' },
      // Stocks
      AAPL:    { price: 178.50,  name: 'Apple Inc.' },
      MSFT:    { price: 425.80,  name: 'Microsoft Corp.' },
      GOOGL:   { price: 175.20,  name: 'Alphabet Inc.' },
      AMZN:    { price: 185.40,  name: 'Amazon.com Inc.' },
      TSLA:    { price: 245.30,  name: 'Tesla Inc.' },
      NVDA:    { price: 135.60,  name: 'NVIDIA Corp.' },
      META:    { price: 510.20,  name: 'Meta Platforms Inc.' },
      JPM:     { price: 198.40,  name: 'JPMorgan Chase' },
      NFLX:    { price: 620.50,  name: 'Netflix Inc.' },
      AMD:     { price: 172.30,  name: 'AMD Inc.' },
      // Crypto
      BTCUSD:  { price: 67500,   name: 'Bitcoin' },
      ETHUSD:  { price: 3450,    name: 'Ethereum' },
      BNBUSD:  { price: 420,     name: 'BNB' },
      SOLUSD:  { price: 145.20,  name: 'Solana' },
      XRPUSD:  { price: 0.52,    name: 'Ripple' },
      ADAUSD:  { price: 0.48,    name: 'Cardano' },
      DOGEUSD: { price: 0.142,   name: 'Dogecoin' },
      AVAXUSD: { price: 38.50,   name: 'Avalanche' },
      DOTUSD:  { price: 8.20,    name: 'Polkadot' },
      LTCUSD:  { price: 82.40,   name: 'Litecoin' },
    }
  }

  _makeQuote(symbol, type) {
    const mockData = this.mockPrices[symbol] || { price: 100, name: symbol }
    return {
      symbol, type,
      price: mockData.price * (1 + (Math.random() * 0.02 - 0.01)),
      changePercent: parseFloat((Math.random() * 10 - 5).toFixed(2)),
      timestamp: new Date().toISOString(),
      name: mockData.name,
    }
  }

  async getQuote(symbol, type) {
    const cached = getFromCache(symbol, type)
    if (cached) return cached
    const result = this._makeQuote(symbol, type)
    setCache(symbol, type, result)
    return result
  }

  async getBatchQuotes(assets) {
    if (!assets || assets.length === 0) return {}
    const results = {}
    for (const a of assets) {
      const cached = getFromCache(a.symbol, a.type)
      if (cached) { results[a.symbol] = cached; continue }
      const result = this._makeQuote(a.symbol, a.type)
      setCache(a.symbol, a.type, result)
      results[a.symbol] = result
    }
    return results
  }
}

export default getMarketDataProvider
