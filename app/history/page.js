'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Menu,
  RefreshCw,
  History,
  TrendingUp,
  TrendingDown,
  Loader2,
  Brain,
  X,
  Activity,
  Award,
  Target,
  Zap
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

// ─── AI Trade Coach logic (client-side, deterministic) ────────────────────────
function getAICoach(pos) {
  const pnl = pos.realized_pnl || 0
  const hasStopLoss = pos.stop_loss && parseFloat(pos.stop_loss) > 0
  if (pnl > 0) {
    if (hasStopLoss) return { grade: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'Expert-level trade. You used risk management and it paid off — this is professional discipline.' }
    return { grade: 'B+', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'Strong execution. You capitalized on the trend. Next time add a Stop Loss to protect your gains earlier.' }
  }
  if (pnl < 0) {
    if (hasStopLoss) return { grade: 'C', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: 'Your Stop Loss protected you from a worse outcome. Review your entry timing — the setup may have been premature.' }
    return { grade: 'F', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', text: 'High risk: No Stop Loss was set. Always define your maximum loss before entering a trade to protect your capital.' }
  }
  return { grade: 'B', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', text: 'Break-even trade. The position was flat — look for stronger momentum signals before your next entry.' }
}

// ─── Mini Equity Curve (SVG sparkline) ───────────────────────────────────────
function EquityCurve({ snapshots, startingBalance }) {
  if (!snapshots || snapshots.length < 2) return null
  const values = snapshots.map(s => parseFloat(s.equity || s.balance || 0))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 200, H = 48
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const isUp = values[values.length - 1] >= values[0]
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={points} fill="none" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={points.split(' ').pop().split(',')[0]} cy={points.split(' ').pop().split(',')[1]} r="3" fill={isUp ? '#10b981' : '#ef4444'} />
    </svg>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [trades, setTrades] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [openPositions, setOpenPositions] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [quotes, setQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('history')
  const [closingId, setClosingId] = useState(null)
  const [expandedAI, setExpandedAI] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  // Auto-refresh open P&L every 15s
  useEffect(() => {
    if (!user) return
    intervalRef.current = setInterval(() => refreshQuotes(), 15000)
    return () => clearInterval(intervalRef.current)
  }, [user, openPositions])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      setUser((await res.json()).user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadData = async () => {
    try {
      const [tradesRes, closedRes, openRes, accountRes, snapRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/positions?status=closed'),
        fetch('/api/positions?status=open'),
        fetch('/api/account'),
        fetch('/api/account/snapshots')
      ])
      const [tradesData, closedData, openData, accountData, snapData] = await Promise.all([
        tradesRes.json(), closedRes.json(), openRes.json(), accountRes.json(), snapRes.json()
      ])
      setTrades(tradesData.trades || [])
      setClosedPositions(closedData.positions || [])
      setOpenPositions(openData.positions || [])
      setAccount(accountData)
      setSnapshots(snapData.snapshots || [])
      // Fetch quotes for open positions
      const symbols = [...new Set((openData.positions || []).map(p => `${p.symbol}:${p.type}`))]
      if (symbols.length > 0) {
        try {
          const symbolsParam = symbols
            .map(st => {
              const [sym, typ] = st.split(':')
              return `${sym},${typ || 'stock'}`
            })
            .join('|')
          const r = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(symbolsParam)}`)
          if (r.ok) {
            const d = await r.json()
            setQuotes(d?.quotes || {})
          }
        } catch {}
      }
    } catch (err) { console.error('Failed to load history:', err) }
  }

  const refreshQuotes = async () => {
    if (openPositions.length === 0) return
    const symbols = [...new Set(openPositions.map(p => `${p.symbol}:${p.type}`))]
    try {
      const symbolsParam = symbols
        .map(st => {
          const [sym, typ] = st.split(':')
          return `${sym},${typ || 'stock'}`
        })
        .join('|')
      const r = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(symbolsParam)}`)
      if (r.ok) {
        const d = await r.json()
        setQuotes(prev => ({ ...prev, ...(d?.quotes || {}) }))
      }
    } catch {}
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const quickClose = async (pos) => {
    setClosingId(pos.id)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: pos.symbol, type: pos.type, action: 'SELL', quantity: parseFloat(pos.quantity) })
      })
      if (res.ok) await loadData()
      else console.error('Close failed:', await res.json())
    } catch (err) { console.error('Close error:', err) }
    finally { setClosingId(null) }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)

  const formatDuration = (openedAt, closedAt) => {
    if (!openedAt || !closedAt) return '—'
    const ms = new Date(closedAt) - new Date(openedAt)
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ${mins % 60}m`
    return `${Math.floor(hrs / 24)}d`
  }

  // ─── Performance stats ─────────────────────────────────────────────────────
  const totalRealizedPnl = closedPositions.reduce((s, p) => s + (p.realized_pnl || 0), 0)
  const wins = closedPositions.filter(p => (p.realized_pnl || 0) > 0)
  const losses = closedPositions.filter(p => (p.realized_pnl || 0) < 0)
  const winRate = closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0
  const grossProfit = wins.reduce((s, p) => s + (p.realized_pnl || 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + (p.realized_pnl || 0), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
  const startingBalance = 100000
  const currentBalance = account?.balance || startingBalance
  const accountGrowth = ((currentBalance - startingBalance) / startingBalance) * 100

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  const TABS = [
    { id: 'active', label: 'Active Positions', count: openPositions.length },
    { id: 'history', label: 'Trade History', count: closedPositions.length },
    { id: 'trades', label: 'All Trades', count: trades.length },
  ]

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/history" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-white text-sm">Kartomtrades</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Performance Analytics</h1>
              <p className="text-slate-400 text-sm">Live positions, trade history &amp; AI coaching</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>

          {/* ── Performance Stats Bar ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-400 text-xs">Win Rate</span>
                </div>
                <div className={`text-2xl font-bold ${winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">{wins.length}W / {losses.length}L</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 text-purple-400" />
                  <span className="text-slate-400 text-xs">Profit Factor</span>
                </div>
                <div className={`text-2xl font-bold ${profitFactor >= 1.5 ? 'text-emerald-500' : profitFactor >= 1 ? 'text-amber-400' : 'text-red-500'}`}>
                  {profitFactor === 999 ? '∞' : profitFactor.toFixed(2)}×
                </div>
                <div className="text-xs text-slate-500 mt-1">{profitFactor >= 1.5 ? 'Expert level' : profitFactor >= 1 ? 'Profitable' : 'Below break-even'}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-slate-400 text-xs">Realized P&amp;L</span>
                </div>
                <div className={`text-2xl font-bold ${totalRealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnl)}
                </div>
                <div className="text-xs text-slate-500 mt-1">{closedPositions.length} closed trades</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-400 text-xs">Account Growth</span>
                </div>
                <div className={`text-2xl font-bold ${accountGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {accountGrowth >= 0 ? '+' : ''}{accountGrowth.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">vs {formatCurrency(startingBalance)} start</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800 col-span-2 lg:col-span-1">
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs mb-2">Equity Curve</div>
                <EquityCurve snapshots={snapshots} startingBalance={startingBalance} />
                {snapshots.length < 2 && <div className="text-xs text-slate-600 italic">No data yet</div>}
              </CardContent>
            </Card>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────────── */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* ── Tab: Active Positions ─────────────────────────────────────────── */}
          {activeTab === 'active' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="py-3 px-4 border-b border-slate-800 flex-row items-center justify-between">
                <CardTitle className="text-white text-sm">Live Positions — Auto-refreshes every 15s</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              </CardHeader>
              <CardContent className="p-0">
                {openPositions.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No open positions</p>
                    <Link href="/markets"><Button variant="link" className="text-emerald-500 text-sm">Start Trading →</Button></Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Asset</th>
                          <th className="text-right p-4">Qty</th>
                          <th className="text-right p-4">Entry</th>
                          <th className="text-right p-4">Current</th>
                          <th className="text-right p-4">Unrealized P&amp;L</th>
                          <th className="text-right p-4">Open Since</th>
                          <th className="text-right p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openPositions.map(pos => {
                          const q = quotes[pos.symbol]
                          const current = q?.price || pos.entry_price
                          const pnl = (current - pos.entry_price) * parseFloat(pos.quantity)
                          const pnlPct = ((current / pos.entry_price) - 1) * 100
                          return (
                            <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
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
                              <td className="p-4 text-right text-white text-sm">{q ? formatCurrency(current) : <span className="text-slate-600">—</span>}</td>
                              <td className="p-4 text-right">
                                <div className={`font-bold text-sm ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </div>
                                <div className={`text-xs ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="p-4 text-right text-slate-500 text-xs">
                                {pos.created_at ? new Date(pos.created_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="p-4 text-right">
                                <Button size="sm"
                                  onClick={() => quickClose(pos)}
                                  disabled={closingId === pos.id}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-3">
                                  {closingId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Close'}
                                </Button>
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
          )}

          {/* ── Tab: Trade History (closed) with AI Coach ─────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {closedPositions.length === 0 ? (
                <Card className="bg-[#161b22] border-slate-800">
                  <CardContent className="text-center py-12">
                    <History className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No closed positions yet</p>
                  </CardContent>
                </Card>
              ) : closedPositions.map(pos => {
                const pnl = pos.realized_pnl || 0
                const isWin = pnl > 0
                const ai = getAICoach(pos)
                const isExpanded = expandedAI === pos.id
                return (
                  <Card key={pos.id} className="bg-[#161b22] border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${pos.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {pos.type === 'crypto' ? '₿' : pos.symbol?.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{pos.symbol}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isWin ? '✓ WIN' : '✗ LOSS'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {parseFloat(pos.quantity).toFixed(4)} units · Duration: {formatDuration(pos.created_at, pos.closed_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Entry → Exit</div>
                            <div className="text-sm text-white">{formatCurrency(pos.entry_price)} → <span className={isWin ? 'text-emerald-400' : 'text-red-400'}>{pos.closed_price ? formatCurrency(pos.closed_price) : '—'}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Realized P&amp;L</div>
                            <div className={`text-lg font-bold ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                            </div>
                          </div>
                          <button onClick={() => setExpandedAI(isExpanded ? null : pos.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ai.bg} ${ai.color}`}>
                            <Brain className="h-3 w-3" />
                            AI Coach {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={`mt-3 p-3 rounded-lg border text-sm ${ai.bg}`}>
                          <div className="flex items-start gap-2">
                            <span className={`text-2xl font-black ${ai.color}`}>{ai.grade}</span>
                            <div>
                              <div className={`font-semibold ${ai.color} mb-1`}>AI Trade Coach</div>
                              <p className="text-slate-300 leading-relaxed">{ai.text}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ── Tab: All Trades log ───────────────────────────────────────────── */}
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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${trade.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="p-4 text-right text-slate-300 text-sm">{parseFloat(trade.quantity).toFixed(4)}</td>
                            <td className="p-4 text-right text-slate-300 text-sm">{formatCurrency(trade.price)}</td>
                            <td className="p-4 text-right text-white text-sm">{formatCurrency(trade.total_value)}</td>
                            <td className="p-4 text-right text-slate-500 text-sm">{formatCurrency(trade.fee_amount)}</td>
                            <td className="p-4 text-right text-slate-500 text-xs">{new Date(trade.executed_at).toLocaleString()}</td>
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

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}
