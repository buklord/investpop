'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  Menu,
  Activity,
  PieChart,
  RefreshCw,
  Loader2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function PortfolioPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [account, setAccount] = useState(null)
  const [openPositions, setOpenPositions] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
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
      const [accountRes, openRes, closedRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/positions?status=open'),
        fetch('/api/positions?status=closed')
      ])
      
      const accountData = await accountRes.json()
      const openData = await openRes.json()
      const closedData = await closedRes.json()
      
      setAccount(accountData)
      setOpenPositions(openData.positions || [])
      setClosedPositions(closedData.positions || [])
      
      // Fetch quotes for open positions
      const symbols = new Set()
      openData.positions?.forEach(pos => symbols.add(`${pos.symbol}:${pos.type}`))
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
    setQuotes(newQuotes)
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0)
  }

  const cashBalance = account?.balance ?? 0
  const availableCash = account?.available ?? cashBalance
  const openPnl = account?.openPnl ?? 0
  const realizedPnl = account?.realizedPnl ?? 0
  const totalPnl = openPnl + realizedPnl
  const equity = account?.equity ?? (cashBalance + openPnl)

  // Calculate allocation
  const stocksValue = openPositions
    .filter(p => p.type === 'stock')
    .reduce((sum, pos) => {
      const quote = quotes[pos.symbol]
      return sum + (quote?.price || pos.entry_price) * pos.quantity
    }, 0)

  const cryptoValue = openPositions
    .filter(p => p.type === 'crypto')
    .reduce((sum, pos) => {
      const quote = quotes[pos.symbol]
      return sum + (quote?.price || pos.entry_price) * pos.quantity
    }, 0)

  const totalPositionsValue = stocksValue + cryptoValue

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
        currentPage="/portfolio"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Portfolio</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Portfolio</h1>
              <p className="text-slate-400">Your positions and performance</p>
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

          {/* Account Summary */}
          <div className="mb-8">
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
                      <div className="text-xs text-slate-500 mt-1">Cash + open P&amp;L</div>
                    </div>
                  </div>

                  <div className={`self-start px-3 py-1 rounded-full text-xs font-semibold border ${totalPnl >= 0 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-500/10' : 'text-red-300 border-red-700/50 bg-red-500/10'}`}>
                    {(totalPnl >= 0 ? '+' : '')}{formatCurrency(totalPnl)} P&amp;L
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
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Breakdown</div>
                    <div className="text-sm font-semibold text-white truncate">
                      {(openPnl >= 0 ? '+' : '')}{formatCurrency(openPnl)} open
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {(realizedPnl >= 0 ? '+' : '')}{formatCurrency(realizedPnl)} realized
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Allocation */}
          {totalPositionsValue > 0 && (
            <Card className="bg-[#161b22] border-slate-800 mb-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-blue-500 h-full"
                      style={{ width: `${(stocksValue / totalPositionsValue) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-orange-500 h-full"
                      style={{ width: `${(cryptoValue / totalPositionsValue) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-slate-400">Stocks</span>
                    <span className="text-white font-medium">{formatCurrency(stocksValue)}</span>
                    <span className="text-slate-500">({((stocksValue / totalPositionsValue) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span className="text-slate-400">Crypto</span>
                    <span className="text-white font-medium">{formatCurrency(cryptoValue)}</span>
                    <span className="text-slate-500">({((cryptoValue / totalPositionsValue) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Positions Tabs */}
          <Tabs defaultValue="open" className="space-y-4">
            <TabsList className="bg-slate-800">
              <TabsTrigger value="open" className="data-[state=active]:bg-emerald-600">
                Open Positions ({openPositions.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="data-[state=active]:bg-emerald-600">
                Closed Positions ({closedPositions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <Card className="bg-[#161b22] border-slate-800">
                <CardContent className="p-0">
                  {openPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No open positions</p>
                      <Link href="/markets">
                        <Button variant="link" className="text-emerald-500 mt-2">
                          Start Trading →
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-slate-500 text-sm border-b border-slate-800">
                            <th className="text-left p-4">Asset</th>
                            <th className="text-right p-4">Quantity</th>
                            <th className="text-right p-4">Entry Price</th>
                            <th className="text-right p-4">Current Price</th>
                            <th className="text-right p-4">Value</th>
                            <th className="text-right p-4">P&L</th>
                            <th className="text-center p-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openPositions.map(pos => {
                            const quote = quotes[pos.symbol]
                            const currentPrice = quote?.price || pos.entry_price
                            const currentValue = currentPrice * pos.quantity
                            const pnl = (currentPrice - pos.entry_price) * pos.quantity
                            const pnlPercent = ((currentPrice / pos.entry_price) - 1) * 100
                            
                            return (
                              <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                      pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                                    }`}>
                                      {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium text-white">{pos.symbol}</div>
                                      <div className="text-sm text-slate-500">{pos.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-right text-white">{pos.quantity}</td>
                                <td className="p-4 text-right text-slate-400">{formatCurrency(pos.entry_price)}</td>
                                <td className="p-4 text-right text-white">{formatCurrency(currentPrice)}</td>
                                <td className="p-4 text-right text-white font-medium">{formatCurrency(currentValue)}</td>
                                <td className="p-4 text-right">
                                  <div className={`font-medium ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                  </div>
                                  <div className={`text-sm ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <Link href={`/markets?select=${pos.symbol}&type=${pos.type}`}>
                                    <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-700">
                                      Trade
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="closed">
              <Card className="bg-[#161b22] border-slate-800">
                <CardContent className="p-0">
                  {closedPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No closed positions</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-slate-500 text-sm border-b border-slate-800">
                            <th className="text-left p-4">Asset</th>
                            <th className="text-right p-4">Quantity</th>
                            <th className="text-right p-4">Entry Price</th>
                            <th className="text-right p-4">Realized P&L</th>
                            <th className="text-right p-4">Closed At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPositions.map(pos => (
                            <tr key={pos.id} className="border-b border-slate-800">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                                  }`}>
                                    {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-medium text-white">{pos.symbol}</div>
                                    <div className="text-sm text-slate-500">{pos.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right text-white">{pos.quantity}</td>
                              <td className="p-4 text-right text-slate-400">{formatCurrency(pos.entry_price)}</td>
                              <td className="p-4 text-right">
                                <div className={`font-medium ${(pos.realized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {(pos.realized_pnl || 0) >= 0 ? '+' : ''}{formatCurrency(pos.realized_pnl)}
                                </div>
                              </td>
                              <td className="p-4 text-right text-slate-400">
                                {pos.closed_at ? new Date(pos.closed_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
