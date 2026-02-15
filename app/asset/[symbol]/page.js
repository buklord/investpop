'use client'

import { useState, useEffect } from 'react'
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
  CheckCircle
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

  const loadData = async () => {
    try {
      const [quoteRes, accountRes, positionsRes, assetsRes, watchlistRes] = await Promise.all([
        fetch(`/api/quote?symbol=${symbol}&type=${type}`),
        fetch('/api/account'),
        fetch(`/api/positions?status=open&symbol=${symbol}`),
        fetch('/api/assets'),
        fetch('/api/watchlist')
      ])
      
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json()
        setQuote(quoteData)
      }
      
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
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setQuote(data)
      }
    } catch (err) {
      console.error('Failed to refresh quote:', err)
    }
    setRefreshing(false)
  }

  const executeTrade = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      setTradeResult({ success: false, message: 'Please enter a valid quantity' })
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
        setTradeResult({ success: true, message: data.message, trade: data.trade })
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
    if (!value) return '—'
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

  const estimatedCost = quote && quantity ? quote.price * parseFloat(quantity || 0) : 0
  const currentPosition = positions.find(p => p.symbol === symbol && p.status === 'OPEN')
  const isWatched = asset && watchlist.some(w => w.asset_id === asset.id)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/markets">
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Markets
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-white">PaperTrade</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={toggleWatchlist}
                className={isWatched ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}
              >
                {isWatched ? <Star className="h-5 w-5 fill-current" /> : <StarOff className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                onClick={refreshQuote}
                disabled={refreshing}
                className="text-slate-300 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Info */}
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
              }`}>
                {type === 'crypto' ? '₿' : symbol.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{symbol}</h1>
                  <span className={`px-2 py-1 rounded text-xs ${
                    type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {type === 'crypto' ? 'Cryptocurrency' : 'Stock'}
                  </span>
                </div>
                <p className="text-slate-400">{quote?.name || asset?.name || symbol}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{formatCurrency(quote?.price)}</div>
                <div className={`flex items-center justify-end gap-1 ${
                  (quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {(quote?.changePercent || 0) >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  <span className="text-lg font-semibold">
                    {(quote?.changePercent || 0) >= 0 ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}%
                  </span>
                </div>
              </div>
            </div>

            {/* TradingView Chart */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                <div className="tradingview-widget-container" style={{ height: '500px' }}>
                  <div id="tradingview-widget" style={{ height: '100%' }} />
                  <Script
                    src="https://s3.tradingview.com/tv.js"
                    strategy="afterInteractive"
                    onLoad={() => {
                      if (typeof window !== 'undefined' && window.TradingView && !chartLoaded) {
                        setChartLoaded(true)
                        new window.TradingView.widget({
                          width: '100%',
                          height: 500,
                          symbol: getTradingViewSymbol(),
                          interval: 'D',
                          timezone: 'Etc/UTC',
                          theme: 'dark',
                          style: '1',
                          locale: 'en',
                          toolbar_bg: '#161b22',
                          enable_publishing: false,
                          hide_side_toolbar: false,
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

            {/* Open Positions for this Asset */}
            {currentPosition && (
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Your Position</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-slate-500 text-sm">Quantity</div>
                      <div className="text-white font-semibold">{currentPosition.quantity}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm">Entry Price</div>
                      <div className="text-white font-semibold">{formatCurrency(currentPosition.entry_price)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm">Current Value</div>
                      <div className="text-white font-semibold">
                        {formatCurrency((quote?.price || currentPosition.entry_price) * currentPosition.quantity)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm">Unrealized P&L</div>
                      {(() => {
                        const pnl = ((quote?.price || currentPosition.entry_price) - currentPosition.entry_price) * currentPosition.quantity
                        const pnlPercent = ((quote?.price || currentPosition.entry_price) / currentPosition.entry_price - 1) * 100
                        return (
                          <div className={`font-semibold ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Trade Ticket */}
          <div className="space-y-6">
            <Card className="bg-[#161b22] border-slate-800 sticky top-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Trade {symbol}</CardTitle>
                  <div className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    Simulation
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Buy/Sell Toggle */}
                <Tabs value={tradeAction} onValueChange={setTradeAction}>
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                    <TabsTrigger 
                      value="BUY" 
                      className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                    >
                      Buy
                    </TabsTrigger>
                    <TabsTrigger 
                      value="SELL"
                      className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
                      disabled={!currentPosition}
                    >
                      Sell
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Quantity Input */}
                <div>
                  <label className="text-sm text-slate-400 block mb-2">
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
                    className="bg-slate-800 border-slate-700 text-white text-lg"
                  />
                </div>

                {/* Estimated Cost/Proceeds */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Market Price</span>
                    <span className="text-white">{formatCurrency(quote?.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Quantity</span>
                    <span className="text-white">{quantity || '0'}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{tradeAction === 'BUY' ? 'Estimated Cost' : 'Est. Proceeds'}</span>
                      <span className="text-white font-semibold">{formatCurrency(estimatedCost)}</span>
                    </div>
                  </div>
                </div>

                {/* Available Balance (for BUY) */}
                {tradeAction === 'BUY' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Available Balance</span>
                    <span className={`${(account?.balance || 0) >= estimatedCost ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(account?.balance || 0)}
                    </span>
                  </div>
                )}

                {/* Take Profit / Stop Loss (Optional) */}
                {tradeAction === 'BUY' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Take Profit (optional)</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Stop Loss (optional)</label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white text-sm"
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
                  disabled={trading || !quantity || (tradeAction === 'BUY' && estimatedCost > (account?.balance || 0))}
                  className={`w-full py-6 text-lg font-semibold ${
                    tradeAction === 'BUY' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } text-white`}
                >
                  {trading ? 'Processing...' : `${tradeAction} ${symbol}`}
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  Paper trading only. No real money involved.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
