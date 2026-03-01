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
  Loader2,
  Newspaper,
  AlertTriangle,
  Bell,
  X,
  CheckCircle
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

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  // Trading mode toggle
  const [tradingMode, setTradingMode] = useState('DEMO')
  const [switchingMode, setSwitchingMode] = useState(false)

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

  // Poll for notifications every 15 seconds
  useEffect(() => {
    if (!user) return
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) setNotifications((await res.json()).notifications || [])
      } catch (err) { console.error('Failed to fetch notifications:', err) }
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 15000)
    return () => clearInterval(interval)
  }, [user])

  const markNotifsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) { console.error('Failed to mark notifications read:', err) }
  }

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
      // Identify user in Tawk.to after login (Issue 4)
      if (data.user?.email) {
        let attempts = 0
        const identifyTawk = () => {
          if (typeof window !== 'undefined' && window.Tawk_API?.setAttributes) {
            window.Tawk_API.setAttributes({
              name: data.user.firstName ? `${data.user.firstName} ${data.user.lastName || ''}`.trim() : data.user.email,
              email: data.user.email,
            }, () => {})
          } else if (++attempts < 10) {
            setTimeout(identifyTawk, 400)
          }
        }
        identifyTawk()
      }
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
      if (accountData.tradingMode) setTradingMode(accountData.tradingMode)
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

  const switchMode = async (newMode) => {
    if (newMode === tradingMode || switchingMode) return
    setSwitchingMode(true)
    try {
      const res = await fetch('/api/account/switch-mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      if (res.ok) {
        setTradingMode(newMode)
        await loadData()
      }
    } catch (err) { console.error('Failed to switch mode:', err) }
    finally { setSwitchingMode(false) }
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

  const cashBalance = account?.balance ?? 0
  const availableCash = account?.available ?? cashBalance
  const openPnl = account?.openPnl ?? 0
  const equity = cashBalance + openPnl
  const marginUsed = Math.max(0, cashBalance - availableCash)

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
        account={account}
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
              <p className="text-slate-400 text-sm">
                {tradingMode === 'DEMO' ? '🎯 Practice Account' : '💼 Live Account'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Demo / Real toggle */}
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={() => switchMode('DEMO')}
                  disabled={switchingMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    tradingMode === 'DEMO'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Demo
                </button>
                <button
                  onClick={() => switchMode('REAL')}
                  disabled={switchingMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    tradingMode === 'REAL'
                      ? 'bg-emerald-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Real
                </button>
              </div>
              {/* Notification Bell */}
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => {
                    const opening = !showNotifs
                    setShowNotifs(opening)
                    if (opening) markNotifsRead()
                  }}
                  className="text-slate-400 hover:text-white relative">
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </Button>
                {showNotifs && (
                  <div className="absolute right-0 top-10 w-80 bg-[#161b22] border border-slate-700 rounded-xl shadow-2xl z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                      <span className="text-white text-sm font-medium">Notifications</span>
                      <Button variant="ghost" size="sm" onClick={() => setShowNotifs(false)} className="text-slate-400 h-6 w-6 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-slate-500 text-sm">No notifications</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                        {notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-slate-400' : 'text-white'}`}>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p>{n.message}</p>
                                <p className="text-slate-500 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
          </div>

          {/* Account Stats - Skeleton while loading */}
          <div className="mb-4 sm:mb-8">
            {dataLoading ? (
              <Card className="bg-[#161b22] border-slate-800">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-slate-700 rounded-lg animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3 w-24 bg-slate-700 rounded animate-pulse" />
                        <div className="h-8 w-40 bg-slate-700 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-6 w-28 bg-slate-700 rounded-full animate-pulse" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
                    <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
                    <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse hidden sm:block" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 border border-slate-700 rounded-xl">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${equity >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        <TrendingUp className={`h-5 w-5 ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wide">Total equity</div>
                        <div className="text-3xl sm:text-4xl font-bold text-white truncate">{formatCurrency(equity)}</div>
                        <div className="text-xs text-slate-500 mt-1">Live account value (cash + open P&amp;L)</div>
                      </div>
                    </div>

                    <div className={`self-start px-3 py-1 rounded-full text-xs font-semibold border ${openPnl >= 0 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-500/10' : 'text-red-300 border-red-700/50 bg-red-500/10'}`}>
                      {(openPnl >= 0 ? '+' : '')}{formatCurrency(openPnl)} open P&amp;L
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Cash</div>
                      <div className="text-base sm:text-lg font-semibold text-white truncate">{formatCurrency(cashBalance)}</div>
                      <div className="text-xs text-slate-500 mt-1">After realized P&amp;L</div>
                    </div>

                    <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Available</div>
                      <div className="text-base sm:text-lg font-semibold text-white truncate">{formatCurrency(availableCash)}</div>
                      <div className="text-xs text-slate-500 mt-1">Ready to trade</div>
                    </div>

                    <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3 hidden sm:block">
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Margin used</div>
                      <div className="text-base sm:text-lg font-semibold text-white truncate">{formatCurrency(marginUsed)}</div>
                      <div className="text-xs text-slate-500 mt-1">Cash reserved</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Positions and Watchlist */}
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Open Positions */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl overflow-hidden">
              <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold text-base sm:text-lg">Open Positions</h2>
                  <Link href="/portfolio">
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm h-auto p-0">
                      View All →
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="py-4 sm:py-5 px-4 sm:px-6">
                {dataLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <SkeletonRow /><SkeletonRow />
                  </div>
                ) : positions.length === 0 ? (
                  <div className="text-center py-8 sm:py-10">
                    <Activity className="h-12 w-12 sm:h-14 sm:w-14 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No open positions</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-blue-400 hover:text-blue-300 mt-2 text-sm h-auto p-0">
                        Start Trading →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.slice(0, 5).map(pos => {
                      const quote = quotes[pos.symbol]
                      const currentPrice = quote?.price || pos.entry_price
                      const pnl = (currentPrice - pos.entry_price) * pos.quantity
                      const pnlPercent = ((currentPrice / pos.entry_price) - 1) * 100
                      
                      return (
                        <Link
                          key={pos.id}
                          href={`/asset/${pos.symbol}?type=${pos.type}`}
                          className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600 rounded-lg transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              pos.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-sm sm:text-base">{pos.symbol}</div>
                              <div className="text-xs sm:text-sm text-slate-400 truncate">{pos.quantity} @ {formatCurrency(pos.entry_price)}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className={`font-semibold text-sm sm:text-base ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </div>
                            <div className={`text-xs sm:text-sm font-medium ${pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatPercent(pnlPercent)}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Watchlist */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl overflow-hidden">
              <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold text-base sm:text-lg">Watchlist</h2>
                  <Link href="/markets">
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm h-auto p-0 flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="py-4 sm:py-5 px-4 sm:px-6">
                {dataLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <SkeletonRow /><SkeletonRow />
                  </div>
                ) : watchlist.length === 0 ? (
                  <div className="text-center py-8 sm:py-10">
                    <Eye className="h-12 w-12 sm:h-14 sm:w-14 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">No assets in watchlist</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-blue-400 hover:text-blue-300 mt-2 text-sm h-auto p-0">
                        Browse Markets →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {watchlist.slice(0, 5).map(item => {
                      const quote = quotes[item.symbol]
                      
                      return (
                        <Link
                          key={item.id}
                          href={`/asset/${item.symbol}?type=${item.type}`}
                          className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600 rounded-lg transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              item.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {item.type === 'crypto' ? '₿' : item.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-sm sm:text-base">{item.symbol}</div>
                              <div className="text-xs sm:text-sm text-slate-400 truncate">{item.name}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-semibold text-white text-sm sm:text-base">
                              {quote ? formatCurrency(quote.price) : '—'}
                            </div>
                            <div className={`text-xs sm:text-sm font-medium flex items-center justify-end gap-1 ${
                              (quote?.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
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
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-700/50">
              <h2 className="text-white font-semibold text-base sm:text-lg">Recent Trades</h2>
            </div>
            <div className="py-4 sm:py-5 px-4 sm:px-6">
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
                <div className="text-center py-8 sm:py-10">
                  <Activity className="h-12 w-12 sm:h-14 sm:w-14 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-medium">No trades yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-slate-500 text-xs sm:text-sm border-b border-slate-700/50">
                        <th className="text-left pb-2 sm:pb-3 pl-4 sm:pl-0 font-medium">Asset</th>
                        <th className="text-left pb-2 sm:pb-3 font-medium">Side</th>
                        <th className="text-right pb-2 sm:pb-3 font-medium">Qty</th>
                        <th className="text-right pb-2 sm:pb-3 font-medium">Price</th>
                        <th className="text-right pb-2 sm:pb-3 font-medium">Fee</th>
                        <th className="text-right pb-2 sm:pb-3 pr-4 sm:pr-0 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 10).map((trade, idx) => (
                        <tr key={trade.id} className={`${idx !== trades.slice(0, 10).length - 1 ? 'border-b border-slate-700/30' : ''}`}>
                          <td className="py-2.5 sm:py-3 pl-4 sm:pl-0">
                            <div className="font-medium text-white text-sm">{trade.symbol}</div>
                          </td>
                          <td className="py-2.5 sm:py-3">
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${
                              trade.side === 'BUY' 
                                ? 'bg-emerald-500/15 text-emerald-400' 
                                : 'bg-red-500/15 text-red-400'
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="py-2.5 sm:py-3 text-right text-slate-300 text-sm">{trade.quantity}</td>
                          <td className="py-2.5 sm:py-3 text-right text-slate-300 text-sm">{formatCurrency(trade.price)}</td>
                          <td className="py-2.5 sm:py-3 text-right text-slate-500 text-sm">{formatCurrency(trade.fee_amount || 0)}</td>
                          <td className="py-2.5 sm:py-3 text-right text-slate-500 text-xs pr-4 sm:pr-0">
                            {new Date(trade.executed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Hot Sectors Heatmap */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-700/50">
              <h2 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" />
                Hot Sectors
              </h2>
            </div>
            <div className="py-4 sm:py-5 px-4 sm:px-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'AI / Technology', change: +3.24, assets: ['NVDA', 'MSFT', 'AAPL'], color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', barColor: 'bg-emerald-500' },
                  { name: 'Cryptocurrency', change: +1.87, assets: ['BTCUSD', 'ETHUSD', 'SOLUSD'], color: 'bg-orange-500/15 border-orange-500/30 text-orange-400', barColor: 'bg-orange-500' },
                  { name: 'Energy', change: -1.12, assets: ['XOM', 'CVX'], color: 'bg-red-500/15 border-red-500/30 text-red-400', barColor: 'bg-red-500' },
                  { name: 'Finance', change: +0.54, assets: ['JPM', 'GS', 'BAC'], color: 'bg-blue-500/15 border-blue-500/30 text-blue-400', barColor: 'bg-blue-500' },
                ].map((sector) => (
                  <div key={sector.name} className={`p-3 rounded-lg border ${sector.color}`}>
                    <div className="text-xs font-semibold mb-1">{sector.name}</div>
                    <div className="text-xl font-bold mb-1.5">
                      {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                    </div>
                    <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                      <div className={`h-full ${sector.barColor} transition-all duration-700`}
                        style={{ width: `${Math.min(100, Math.abs(sector.change) * 20 + 40)}%` }} />
                    </div>
                    <div className="text-xs opacity-70">{sector.assets.slice(0, 2).join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* News Feed */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700 rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-700/50">
              <h2 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-blue-400" />
                Market News
              </h2>
            </div>
            <div className="py-4 sm:py-5 px-4 sm:px-6">
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
                  <div key={i} className="p-3 sm:p-4 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600 rounded-lg transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.sentiment === 'positive' ? 'bg-emerald-500' :
                            item.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-500'
                          }`} />
                          <span className="text-xs text-slate-500">{item.source} · {item.time}</span>
                        </div>
                        <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                        <div className="text-xs text-slate-400 leading-relaxed">{item.summary}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

