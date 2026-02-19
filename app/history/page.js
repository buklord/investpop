'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3,
  Menu,
  RefreshCw,
  History,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function HistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [trades, setTrades] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('trades')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [tradesRes, closedRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/positions?status=closed')
      ])
      const tradesData = await tradesRes.json()
      const closedData = await closedRes.json()
      setTrades(tradesData.trades || [])
      setClosedPositions(closedData.positions || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(value || 0)

  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0)
  const winningTrades = closedPositions.filter(p => (p.realized_pnl || 0) > 0).length
  const winRate = closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0

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
        currentPage="/history"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

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
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Trade History</h1>
              <p className="text-slate-400 text-sm">All executed trades and closed positions</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs mb-1">Total Realized P&L</div>
                <div className={`text-xl font-bold ${totalRealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnl)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs mb-1">Closed Positions</div>
                <div className="text-xl font-bold text-white">{closedPositions.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800 col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs mb-1">Win Rate</div>
                <div className={`text-xl font-bold ${winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {winRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('trades')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'trades' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Trades ({trades.length})
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'positions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Closed Positions ({closedPositions.length})
            </button>
          </div>

          {/* Trades Tab */}
          {activeTab === 'trades' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                {trades.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No trades yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Asset</th>
                          <th className="text-left p-4">Side</th>
                          <th className="text-right p-4">Quantity</th>
                          <th className="text-right p-4">Price</th>
                          <th className="text-right p-4">Total Value</th>
                          <th className="text-right p-4">Fee</th>
                          <th className="text-right p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map(trade => (
                          <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-4">
                              <div className="font-medium text-white text-sm">{trade.symbol}</div>
                              <div className="text-xs text-slate-500">{trade.name}</div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                trade.side === 'BUY'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-red-500/10 text-red-500'
                              }`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="p-4 text-right text-slate-300 text-sm">{parseFloat(trade.quantity).toFixed(4)}</td>
                            <td className="p-4 text-right text-slate-300 text-sm">{formatCurrency(trade.price)}</td>
                            <td className="p-4 text-right text-white text-sm">{formatCurrency(trade.total_value)}</td>
                            <td className="p-4 text-right text-slate-500 text-sm">{formatCurrency(trade.fee_amount)}</td>
                            <td className="p-4 text-right text-slate-500 text-xs">
                              {new Date(trade.executed_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Closed Positions Tab */}
          {activeTab === 'positions' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                {closedPositions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No closed positions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[550px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Asset</th>
                          <th className="text-right p-4">Quantity</th>
                          <th className="text-right p-4">Entry Price</th>
                          <th className="text-right p-4">Realized P&L</th>
                          <th className="text-right p-4">Total Fees</th>
                          <th className="text-right p-4">Closed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedPositions.map(pos => (
                          <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                                  pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {pos.type === 'crypto' ? '₿' : pos.symbol?.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                  <div className="text-xs text-slate-500">{pos.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-slate-300 text-sm">{parseFloat(pos.quantity).toFixed(4)}</td>
                            <td className="p-4 text-right text-slate-400 text-sm">{formatCurrency(pos.entry_price)}</td>
                            <td className="p-4 text-right">
                              <div className={`flex items-center justify-end gap-1 font-medium text-sm ${
                                (pos.realized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                              }`}>
                                {(pos.realized_pnl || 0) >= 0
                                  ? <TrendingUp className="h-4 w-4" />
                                  : <TrendingDown className="h-4 w-4" />}
                                {(pos.realized_pnl || 0) >= 0 ? '+' : ''}{formatCurrency(pos.realized_pnl)}
                              </div>
                            </td>
                            <td className="p-4 text-right text-slate-500 text-sm">{formatCurrency(pos.total_fees)}</td>
                            <td className="p-4 text-right text-slate-500 text-xs">
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
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
