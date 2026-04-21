'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  TrendingUp,
  Menu,
  Activity,
  RefreshCw,
  Loader2,
  CalendarDays,
  BarChart3,
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

// ─────────────────────────────────────────────────────────────────────────────
// Asset-type metadata
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_META = {
  forex:     { label: 'Forex',       color: '#3b82f6' },
  crypto:    { label: 'Crypto',      color: '#f59e0b' },
  stock:     { label: 'Stocks',      color: '#a855f7' },
  index:     { label: 'Indices',     color: '#06b6d4' },
  commodity: { label: 'Commodities', color: '#f97316' },
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutChart — interactive SVG allocation donut
// ─────────────────────────────────────────────────────────────────────────────
function DonutChart({ slices, totalValue, equity, hoveredIdx, onHover }) {
  const cx = 110, cy = 110, outerR = 85, innerR = 56

  // Pre-compute start/end angles for each slice
  const angles = useMemo(() => {
    const result = []
    let acc = -Math.PI / 2
    for (const s of slices) {
      const delta = (s.pct / 100) * 2 * Math.PI
      result.push({ start: acc, end: acc + delta })
      acc += delta
    }
    return result
  }, [slices])

  const hov = hoveredIdx !== null ? slices[hoveredIdx] : null

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg width="220" height="220" viewBox="0 0 220 220">
        {slices.length === 0 ? (
          <circle
            cx={cx} cy={cy} r={(outerR + innerR) / 2}
            fill="none" stroke="#1e293b" strokeWidth={outerR - innerR}
          />
        ) : slices.map((s, i) => {
          const { start, end } = angles[i]
          const mid = (start + end) / 2
          const bump = hoveredIdx === i ? 7 : 0
          const ox = (Math.cos(mid) * bump).toFixed(2)
          const oy = (Math.sin(mid) * bump).toFixed(2)
          const largeArc = (end - start) > Math.PI ? 1 : 0

          const x1o = cx + outerR * Math.cos(start)
          const y1o = cy + outerR * Math.sin(start)
          const x2o = cx + outerR * Math.cos(end)
          const y2o = cy + outerR * Math.sin(end)
          const x1i = cx + innerR * Math.cos(end)
          const y1i = cy + innerR * Math.sin(end)
          const x2i = cx + innerR * Math.cos(start)
          const y2i = cy + innerR * Math.sin(start)

          const path = [
            `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
            `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
            'Z',
          ].join(' ')

          return (
            <path
              key={i}
              d={path}
              fill={s.color}
              transform={`translate(${ox} ${oy})`}
              opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onTouchStart={() => onHover(hoveredIdx === i ? null : i)}
            />
          )
        })}

        {/* Centre hole */}
        <circle cx={cx} cy={cy} r={innerR - 6} fill="#0d1117" />

        {/* Centre text — changes on hover */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill="white" fontSize="10" fontWeight="600" opacity="0.35" fontFamily="inherit">
          {hov ? hov.label.toUpperCase() : 'INVESTED'}
        </text>
        <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="15" fontWeight="700" fontFamily="inherit">
          {hov
            ? `$${hov.value >= 1000 ? (hov.value / 1000).toFixed(1) + 'k' : hov.value.toFixed(0)}`
            : `$${totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue.toFixed(0)}`
          }
        </text>
        {hov ? (
          <text x={cx} y={cy + 24} textAnchor="middle" fill={hov.color} fontSize="13" fontWeight="700" fontFamily="inherit">
            {hov.pct.toFixed(1)}% of equity
          </text>
        ) : (
          <text x={cx} y={cy + 23} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11" fontFamily="inherit">
            {equity > 0 ? ((totalValue / equity) * 100).toFixed(1) + '% of equity' : ''}
          </text>
        )}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PnLCalendar — GitHub-style heatmap for current month
// ─────────────────────────────────────────────────────────────────────────────
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function PnLCalendar({ closedPositions }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const today = now.getDate()

  const [tooltip, setTooltip] = useState(null)

  const dailyPnl = useMemo(() => {
    const map = {}
    for (const pos of closedPositions) {
      if (!pos.closed_at) continue
      const d = new Date(pos.closed_at)
      if (d.getFullYear() !== year || d.getMonth() !== month) continue
      const key = d.getDate()
      map[key] = (map[key] || 0) + Number(pos.realized_pnl || 0)
    }
    return map
  }, [closedPositions, year, month])

  const maxAbs = useMemo(() => Math.max(...Object.values(dailyPnl).map(Math.abs), 1), [dailyPnl])
  const monthName = now.toLocaleString('default', { month: 'long' })

  // Build grid cells: nulls for leading blank days, then 1..daysInMonth
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const getStyle = (day) => {
    if (!day || day > today) return {}
    const pnl = dailyPnl[day]
    if (pnl === undefined) return { backgroundColor: '#1e293b' }
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
    return pnl > 0
      ? { backgroundColor: `rgba(16,185,129,${0.2 + intensity * 0.8})` }
      : { backgroundColor: `rgba(239,68,68,${0.2 + intensity * 0.8})` }
  }

  const tradingDays = Object.keys(dailyPnl).length
  const profitDays = Object.values(dailyPnl).filter(v => v > 0).length
  const totalRealized = Object.values(dailyPnl).reduce((s, v) => s + v, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-white/35 font-semibold">{monthName} {year}</div>
        {tradingDays > 0 && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-white/30">{tradingDays} trading days</span>
            <span className="text-emerald-400 font-semibold">{profitDays}W / {tradingDays - profitDays}L</span>
            <span className={`font-semibold ${totalRealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalRealized >= 0 ? '+' : ''}${totalRealized.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-white/20 font-medium">{d}</div>
        ))}
      </div>

      {/* Day squares */}
      <div className="grid grid-cols-7 gap-1 relative">
        {cells.map((day, i) => {
          const hasPnl = day && dailyPnl[day] !== undefined
          const isToday = day === today
          return (
            <div
              key={i}
              className={`aspect-square rounded-sm transition-transform ${hasPnl ? 'cursor-default hover:scale-110' : ''} relative`}
              style={getStyle(day)}
              onMouseEnter={() => hasPnl && setTooltip({ day, pnl: dailyPnl[day] })}
              onMouseLeave={() => setTooltip(null)}
            >
              {isToday && (
                <div className="absolute inset-0 rounded-sm ring-1 ring-emerald-400/70 ring-offset-1 ring-offset-[#0d1117]" />
              )}
              {tooltip?.day === day && (
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 bg-slate-800 border border-white/10 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-xl pointer-events-none">
                  {monthName} {day}: <span className={tooltip.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {tooltip.pnl >= 0 ? '+' : ''}${tooltip.pnl.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-2.5 text-[10px] text-white/25">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1e293b]" /> No trades</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Profit</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/70" /> Loss</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [account, setAccount] = useState(null)
  const [openPositions, setOpenPositions] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [quotes, setQuotes] = useState({})
  const [marketPrices, setMarketPrices] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  // Donut hover
  const [hoveredSlice, setHoveredSlice] = useState(null)

  // Pulse animation — track prev P&L per position id
  const prevPnlsRef = useRef({})
  const [pulsingRows, setPulsingRows] = useState({}) // { id: 'up' | 'down' }

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  // Poll market prices every 3s for live P&L
  useEffect(() => {
    if (!user) return
    fetch('/api/market/prices', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.prices) setMarketPrices(d.prices) })
      .catch(() => {})
    const id = setInterval(() => {
      fetch('/api/market/tick', { method: 'POST' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.prices) setMarketPrices(d.prices) })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [user])

  // Pulse detection — fires when marketPrices or quotes change
  useEffect(() => {
    if (openPositions.length === 0) return
    const newPulsing = {}
    for (const pos of openPositions) {
      const cp = getPositionCurrentPrice(pos)
      if (cp === null) continue
      const pnl = computePnl(pos, cp)
      const posValue = Math.abs(pos.entry_price * pos.quantity) || 1
      const prev = prevPnlsRef.current[pos.id]
      if (prev !== undefined) {
        const changePct = Math.abs(pnl - prev) / posValue * 100
        if (changePct >= 1) {
          newPulsing[pos.id] = pnl > prev ? 'up' : 'down'
        }
      }
      prevPnlsRef.current[pos.id] = pnl
    }
    if (Object.keys(newPulsing).length > 0) {
      setPulsingRows(p => ({ ...p, ...newPulsing }))
      setTimeout(() => {
        setPulsingRows(p => {
          const next = { ...p }
          Object.keys(newPulsing).forEach(id => delete next[id])
          return next
        })
      }, 1500)
    }
  }, [marketPrices, quotes, openPositions])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch { router.push('/') } finally { setLoading(false) }
  }

  const loadData = async () => {
    try {
      const [accountRes, openRes, closedRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/positions?status=open'),
        fetch('/api/positions?status=closed'),
      ])
      const accountData = await accountRes.json()
      const openData    = await openRes.json()
      const closedData  = await closedRes.json()

      setAccount(accountData)
      setOpenPositions(openData.positions || [])
      setClosedPositions(closedData.positions || [])

      const symbols = new Set()
      openData.positions?.forEach(pos => symbols.add(`${pos.symbol}:${pos.type}`))
      if (symbols.size > 0) fetchQuotes(Array.from(symbols))
    } catch (err) { console.error('Failed to load portfolio:', err) }
  }

  const fetchQuotes = async (symbolTypes) => {
    try {
      const param = symbolTypes.map(st => {
        const [s, t] = st.split(':'); return `${s},${t || 'stock'}`
      }).join('|')
      const res = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(param)}`)
      if (res.ok) setQuotes((await res.json())?.quotes || {})
    } catch {}
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  // Pick best available current price for a position
  const getPositionCurrentPrice = useCallback((pos) => {
    const sym = pos.symbol
    // Market prices (forex/index/commodity) have mid
    const mp = marketPrices[sym]
    if (mp?.mid) return Number(mp.mid)
    // Quotes (stock/crypto)
    const q = quotes[sym]
    if (q?.price) return Number(q.price)
    return null
  }, [marketPrices, quotes])

  const computePnl = (pos, currentPrice) => {
    const side = (pos.side || 'BUY').toUpperCase()
    const diff = side === 'BUY'
      ? currentPrice - pos.entry_price
      : pos.entry_price - currentPrice
    return diff * Math.abs(pos.quantity)
  }

  const cashBalance  = account?.balance    ?? 0
  const availableCash = account?.available  ?? cashBalance
  const openPnl      = account?.openPnl    ?? 0
  const realizedPnl  = account?.realizedPnl ?? 0
  const totalPnl     = openPnl + realizedPnl
  const equity       = account?.equity      ?? (cashBalance + openPnl)

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)

  // ── Donut slices ────────────────────────────────────────────────────────
  const donutSlices = useMemo(() => {
    const groups = {}
    for (const pos of openPositions) {
      const type = pos.type || 'stock'
      const cp   = getPositionCurrentPrice(pos) ?? pos.entry_price
      const val  = Math.abs(cp * pos.quantity)
      groups[type] = (groups[type] || 0) + val
    }
    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    if (total === 0) return []
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({
        type,
        label: TYPE_META[type]?.label || type,
        color: TYPE_META[type]?.color || '#64748b',
        value,
        pct: (value / total) * 100,
      }))
  }, [openPositions, getPositionCurrentPrice])

  const totalPositionsValue = donutSlices.reduce((s, sl) => s + sl.value, 0)

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/portfolio" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Portfolio</span>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Portfolio</h1>
              <p className="text-slate-400 text-sm">Your positions and performance</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing} className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* ── Account Summary ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 border border-slate-700 rounded-xl">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${equity >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      <TrendingUp className={`h-5 w-5 ${equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Total Equity</div>
                      <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">{formatCurrency(equity)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Cash + open P&amp;L</div>
                    </div>
                  </div>
                  <div className={`self-start px-3 py-1 rounded-full text-xs font-semibold border ${totalPnl >= 0 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-500/10' : 'text-red-300 border-red-700/50 bg-red-500/10'}`}>
                    {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)} total P&amp;L
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Cash</div>
                    <div className="text-base font-semibold text-white tabular-nums">{formatCurrency(cashBalance)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">After realized P&amp;L</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Available</div>
                    <div className="text-base font-semibold text-white tabular-nums">{formatCurrency(availableCash)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Ready to trade</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/30 border border-slate-700/40 p-3 hidden sm:block">
                    <div className="text-xs text-slate-400 font-semibold uppercase">P&amp;L Split</div>
                    <div className={`text-sm font-semibold tabular-nums ${openPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{openPnl >= 0 ? '+' : ''}{formatCurrency(openPnl)} open</div>
                    <div className={`text-sm font-semibold tabular-nums ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl)} realized</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Allocation Donut + P&L Calendar ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Allocation Donut */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalPositionsValue === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                    <BarChart3 className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No open positions</p>
                    <Link href="/markets">
                      <Button variant="link" className="text-emerald-500 text-xs p-0 h-auto">Start Trading →</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <DonutChart
                      slices={donutSlices}
                      totalValue={totalPositionsValue}
                      equity={equity}
                      hoveredIdx={hoveredSlice}
                      onHover={setHoveredSlice}
                    />
                    <div className="flex-1 space-y-2 w-full">
                      {donutSlices.map((s, i) => (
                        <div
                          key={s.type}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-default transition-all duration-150 ${hoveredSlice === i ? 'border-white/20 bg-white/[0.06]' : 'border-transparent hover:bg-white/[0.03]'}`}
                          onMouseEnter={() => setHoveredSlice(i)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-sm text-slate-300">{s.label}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(s.value)}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">{s.pct.toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                      {/* Cash slice */}
                      <div className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-slate-600 flex-shrink-0" />
                          <span className="text-sm text-slate-500">Cash</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-500 tabular-nums">{formatCurrency(cashBalance)}</div>
                          <div className="text-[11px] text-slate-600 tabular-nums">
                            {equity > 0 ? ((cashBalance / equity) * 100).toFixed(1) + '%' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* P&L Calendar Heatmap */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  P&amp;L Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closedPositions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                    <CalendarDays className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No closed trades this month</p>
                  </div>
                ) : (
                  <PnLCalendar closedPositions={closedPositions} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Positions Tabs ──────────────────────────────────────────────── */}
          <Tabs defaultValue="open" className="space-y-4">
            <TabsList className="bg-slate-800">
              <TabsTrigger value="open" className="data-[state=active]:bg-emerald-600">
                Open ({openPositions.length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="data-[state=active]:bg-emerald-600">
                Closed ({closedPositions.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Open positions ─────────────────────────────────────────── */}
            <TabsContent value="open">
              <Card className="bg-[#161b22] border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  {openPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No open positions</p>
                      <Link href="/markets">
                        <Button variant="link" className="text-emerald-500 mt-2">Start Trading →</Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="md:hidden divide-y divide-slate-800">
                        {openPositions.map(pos => {
                          const cp  = getPositionCurrentPrice(pos) ?? pos.entry_price
                          const pnl = computePnl(pos, cp)
                          const pnlPct = ((cp / pos.entry_price) - 1) * 100 * (pos.side === 'SELL' ? -1 : 1)
                          const pulse = pulsingRows[pos.id]
                          return (
                            <div
                              key={pos.id}
                              className="p-4 flex items-start justify-between gap-3 transition-all duration-700"
                              style={pulse === 'up'
                                ? { boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.4), 0 0 12px rgba(16,185,129,0.15)' }
                                : pulse === 'down'
                                ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.4), 0 0 12px rgba(239,68,68,0.15)' }
                                : {}
                              }
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                                  TYPE_META[pos.type]
                                    ? `bg-[${TYPE_META[pos.type].color}]/10`
                                    : 'bg-slate-700'
                                }`} style={{ backgroundColor: `${(TYPE_META[pos.type]?.color || '#64748b')}1a` }}>
                                  {pos.symbol.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(pos.side || 'BUY') === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                      {pos.side || 'BUY'}
                                    </span>
                                    <span>{pos.quantity} @ {formatCurrency(pos.entry_price)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`font-semibold tabular-nums text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </div>
                                <div className={`text-xs tabular-nums ${pnlPct >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-slate-500 text-xs border-b border-slate-800 uppercase tracking-wider">
                              <th className="text-left p-4">Asset</th>
                              <th className="text-center p-4">Side</th>
                              <th className="text-right p-4">Size</th>
                              <th className="text-right p-4">Entry</th>
                              <th className="text-right p-4">Current</th>
                              <th className="text-right p-4">Value</th>
                              <th className="text-right p-4">P&amp;L</th>
                              <th className="text-center p-4">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {openPositions.map(pos => {
                              const cp  = getPositionCurrentPrice(pos) ?? pos.entry_price
                              const pnl = computePnl(pos, cp)
                              const pnlPct = ((cp / pos.entry_price) - 1) * 100 * ((pos.side || 'BUY') === 'SELL' ? -1 : 1)
                              const currentValue = Math.abs(cp * pos.quantity)
                              const pulse = pulsingRows[pos.id]
                              return (
                                <tr
                                  key={pos.id}
                                  className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-all duration-700"
                                  style={pulse === 'up'
                                    ? { boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.35), inset 0 0 20px rgba(16,185,129,0.07)' }
                                    : pulse === 'down'
                                    ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.35), inset 0 0 20px rgba(239,68,68,0.07)' }
                                    : {}
                                  }
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: `${(TYPE_META[pos.type]?.color || '#64748b')}1a`, color: TYPE_META[pos.type]?.color || '#94a3b8' }}
                                      >
                                        {pos.symbol.slice(0, 2)}
                                      </div>
                                      <div>
                                        <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                        <div className="text-xs text-slate-500">{pos.name || (TYPE_META[pos.type]?.label || pos.type)}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${(pos.side || 'BUY') === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                      {pos.side || 'BUY'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right text-slate-300 tabular-nums">{pos.quantity}</td>
                                  <td className="p-4 text-right text-slate-400 tabular-nums">{formatCurrency(pos.entry_price)}</td>
                                  <td className="p-4 text-right text-white tabular-nums">{formatCurrency(cp)}</td>
                                  <td className="p-4 text-right text-white font-medium tabular-nums">{formatCurrency(currentValue)}</td>
                                  <td className="p-4 text-right">
                                    <div className={`font-semibold tabular-nums text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                    </div>
                                    <div className={`text-xs tabular-nums ${pnlPct >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                                      ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                    </div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <Link href={`/markets?select=${pos.symbol}&type=${pos.type}`}>
                                      <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-700 text-xs h-7">
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
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Closed positions ───────────────────────────────────────── */}
            <TabsContent value="closed">
              <Card className="bg-[#161b22] border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  {closedPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No closed positions yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile */}
                      <div className="md:hidden divide-y divide-slate-800">
                        {closedPositions.map(pos => {
                          const pnl = pos.realized_pnl || 0
                          return (
                            <div key={pos.id} className="p-4 flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                  style={{ backgroundColor: `${(TYPE_META[pos.type]?.color || '#64748b')}1a`, color: TYPE_META[pos.type]?.color || '#94a3b8' }}
                                >
                                  {pos.symbol.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                  <div className="text-xs text-slate-500">{pos.quantity} @ {formatCurrency(pos.entry_price)}</div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`font-semibold text-sm tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {pos.closed_at ? new Date(pos.closed_at).toLocaleDateString() : '—'}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-slate-500 text-xs border-b border-slate-800 uppercase tracking-wider">
                              <th className="text-left p-4">Asset</th>
                              <th className="text-center p-4">Side</th>
                              <th className="text-right p-4">Size</th>
                              <th className="text-right p-4">Entry</th>
                              <th className="text-right p-4">Realized P&amp;L</th>
                              <th className="text-right p-4">Closed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {closedPositions.map(pos => {
                              const pnl = pos.realized_pnl || 0
                              return (
                                <tr key={pos.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: `${(TYPE_META[pos.type]?.color || '#64748b')}1a`, color: TYPE_META[pos.type]?.color || '#94a3b8' }}
                                      >
                                        {pos.symbol.slice(0, 2)}
                                      </div>
                                      <div>
                                        <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                        <div className="text-xs text-slate-500">{pos.name || (TYPE_META[pos.type]?.label || pos.type)}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${(pos.side || 'BUY') === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                      {pos.side || 'BUY'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right text-slate-300 tabular-nums">{pos.quantity}</td>
                                  <td className="p-4 text-right text-slate-400 tabular-nums">{formatCurrency(pos.entry_price)}</td>
                                  <td className="p-4 text-right">
                                    <div className={`font-semibold text-sm tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right text-slate-400 tabular-nums text-sm">
                                    {pos.closed_at ? new Date(pos.closed_at).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
