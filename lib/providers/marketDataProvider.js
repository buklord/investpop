// Market Data Provider - Adapter pattern for swappable data sources

// In-memory cache
const cache = new Map()
const CACHE_TTL = 30000 // 30 seconds

function getCacheKey(symbol, type) {
  return `${type}:${symbol}`
}

function getFromCache(symbol, type) {
  const key = getCacheKey(symbol, type)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

function setCache(symbol, type, data) {
  const key = getCacheKey(symbol, type)
  cache.set(key, { data, timestamp: Date.now() })
}

// Twelve Data API adapter
export class TwelveDataProvider {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.twelvedata.com'
  }

  async getQuote(symbol, type) {
    // Check cache first
    const cached = getFromCache(symbol, type)
    if (cached) {
      return cached
    }

    try {
      // For crypto, Twelve Data uses format like BTC/USD
      let apiSymbol = symbol
      if (type === 'crypto') {
        // Convert BTCUSD to BTC/USD
        apiSymbol = symbol.replace(/USD$/, '/USD')
      }

      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${apiSymbol}&apikey=${this.apiKey}`
      )
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.code) {
        throw new Error(data.message || 'API error')
      }

      const result = {
        symbol: symbol,
        type: type,
        price: parseFloat(data.close) || 0,
        changePercent: parseFloat(data.percent_change) || 0,
        timestamp: data.datetime || new Date().toISOString(),
        name: data.name || symbol
      }

      // Cache the result
      setCache(symbol, type, result)
      
      return result
    } catch (error) {
      console.error('TwelveData API error:', error)
      throw error
    }
  }
}

// Factory function to get the configured provider
export function getMarketDataProvider() {
  const apiKey = process.env.TWELVE_DATA_API_KEY
  
  if (!apiKey || apiKey === 'your_twelve_data_api_key_here') {
    // Return mock provider for development
    return new MockProvider()
  }
  
  return new TwelveDataProvider(apiKey)
}

// Mock provider for development/testing
class MockProvider {
  async getQuote(symbol, type) {
    const cached = getFromCache(symbol, type)
    if (cached) return cached

    // Generate realistic mock data
    const mockPrices = {
      'BTCUSD': { price: 67500, name: 'Bitcoin' },
      'ETHUSD': { price: 3450, name: 'Ethereum' },
      'AAPL': { price: 178.50, name: 'Apple Inc.' },
      'TSLA': { price: 245.30, name: 'Tesla Inc.' },
      'MSFT': { price: 425.80, name: 'Microsoft Corp.' },
      'GOOGL': { price: 175.20, name: 'Alphabet Inc.' },
      'AMZN': { price: 185.40, name: 'Amazon.com Inc.' },
      'NVDA': { price: 135.60, name: 'NVIDIA Corp.' },
      'SOLUSD': { price: 145.20, name: 'Solana' },
      'XRPUSD': { price: 0.52, name: 'Ripple' },
    }

    const mockData = mockPrices[symbol] || { price: 100, name: symbol }
    const changePercent = (Math.random() * 10 - 5).toFixed(2)

    const result = {
      symbol,
      type,
      price: mockData.price * (1 + (Math.random() * 0.02 - 0.01)),
      changePercent: parseFloat(changePercent),
      timestamp: new Date().toISOString(),
      name: mockData.name
    }

    setCache(symbol, type, result)
    return result
  }
}

export default getMarketDataProvider
