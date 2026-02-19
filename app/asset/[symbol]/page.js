'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  BarChart3,
  Star,
  StarOff,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import Script from 'next/script'

export default function AssetPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const symbol = params.symbol
  const type = searchParams.get('type') || 'stock'
  
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [asset, setAsset] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  
  // Trading form
  const [tradeAction, setTradeAction] = useState('BUY')
  const [quantity, setQuantity] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [trading, setTrading] = useState(false)
  const [tradeResult, setTradeResult] = useState(null)
  
  const [chartLoaded, setChartLoaded] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && symbol) {
      loadData()
    }
  }, [user, symbol])

  // Auto-refresh quote every 5 seconds for live price feed
  useEffect(() => {
    if (!user || !symbol) return
    const interval = setInterval(() => {
      fetchQuote()
    }, 5000)
    return () => clearInterval(interval)
  }, [user, symbol, type])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/')
        return
      }
      const data = await res.json()
      setUser(data.user)
    } catch (err) {
      router.push('/')
    }
  }

  const fetchQuote = useCallback(async () => {
    if (!symbol) return
    setQuoteLoading(true)
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setQuote(data)
      }
    } catch (err) {
      console.error('Failed to fetch quote:', err)
    } finally {
      setQuoteLoading(false)
    }
  }, [symbol, type])

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch quote first (most important)
      await fetchQuote()
      
      // Then fetch other data in parallel
      const [accountRes, positionsRes, assetsRes, watchlistRes] = await Promise.all([
        fetch('/api/account'),
        fetch(`/api/positions?status=open&symbol=${symbol}`),
        fetch('/api/assets'),
        fetch('/api/watchlist')
      ])
      
      if (accountRes.ok) {
        const accountData = await accountRes.json()
        setAccount(accountData)
      }
      
      if (positionsRes.ok) {
        const positionsData = await positionsRes.json()
        setPositions(positionsData.positions || [])
      }
      
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json()
        const foundAsset = assetsData.assets?.find(a => a.symbol === symbol)
        setAsset(foundAsset)
      }
      
      if (watchlistRes.ok) {
        const watchlistData = await watchlistRes.json()
        setWatchlist(watchlistData.watchlist || [])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshQuote = async () => {
    setRefreshing(true)
    await fetchQuote()
    // Also refresh account for latest balance
    try {
      const res = await fetch('/api/account')
      if (res.ok) {
        const data = await res.json()
        setAccount(data)
      }
    } catch (err) {}
    setRefreshing(false)
  }

  const executeTrade = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      setTradeResult({ success: false, message: 'Please enter a valid quantity' })
      return
    }

    if (!quote?.price) {
      setTradeResult({ success: false, message: 'Price not available. Please refresh and try again.' })
      return
    }

    setTrading(true)
    setTradeResult(null)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          type,
          action: tradeAction,
          quantity: parseFloat(quantity),
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined
        })
      })

      const data = await res.json()

      if (res.ok) {
        setTradeResult({ 
          success: true, 
          message: `${tradeAction} executed at $${data.trade?.executedPrice?.toFixed(2) || 'N/A'}`,
          trade: data.trade 
        })
        setQuantity('')
        setTakeProfit('')
        setStopLoss('')
        // Reload data
        loadData()
      } else {
        setTradeResult({ success: false, message: data.error })
      }
    } catch (err) {
      setTradeResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setTrading(false)
    }
  }

  const toggleWatchlist = async () => {
    if (!asset) return
    
    const isWatched = watchlist.some(w => w.asset_id === asset.id)
    
    try {
      if (isWatched) {
        const item = watchlist.find(w => w.asset_id === asset.id)
        if (item) {
          await fetch(`/api/watchlist/${item.id}`, { method: 'DELETE' })
          setWatchlist(prev => prev.filter(w => w.id !== item.id))
        }
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: asset.id })
        })
        if (res.ok) {
          const data = await res.json()
          setWatchlist(prev => [...prev, { id: data.id, asset_id: asset.id }])
        }
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err)
    }
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—'
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(value)
    }
    return `$${value.toFixed(6)}`
  }

  const getTradingViewSymbol = () => {
    if (type === 'crypto') {
      const base = symbol.replace(/USD$/, '')
      return `BINANCE:${base}USDT`
    }
    return `NASDAQ:${symbol}`
  }

  const estimatedCost = quote?.price && quantity ? quote.price * parseFloat(quantity || 0) : 0
  const currentPosition = positions.find(p => p.symbol === symbol && p.status === 'OPEN')
  const isWatched = asset && watchlist.some(w => w.asset_id === asset.id)

  if (loading && !quote) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading {symbol}...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-slate-800 sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/markets">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white px-2 sm:px-4">
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Markets</span>
                </Button>
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">InvestPop</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleWatchlist}
                className={`px-2 ${isWatched ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`}
              >
                {isWatched ? <Star className="h-5 w-5 fill-current" /> : <StarOff className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshQuote}
                disabled={refreshing}
                className="text-slate-300 hover:text-white px-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Asset Info - Mobile Optimized */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${
                type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
              }`}>
                {type === 'crypto' ? '₿' : symbol.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-bold text-white">{symbol}</h1>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {type}
                  </span>
                </div>
                <p className="text-slate-400 text-sm truncate">{quote?.name || asset?.name || symbol}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {quoteLoading && !quote ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  <>
                    <div className="text-xl sm:text-3xl font-bold text-white">{formatCurrency(quote?.price)}</div>
                    <div className={`flex items-center justify-end gap-1 text-sm sm:text-base ${
                      (quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                      {(quote?.changePercent || 0) >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="font-semibold">
                        {(quote?.changePercent || 0) >= 0 ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TradingView Chart - Responsive Height */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                <div className="tradingview-widget-container" style={{ height: 'clamp(300px, 50vh, 500px)' }}>
                  <div id="tradingview-widget" style={{ height: '100%' }} />
                  <Script
                    src="https://s3.tradingview.com/tv.js"
                    strategy="afterInteractive"
                    onLoad={() => {
                      if (typeof window !== 'undefined' && window.TradingView && !chartLoaded) {
                        setChartLoaded(true)
                        new window.TradingView.widget({
                          width: '100%',
                          height: '100%',
                          symbol: getTradingViewSymbol(),
                          interval: 'D',
                          timezone: 'Etc/UTC',
                          theme: 'dark',
                          style: '1',
                          locale: 'en',
                          toolbar_bg: '#161b22',
                          enable_publishing: false,
                          hide_side_toolbar: true,
                          allow_symbol_change: true,
                          container_id: 'tradingview-widget',
                          backgroundColor: '#161b22',
                          gridColor: '#1e293b'
                        })
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Open Position for this Asset */}
            {currentPosition && (
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="py-3 sm:py-4">
                  <CardTitle className="text-white text-base sm:text-lg">Your Position</CardTitle>
                </CardHeader>
                <CardContent className="py-2 sm:py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <div className="text-slate-500 text-xs sm:text-sm">Quantity</div>
                      <div className="text-white font-semibold text-sm sm:text-base">{currentPosition.quantity}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs sm:text-sm">Entry Price</div>
                      <div className="text-white font-semibold text-sm sm:text-base">{formatCurrency(currentPosition.entry_price)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs sm:text-sm">Current Value</div>
                      <div className="text-white font-semibold text-sm sm:text-base">
                        {formatCurrency((quote?.price || currentPosition.entry_price) * currentPosition.quantity)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs sm:text-sm">Unrealized P&L</div>
                      {(() => {
                        const pnl = ((quote?.price || currentPosition.entry_price) - currentPosition.entry_price) * currentPosition.quantity
                        const pnlPercent = ((quote?.price || currentPosition.entry_price) / currentPosition.entry_price - 1) * 100
                        return (
                          <div className={`font-semibold text-sm sm:text-base ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Trade Ticket - Mobile Optimized */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="bg-[#161b22] border-slate-800 lg:sticky lg:top-20">
              <CardHeader className="py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base sm:text-lg">Trade {symbol}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Buy/Sell Toggle */}
                <Tabs value={tradeAction} onValueChange={setTradeAction}>
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800 h-10 sm:h-11">
                    <TabsTrigger 
                      value="BUY" 
                      className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-sm sm:text-base"
                    >
                      Buy
                    </TabsTrigger>
                    <TabsTrigger 
                      value="SELL"
                      className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-sm sm:text-base"
                      disabled={!currentPosition}
                    >
                      Sell
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Quantity Input */}
                <div>
                  <label className="text-xs sm:text-sm text-slate-400 block mb-1.5 sm:mb-2">
                    Quantity {tradeAction === 'SELL' && currentPosition && `(Max: ${currentPosition.quantity})`}
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={tradeAction === 'SELL' && currentPosition ? currentPosition.quantity : undefined}
                    placeholder="0.00"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-base sm:text-lg h-11 sm:h-12"
                  />
                </div>

                {/* Estimated Cost/Proceeds */}
                <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4">
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-slate-400">Market Price</span>
                    <span className="text-white">
                      {quoteLoading && !quote ? (
                        <Loader2 className="h-4 w-4 animate-spin inline" />
                      ) : (
                        formatCurrency(quote?.price)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-slate-400">Quantity</span>
                    <span className="text-white">{quantity || '0'}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-slate-400">Trade Value</span>
                    <span className="text-white">{estimatedCost > 0 ? formatCurrency(estimatedCost) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-amber-500/80">Required Margin <span className="text-slate-500">(10%)</span></span>
                    <span className={`font-medium ${estimatedCost > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {estimatedCost > 0 ? formatCurrency(estimatedCost * 0.10) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-slate-400">Fee (0.1%)</span>
                    <span className="text-slate-400">{formatCurrency(estimatedCost * 0.001)}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">{tradeAction === 'BUY' ? 'Total Cost' : 'Est. Proceeds'}</span>
                      <span className="text-white font-semibold">{formatCurrency(estimatedCost)}</span>
                    </div>
                  </div>
                </div>

                {/* Available Balance (for BUY) */}
                {tradeAction === 'BUY' && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-400">Available Cash</span>
                    <span className={`${(account?.balance || 0) >= estimatedCost ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(account?.balance || 0)}
                    </span>
                  </div>
                )}

                {/* Insufficient funds warning */}
                {tradeAction === 'BUY' && estimatedCost > 0 && estimatedCost > (account?.balance || 0) && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-red-400 text-xs font-semibold">Insufficient Funds</div>
                      <Link href="/wallet">
                        <span className="text-xs text-red-300 underline hover:text-red-200 cursor-pointer">Add Funds →</span>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Take Profit / Stop Loss (Optional) - Collapsible on mobile */}
                {tradeAction === 'BUY' && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Take Profit</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-sm h-9 sm:h-10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Stop Loss</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-sm h-9 sm:h-10"
                      />
                    </div>
                  </div>
                )}

                {/* Trade Result */}
                {tradeResult && (
                  <div className={`rounded-lg p-3 flex items-start gap-2 ${
                    tradeResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {tradeResult.success ? (
                      <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm">{tradeResult.message}</div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={executeTrade}
                  disabled={trading || !quantity || !quote?.price || (tradeAction === 'BUY' && estimatedCost > (account?.balance || 0))}
                  className={`w-full py-5 sm:py-6 text-base sm:text-lg font-semibold ${
                    tradeAction === 'BUY' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } text-white disabled:opacity-50`}
                >
                  {trading ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
                  ) : (
                    `${tradeAction} ${symbol}`
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
