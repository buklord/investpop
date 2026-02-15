'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Wallet, 
  LogOut, 
  Plus, 
  Trash2, 
  RefreshCw,
  Menu,
  X,
  Home,
  LineChart,
  Activity,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Search
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Data states
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [trades, setTrades] = useState([])
  const [quotes, setQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
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
    } catch (err) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      await fetch('/api/assets/seed', { method: 'POST' })
      
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
      
      // Fetch quotes for watchlist
      const symbols = new Set()
      watchlistData.watchlist?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      positionsData.positions?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      
      fetchQuotes(Array.from(symbols))
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  const fetchQuotes = async (symbolTypes) => {
    const newQuotes = {}
    for (const st of symbolTypes) {
      const [symbol, type] = st.split(':')
      try {
        const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
        if (res.ok) {
          const data = await res.json()
          newQuotes[symbol] = data
        }
      } catch (err) {
        console.error(`Failed to fetch quote for ${symbol}:`, err)
      }
    }
    setQuotes(prev => ({ ...prev, ...newQuotes }))
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatPercent = (value) => {
    const prefix = value >= 0 ? '+' : ''
    return `${prefix}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  const Sidebar = () => (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">PaperTrade</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 px-2 py-1 bg-emerald-500/10 rounded text-emerald-400 text-xs text-center">
            Paper Trading (Simulation)
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-600/20 text-emerald-400"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/markets"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Activity className="h-5 w-5" />
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <PieChart className="h-5 w-5" />
            Portfolio
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="text-sm text-slate-400 mb-2 truncate">{user?.email}</div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 lg:ml-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">PaperTrade</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Page content */}
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400">Paper Trading Simulation</p>
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

          {/* Account Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="text-slate-400 text-sm">Cash Balance</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(account?.balance || 0)}
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="text-slate-400 text-sm">Total Equity</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(account?.equity || 0)}
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 ${(account?.openPnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                    {(account?.openPnl || 0) >= 0 ? (
                      <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <span className="text-slate-400 text-sm">Open P&L</span>
                </div>
                <div className={`text-2xl font-bold ${(account?.openPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {(account?.openPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.openPnl || 0)}
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 ${(account?.realizedPnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                    <LineChart className={`h-5 w-5 ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                  </div>
                  <span className="text-slate-400 text-sm">Realized P&L</span>
                </div>
                <div className={`text-2xl font-bold ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.realizedPnl || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Open Positions */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Open Positions</CardTitle>
                  <Link href="/portfolio">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No open positions</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-emerald-500 mt-2">
                        Start Trading →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positions.slice(0, 5).map(pos => {
                      const quote = quotes[pos.symbol]
                      const currentPrice = quote?.price || pos.entry_price
                      const pnl = (currentPrice - pos.entry_price) * pos.quantity
                      const pnlPercent = ((currentPrice / pos.entry_price) - 1) * 100
                      
                      return (
                        <Link
                          key={pos.id}
                          href={`/asset/${pos.symbol}?type=${pos.type}`}
                          className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-white">{pos.symbol}</div>
                              <div className="text-sm text-slate-500">{pos.quantity} units @ {formatCurrency(pos.entry_price)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </div>
                            <div className={`text-sm ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Watchlist</CardTitle>
                  <Link href="/markets">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {watchlist.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No assets in watchlist</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-emerald-500 mt-2">
                        Browse Markets →
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {watchlist.slice(0, 5).map(item => {
                      const quote = quotes[item.symbol]
                      
                      return (
                        <Link
                          key={item.id}
                          href={`/asset/${item.symbol}?type=${item.type}`}
                          className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              item.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {item.type === 'crypto' ? '₿' : item.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-white">{item.symbol}</div>
                              <div className="text-sm text-slate-500">{item.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-white">
                              {quote ? formatCurrency(quote.price) : '—'}
                            </div>
                            <div className={`text-sm flex items-center justify-end gap-1 ${
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
          <Card className="bg-[#161b22] border-slate-800 mt-6">
            <CardHeader>
              <CardTitle className="text-white">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              {trades.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No trades yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-slate-500 text-sm">
                        <th className="text-left pb-3">Asset</th>
                        <th className="text-left pb-3">Side</th>
                        <th className="text-right pb-3">Quantity</th>
                        <th className="text-right pb-3">Price</th>
                        <th className="text-right pb-3">Total</th>
                        <th className="text-right pb-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 10).map(trade => (
                        <tr key={trade.id} className="border-t border-slate-800">
                          <td className="py-3">
                            <div className="font-medium text-white">{trade.symbol}</div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.side === 'BUY' 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="py-3 text-right text-slate-300">{trade.quantity}</td>
                          <td className="py-3 text-right text-slate-300">{formatCurrency(trade.price)}</td>
                          <td className="py-3 text-right text-white font-medium">{formatCurrency(trade.total_value)}</td>
                          <td className="py-3 text-right text-slate-500 text-sm">
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
