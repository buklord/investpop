'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Plus, 
  RefreshCw,
  Menu,
  Activity,
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Newspaper,
  AlertTriangle
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

// Loading skeleton card
function SkeletonCard() {
  return (
    <Card className="bg-[#161b22] border-slate-800">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-3 w-16 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="h-7 w-28 bg-slate-700 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700 rounded-full animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-20 bg-slate-700 rounded animate-pulse" />
          <div className="h-2 w-28 bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-16 bg-slate-700 rounded animate-pulse" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  
  // Data states
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [trades, setTrades] = useState([])
  const [quotes, setQuotes] = useState({})
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  // Auto-refresh account stats every 30 seconds so Open P&L stays current
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/account')
        if (res.ok) setAccount(await res.json())
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/')
        return
      }
      const data = await res.json()
      setUser(data.user)
      if (data.broadcastMessage) setBroadcastMessage(data.broadcastMessage)
    } catch (err) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    setDataLoading(true)
    try {
      // Fire seed in background (don't block on it)
      fetch('/api/assets/seed', { method: 'POST' }).catch(() => {})
      
      const [accountRes, positionsRes, watchlistRes, tradesRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/positions?status=open'),
        fetch('/api/watchlist'),
        fetch('/api/trades')
      ])
      
      const accountData = await accountRes.json()
      const positionsData = await positionsRes.json()
      const watchlistData = await watchlistRes.json()
      const tradesData = await tradesRes.json()
      
      setAccount(accountData)
      setPositions(positionsData.positions || [])
      setWatchlist(watchlistData.watchlist || [])
      setTrades(tradesData.trades || [])
      
      // Fetch quotes in parallel
      const symbols = new Set()
      watchlistData.watchlist?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      positionsData.positions?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      
      fetchQuotesParallel(Array.from(symbols))
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const fetchQuotesParallel = async (symbolTypes) => {
    const newQuotes = {}
    const promises = symbolTypes.map(async (st) => {
      const [symbol, type] = st.split(':')
      try {
        const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
        if (res.ok) {
          const data = await res.json()
          return { symbol, data }
        }
      } catch (err) {}
      return null
    })
    
    const results = await Promise.all(promises)
    results.forEach(r => { if (r) newQuotes[r.symbol] = r.data })
    setQuotes(prev => ({ ...prev, ...newQuotes }))
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatPercent = (value) => {
    if (!value && value !== 0) return '0.00%'
    const prefix = value >= 0 ? '+' : ''
    return `${prefix}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar
        currentPage="/dashboard"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">InvestPop</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="text-slate-400 p-1"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Broadcast Banner */}
        {broadcastMessage && (
          <div className="bg-red-600/90 border-b border-red-500 px-4 py-2 flex items-center gap-2 overflow-hidden">
            <AlertTriangle className="h-4 w-4 text-white flex-shrink-0" />
            <div className="text-white text-sm font-medium whitespace-nowrap animate-marquee">
              {broadcastMessage}
            </div>
          </div>
        )}
        
        {/* Page content */}
        <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm">Live Trading Platform</p>
            </div>
            <Button
              variant="ghost"
              onClick={refreshData}
              disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Account Stats - Skeleton while loading */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
            {dataLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : (
              <>
                <Card className="bg-[#161b22] border-slate-800">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                      </div>
                      <span className="text-slate-400 text-xs sm:text-sm">Cash</span>
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-white truncate">
                      {formatCurrency(account?.balance || 0)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#161b22] border-slate-800">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                        <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                      </div>
                      <span className="text-slate-400 text-xs sm:text-sm">Equity</span>
                    </div>
                    <div className="text-lg sm:text-2xl font-bold text-white truncate">
                      {formatCurrency(account?.equity || 0)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#161b22] border-slate-800">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${(account?.openPnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                        {(account?.openPnl || 0) >= 0 ? (
                          <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                        )}
                      </div>
                      <span className="text-slate-400 text-xs sm:text-sm">Open P&L</span>
                    </div>
                    <div className={`text-lg sm:text-2xl font-bold truncate ${(account?.openPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {(account?.openPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.openPnl || 0)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-[#161b22] border-slate-800">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${(account?.realizedPnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                        <TrendingUp className={`h-4 w-4 sm:h-5 sm:w-5 ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                      </div>
                      <span className="text-slate-400 text-xs sm:text-sm">Realized</span>
                    </div>
                    <div className={`text-lg sm:text-2xl font-bold truncate ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.realizedPnl || 0)}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Positions and Watchlist */}
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Open Positions */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base sm:text-lg">Open Positions</CardTitle>
                  <Link href="/portfolio">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs sm:text-sm">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {dataLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <SkeletonRow /><SkeletonRow />
                  </div>
                ) : positions.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Activity className="h-10 w-10 sm:h-12 sm:w-12 text-slate-700 mx-auto mb-2 sm:mb-3" />
                    <p className="text-slate-500 text-sm">No open positions</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-emerald-500 mt-1 sm:mt-2 text-sm">
                        Start Trading →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {positions.slice(0, 5).map(pos => {
                      const quote = quotes[pos.symbol]
                      const currentPrice = quote?.price || pos.entry_price
                      const pnl = (currentPrice - pos.entry_price) * pos.quantity
                      const pnlPercent = ((currentPrice / pos.entry_price) - 1) * 100
                      
                      return (
                        <Link
                          key={pos.id}
                          href={`/asset/${pos.symbol}?type=${pos.type}`}
                          className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white text-sm sm:text-base">{pos.symbol}</div>
                              <div className="text-xs sm:text-sm text-slate-500 truncate">{pos.quantity} @ {formatCurrency(pos.entry_price)}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className={`font-medium text-sm sm:text-base ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </div>
                            <div className={`text-xs sm:text-sm ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {formatPercent(pnlPercent)}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Watchlist */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base sm:text-lg">Watchlist</CardTitle>
                  <Link href="/markets">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs sm:text-sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {dataLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <SkeletonRow /><SkeletonRow />
                  </div>
                ) : watchlist.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Eye className="h-10 w-10 sm:h-12 sm:w-12 text-slate-700 mx-auto mb-2 sm:mb-3" />
                    <p className="text-slate-500 text-sm">No assets in watchlist</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-emerald-500 mt-1 sm:mt-2 text-sm">
                        Browse Markets →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {watchlist.slice(0, 5).map(item => {
                      const quote = quotes[item.symbol]
                      
                      return (
                        <Link
                          key={item.id}
                          href={`/asset/${item.symbol}?type=${item.type}`}
                          className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              item.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {item.type === 'crypto' ? '₿' : item.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white text-sm sm:text-base">{item.symbol}</div>
                              <div className="text-xs sm:text-sm text-slate-500 truncate">{item.name}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-medium text-white text-sm sm:text-base">
                              {quote ? formatCurrency(quote.price) : '—'}
                            </div>
                            <div className={`text-xs sm:text-sm flex items-center justify-end gap-0.5 ${
                              (quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {(quote?.changePercent || 0) >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {formatPercent(quote?.changePercent || 0)}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Trades */}
          <Card className="bg-[#161b22] border-slate-800 mt-4 sm:mt-6">
            <CardHeader className="py-3 sm:py-4">
              <CardTitle className="text-white text-base sm:text-lg">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {dataLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-t border-slate-800">
                      <div className="h-3 w-24 bg-slate-700 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-slate-700 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : trades.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Activity className="h-10 w-10 sm:h-12 sm:w-12 text-slate-700 mx-auto mb-2 sm:mb-3" />
                  <p className="text-slate-500 text-sm">No trades yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-slate-500 text-xs sm:text-sm">
                        <th className="text-left pb-2 sm:pb-3 pl-4 sm:pl-0">Asset</th>
                        <th className="text-left pb-2 sm:pb-3">Side</th>
                        <th className="text-right pb-2 sm:pb-3">Qty</th>
                        <th className="text-right pb-2 sm:pb-3">Price</th>
                        <th className="text-right pb-2 sm:pb-3">Fee</th>
                        <th className="text-right pb-2 sm:pb-3 pr-4 sm:pr-0">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 10).map(trade => (
                        <tr key={trade.id} className="border-t border-slate-800">
                          <td className="py-2 sm:py-3 pl-4 sm:pl-0">
                            <div className="font-medium text-white text-sm">{trade.symbol}</div>
                          </td>
                          <td className="py-2 sm:py-3">
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium ${
                              trade.side === 'BUY' 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 text-right text-slate-300 text-sm">{trade.quantity}</td>
                          <td className="py-2 sm:py-3 text-right text-slate-300 text-sm">{formatCurrency(trade.price)}</td>
                          <td className="py-2 sm:py-3 text-right text-slate-500 text-sm">{formatCurrency(trade.fee_amount || 0)}</td>
                          <td className="py-2 sm:py-3 text-right text-slate-500 text-xs pr-4 sm:pr-0">
                            {new Date(trade.executed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* News Feed */}
          <Card className="bg-[#161b22] border-slate-800 mt-4 sm:mt-6">
            <CardHeader className="py-3 sm:py-4">
              <CardTitle className="text-white text-base sm:text-lg flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-blue-400" />
                Market News
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {[
                  {
                    title: 'Fed Holds Rates Steady, Markets React Positively',
                    source: 'Financial Times',
                    time: '2h ago',
                    sentiment: 'positive',
                    summary: 'The Federal Reserve maintained its benchmark interest rate, citing stable inflation trends and strong employment data.'
                  },
                  {
                    title: 'Tech Sector Leads Market Rally Amid AI Optimism',
                    source: 'Reuters',
                    time: '4h ago',
                    sentiment: 'positive',
                    summary: 'Major technology stocks surged as investors remained bullish on artificial intelligence developments and quarterly earnings.'
                  },
                  {
                    title: 'Bitcoin Consolidates Near Key Resistance Level',
                    source: 'CoinDesk',
                    time: '5h ago',
                    sentiment: 'neutral',
                    summary: 'Crypto markets remain cautious as Bitcoin tests resistance near recent highs, with traders watching for a breakout.'
                  },
                  {
                    title: 'Energy Stocks Fall on Supply Concerns',
                    source: 'Bloomberg',
                    time: '7h ago',
                    sentiment: 'negative',
                    summary: 'Oil prices dipped and energy equities fell after OPEC signaled potential increases in production output for Q2.'
                  }
                ].map((item, i) => (
                  <div key={i} className="p-3 sm:p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.sentiment === 'positive' ? 'bg-emerald-500' :
                            item.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-500'
                          }`} />
                          <span className="text-xs text-slate-500">{item.source} · {item.time}</span>
                        </div>
                        <div className="font-medium text-white text-sm mb-1">{item.title}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">{item.summary}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

