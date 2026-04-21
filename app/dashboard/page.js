'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
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
    <Card className="bg-card border-border">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded-lg animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-7 w-28 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded-full animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-2 w-28 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
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
  const [perfMetrics, setPerfMetrics] = useState(null)
  const [perfSetups, setPerfSetups] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  // Trading mode toggle
  const [tradingMode, setTradingMode] = useState('REAL')
  const [switchingMode, setSwitchingMode] = useState(false)

  // Watchlist add functionality
  const [showAddWatchlist, setShowAddWatchlist] = useState(false)
  const [watchlistSearch, setWatchlistSearch] = useState('')
  const [availableAssets, setAvailableAssets] = useState([])
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)

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

      // Extended metrics are best-effort (do not block dashboard if unavailable).
      try {
        const perfRes = await fetch('/api/performance/metrics?days=30')
        if (perfRes.ok) {
          const perf = await perfRes.json()
          setPerfMetrics(perf.metrics || null)
          setPerfSetups(Array.isArray(perf.setups) ? perf.setups : [])
        }
      } catch (_) {}
      
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
    if (!symbolTypes || symbolTypes.length === 0) return

    try {
      // Format: "AAPL,stock|BTCUSD,crypto|MSFT,stock"
      const symbolsParam = symbolTypes
        .map(st => {
          const [symbol, type] = st.split(':')
          return `${symbol},${type || 'stock'}`
        })
        .join('|')

      const res = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(symbolsParam)}`)
      if (!res.ok) return
      const data = await res.json()

      setQuotes(prev => ({ ...prev, ...(data?.quotes || {}) }))
    } catch (_) {}
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const loadAvailableAssets = async () => {
    try {
      const res = await fetch('/api/assets?_t=' + Date.now())
      if (res.ok) {
        const data = await res.json()
        setAvailableAssets(data.assets || [])
      }
    } catch (err) {
      console.error('Failed to load available assets:', err)
    }
  }

  const addToWatchlist = async (assetId) => {
    setAddingToWatchlist(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })
      if (res.ok) {
        // Refresh watchlist data with cache buster
        const watchlistRes = await fetch('/api/watchlist?_t=' + Date.now())
        if (watchlistRes.ok) {
          const watchlistData = await watchlistRes.json()
          const newWatchlist = watchlistData.watchlist || []
          setWatchlist(newWatchlist)
          
          // Fetch quotes for newly added items
          const newSymbols = newWatchlist
            .filter(item => !quotes[item.symbol])
            .map(item => `${item.symbol},${item.type}`)
          
          if (newSymbols.length > 0) {
            fetchQuotesParallel(newSymbols)
          }
        }
        setShowAddWatchlist(false)
        setWatchlistSearch('')
      } else {
        const error = await res.json()
        console.error('Failed to add to watchlist:', error.error)
      }
    } catch (err) {
      console.error('Failed to add to watchlist:', err)
    } finally {
      setAddingToWatchlist(false)
    }
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
        const data = await res.json()
        const resolvedMode = data.tradingMode || newMode
        setTradingMode(resolvedMode)
        // Optimistically update the balance shown so the UI responds instantly
        setAccount(prev => prev ? { ...prev, balance: data.balance ?? prev.balance, tradingMode: resolvedMode } : prev)
        // Reload full data in the background — don't block the toggle on it
        loadData().catch(() => {})
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

  const formatMinutes = (mins) => {
    const m = Number(mins || 0)
    if (!Number.isFinite(m) || m <= 0) return '0m'
    if (m < 60) return `${Math.round(m)}m`
    const h = Math.floor(m / 60)
    const rem = Math.round(m % 60)
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  }

  const cashBalance = account?.balance ?? 0
  const availableCash = account?.available ?? cashBalance
  const openPnl = account?.openPnl ?? 0
  const equity = cashBalance + openPnl
  const marginUsed = Math.max(0, cashBalance - availableCash)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
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
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-foreground text-sm">Kartomtrades</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="text-muted-foreground p-1"
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                {tradingMode === 'DEMO' ? '🎯 Practice Account' : '💼 Live Account'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Demo / Real toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                <button
                  onClick={() => switchMode('DEMO')}
                  disabled={switchingMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    tradingMode === 'DEMO'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-muted-foreground hover:text-foreground'
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
                      : 'text-muted-foreground hover:text-foreground'
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
                    className="text-muted-foreground hover:text-foreground relative">
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </Button>
                {showNotifs && (
                  <div className="absolute right-0 top-10 w-80 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="text-foreground text-sm font-medium">Notifications</span>
                      <Button variant="ghost" size="sm" onClick={() => setShowNotifs(false)} className="text-muted-foreground h-6 w-6 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-muted-foreground text-sm">No notifications</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-border">
                        {notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p>{n.message}</p>
                                <p className="text-muted-foreground text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
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
                className="hidden lg:flex text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Account Stats - Skeleton while loading */}
          <div className="mb-4 sm:mb-8">
            {dataLoading ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-muted rounded-lg animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-6 w-28 bg-muted rounded-full animate-pulse" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    <div className="h-16 bg-muted/50 rounded-lg animate-pulse hidden sm:block" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border border-border rounded-xl">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${equity >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        <TrendingUp className={`h-5 w-5 ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-muted-foreground text-xs sm:text-sm font-semibold uppercase tracking-wide">Total equity</div>
                        <div className="text-3xl sm:text-4xl font-bold text-foreground truncate">{formatCurrency(equity)}</div>
                        <div className="text-xs text-muted-foreground mt-1">Live account value (cash + open P&amp;L)</div>
                      </div>
                    </div>

                    <div className={`self-start px-3 py-1 rounded-full text-xs font-semibold border ${openPnl >= 0 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-500/10' : 'text-red-300 border-red-700/50 bg-red-500/10'}`}>
                      {(openPnl >= 0 ? '+' : '')}{formatCurrency(openPnl)} open P&amp;L
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Cash</div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(cashBalance)}</div>
                      <div className="text-xs text-muted-foreground mt-1">After realized P&amp;L</div>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Available</div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(availableCash)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Ready to trade</div>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3 hidden sm:block">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Margin used</div>
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(marginUsed)}</div>
                      <div className="text-xs text-muted-foreground mt-1">Cash reserved</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Performance Dashboard 2.0 (best-effort) */}
          {perfMetrics && (
            <div className="mb-4 sm:mb-8 grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Win Rate</div>
                  <div className="text-lg sm:text-xl font-bold text-foreground">{formatPercent(perfMetrics.winRate || 0)}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Expectancy</div>
                  <div className={`text-lg sm:text-xl font-bold ${(perfMetrics.expectancy || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(perfMetrics.expectancy || 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg R</div>
                  <div className={`text-lg sm:text-xl font-bold ${(perfMetrics.avgR || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(perfMetrics.avgR || 0).toFixed(2)}R
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Hold</div>
                  <div className="text-lg sm:text-xl font-bold text-foreground">{formatMinutes(perfMetrics.avgHoldMinutes || 0)}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Max Drawdown</div>
                  <div className="text-lg sm:text-xl font-bold text-red-400">-{Number(perfMetrics.maxDrawdownPct || 0).toFixed(2)}%</div>
                </CardContent>
              </Card>
              {perfSetups.length > 0 && (
                <Card className="bg-card border-border col-span-2 lg:col-span-5">
                  <CardContent className="p-3 sm:p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Top Setups (30d)</div>
                    <div className="flex flex-wrap gap-2">
                      {perfSetups.map((s) => (
                        <span key={s.setup_tag} className="px-2.5 py-1 rounded-md bg-muted text-foreground text-xs">
                          {s.setup_tag} · {(Number(s.win_rate || 0) * 100).toFixed(0)}% WR · {Number(s.trades || 0)} trades
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Positions and Watchlist */}
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Open Positions */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground font-semibold text-base sm:text-lg">Open Positions</h2>
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
                    <Activity className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">No open positions</p>
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
                          className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              pos.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground text-sm sm:text-base">{pos.symbol}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground truncate">{pos.quantity} @ {formatCurrency(pos.entry_price)}</div>
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
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground font-semibold text-base sm:text-lg">Watchlist</h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setShowAddWatchlist(!showAddWatchlist)
                      if (!showAddWatchlist) {
                        loadAvailableAssets()
                        setWatchlistSearch('')
                      }
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm h-auto p-0 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                {showAddWatchlist && (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={watchlistSearch}
                      onChange={(e) => setWatchlistSearch(e.target.value)}
                      placeholder="Search assets..."
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground h-8 text-sm"
                    />
                    {availableAssets.length === 0 ? (
                      <div className="px-2 py-2 text-sm text-muted-foreground">Loading assets...</div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {(() => {
                          const filtered = availableAssets.filter(asset =>
                            !watchlist.some(w => w.asset_id === asset.id) &&
                            (!watchlistSearch || 
                              asset.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) ||
                              asset.name.toLowerCase().includes(watchlistSearch.toLowerCase()))
                          )
                          
                          return filtered.slice(0, 8).map(asset => (
                            <button
                              key={asset.id}
                              onClick={() => addToWatchlist(asset.id)}
                              disabled={addingToWatchlist}
                              className="w-full text-left px-2 py-1 text-sm hover:bg-muted/50 rounded flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium">{asset.symbol}</span>
                                <span className="text-muted-foreground ml-2 text-xs">{asset.name}</span>
                              </div>
                              {addingToWatchlist ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                            </button>
                          ))
                        })()}
                        {(!watchlistSearch && availableAssets.filter(asset => !watchlist.some(w => w.asset_id === asset.id)).length === 0) && (
                          <div className="px-2 py-1 text-sm text-muted-foreground">All assets are already in watchlist</div>
                        )}
                        {(watchlistSearch && availableAssets.filter(asset => 
                          !watchlist.some(w => w.asset_id === asset.id) &&
                          (asset.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) ||
                           asset.name.toLowerCase().includes(watchlistSearch.toLowerCase()))
                        ).length === 0) && (
                          <div className="px-2 py-1 text-sm text-muted-foreground">No assets found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="py-4 sm:py-5 px-4 sm:px-6">
                {dataLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <SkeletonRow /><SkeletonRow />
                  </div>
                ) : watchlist.length === 0 ? (
                  <div className="text-center py-8 sm:py-10">
                    <Eye className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">No assets in watchlist</p>
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
                          className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              item.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'
                            }`}>
                              {item.type === 'crypto' ? '₿' : item.symbol.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground text-sm sm:text-base">{item.symbol}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground truncate">{item.name}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-semibold text-foreground text-sm sm:text-base">
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
          <div className="bg-card border border-border rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
              <h2 className="text-foreground font-semibold text-base sm:text-lg">Recent Trades</h2>
            </div>
            <div className="py-4 sm:py-5 px-4 sm:px-6">
              {dataLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-t border-border">
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : trades.length === 0 ? (
                <div className="text-center py-8 sm:py-10">
                  <Activity className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No trades yet</p>
                </div>
              ) : (
                <>
                  {/* Mobile card list */}
                  <div className="sm:hidden divide-y divide-border/60">
                    {trades.slice(0, 10).map((trade) => {
                      const pnl = trade.position_status === 'CLOSED' ? Number(trade.realized_pnl || 0) : null
                      return (
                        <div key={trade.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                              trade.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                            }`}>
                              {trade.side}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground text-sm">{trade.symbol}</div>
                              <div className="text-xs text-muted-foreground">Qty: {trade.quantity}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            {pnl !== null ? (
                              <div className={`font-semibold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                              </div>
                            ) : (
                              <div className="font-medium text-foreground text-sm">{formatCurrency(trade.price)}</div>
                            )}
                            <div className="text-xs text-muted-foreground">{new Date(trade.executed_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="text-muted-foreground text-xs sm:text-sm border-b border-border">
                          <th className="text-left pb-2 sm:pb-3 font-medium">Asset</th>
                          <th className="text-left pb-2 sm:pb-3 font-medium">Side</th>
                          <th className="text-right pb-2 sm:pb-3 font-medium">Qty</th>
                          <th className="text-right pb-2 sm:pb-3 font-medium">Price</th>
                          <th className="text-right pb-2 sm:pb-3 font-medium">P&L / Fee</th>
                          <th className="text-right pb-2 sm:pb-3 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.slice(0, 10).map((trade, idx) => {
                          const pnl = trade.position_status === 'CLOSED' ? Number(trade.realized_pnl || 0) : null
                          return (
                            <tr key={trade.id} className={`${idx !== trades.slice(0, 10).length - 1 ? 'border-b border-border/60' : ''}`}>
                              <td className="py-2.5 sm:py-3">
                                <div className="font-medium text-foreground text-sm">{trade.symbol}</div>
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
                              <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-sm">{trade.quantity}</td>
                              <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-sm">{formatCurrency(trade.price)}</td>
                              <td className="py-2.5 sm:py-3 text-right text-sm font-medium">
                                {pnl !== null
                                  ? <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</span>
                                  : <span className="text-muted-foreground">{formatCurrency(trade.fee_amount || 0)}</span>
                                }
                              </td>
                              <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-xs">
                                {new Date(trade.executed_at).toLocaleDateString()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Hot Sectors Heatmap */}
          <div className="bg-card border border-border rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
              <h2 className="text-foreground font-semibold text-base sm:text-lg flex items-center gap-2">
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
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-2">
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
          <div className="bg-card border border-border rounded-xl overflow-hidden mt-4 sm:mt-6">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
              <h2 className="text-foreground font-semibold text-base sm:text-lg flex items-center gap-2">
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
                  <div key={i} className="p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.sentiment === 'positive' ? 'bg-emerald-500' :
                            item.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-500'
                          }`} />
                          <span className="text-xs text-muted-foreground">{item.source} · {item.time}</span>
                        </div>
                        <div className="font-semibold text-foreground text-sm mb-1">{item.title}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed">{item.summary}</div>
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

