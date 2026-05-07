'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Menu, RefreshCw, Loader2, Brain, Activity,
  Award, Target, Zap, TrendingUp, CalendarDays,
  BarChart3, PieChart, ChevronDown, ChevronUp, Download
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

// ─── Asset type colours ────────────────────────────────────────────────────────
const TYPE_META = {
  forex:     { label: 'Forex',       color: '#3b82f6' },
  crypto:    { label: 'Crypto',      color: '#f59e0b' },
  stock:     { label: 'Stocks',      color: '#a855f7' },
  index:     { label: 'Indices',     color: '#06b6d4' },
  commodity: { label: 'Commodities', color: '#f97316' },
}

// ─── Equity curve (smooth SVG, zoom by range) ─────────────────────────────────
const RANGES = ['1W', '1M', 'All']

function EquityCurveChart({ snapshots }) {
  const [range, setRange] = useState('1M')

  const filtered = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    const cutoffs = { '1W': 7, '1M': 30, 'All': Infinity }
    const days = cutoffs[range] ?? Infinity
    const cutoff = Date.now() - days * 86400000
    const pts = snapshots
      .filter(s => days === Infinity || new Date(s.created_at || s.taken_at || 0).getTime() >= cutoff)
      .sort((a, b) => new Date(a.created_at || a.taken_at) - new Date(b.created_at || b.taken_at))
    return pts.length >= 2 ? pts : snapshots.slice().sort((a, b) => new Date(a.created_at || a.taken_at) - new Date(b.created_at || b.taken_at))
  }, [snapshots, range])

  if (!filtered || filtered.length < 2) return (
    <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm">No data yet</div>
  )

  const values = filtered.map(s => parseFloat(s.equity || s.balance || 0))
  const start = values[0], latest = values[values.length - 1]
  const pct = ((latest - start) / (start || 1) * 100)
  const isUp = pct >= 0
  const W = 600, H = 120
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / span) * (H - 12) - 6,
  }))

  // Smooth cubic-bezier path
  const curvePath = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
    const prev = coords[i - 1]
    const cpx = ((prev.x + pt.x) / 2).toFixed(1)
    return `${acc} C ${cpx},${prev.y.toFixed(1)} ${cpx},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
  }, '')
  const areaPath = `${curvePath} L ${W},${H} L 0,${H} Z`
  const color = isUp ? '#10b981' : '#ef4444'
  const gradId = `ecg_${range}`
  const last = coords[coords.length - 1]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Account Equity</div>
          <div className="text-2xl font-bold text-white tabular-nums">${Math.round(latest).toLocaleString()}</div>
          <div className={`text-xs font-semibold mt-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{pct.toFixed(2)}% ({isUp ? '+' : ''}${(latest - start).toLocaleString(undefined, {maximumFractionDigits: 0})})
          </div>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${range === r ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[110px]">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={curvePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="5" fill={color} opacity="0.35" />
        <circle cx={last.x} cy={last.y} r="3" fill={color} />
      </svg>
    </div>
  )
}

// ─── Win/Loss streak ribbon ────────────────────────────────────────────────────
function StreakRibbon({ positions }) {
  // ALL hooks must be called before any early return
  const [tooltip, setTooltip] = useState(null)

  const entries = useMemo(() =>
    [...positions]
      .sort((a, b) => new Date(a.closed_at || 0) - new Date(b.closed_at || 0))
      .map(p => ({ id: p.id, win: (p.realized_pnl || 0) > 0, pnl: p.realized_pnl || 0, symbol: p.symbol }))
  , [positions])

  const { streaks, maxStreak } = useMemo(() => {
    const streaks = []; let cur = null
    for (const e of entries) {
      if (!cur || cur.win !== e.win) { cur = { win: e.win, start: streaks.reduce((s, x) => s + x.len, 0), len: 1 }; streaks.push(cur) }
      else cur.len++
    }
    return { streaks, maxStreak: streaks.length > 0 ? Math.max(...streaks.map(s => s.len)) : 0 }
  }, [entries])

  if (entries.length === 0) return (
    <div className="flex items-center justify-center h-16 text-slate-600 text-sm">No closed trades yet</div>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {streaks.map((s, i) => {
          if (s.len >= 3) return (
            <div key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.win ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              {s.win ? '🔥' : '❄️'} {s.len} {s.win ? 'W' : 'L'} streak
            </div>
          )
          return null
        })}
        {maxStreak < 3 && <span className="text-[11px] text-slate-500">No streak ≥ 3 yet</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 relative">
        {entries.map((e, idx) => {
          const streak = streaks.find(s => idx >= s.start && idx < s.start + s.len)
          const inHighlightStreak = streak && streak.len >= 3
          return (
            <div key={e.id} className="relative group">
              <div
                className={`w-5 h-5 rounded-sm cursor-default transition-transform hover:scale-125 ${e.win ? 'bg-emerald-500' : 'bg-red-500'} ${inHighlightStreak ? 'ring-1 ring-white/30' : 'opacity-75'}`}
                onMouseEnter={() => setTooltip({ idx, ...e })}
                onMouseLeave={() => setTooltip(null)}
              />
              {tooltip?.idx === idx && (
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 bg-slate-800 border border-white/10 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-xl pointer-events-none">
                  {e.symbol}: <span className={e.win ? 'text-emerald-400' : 'text-red-400'}>{e.win ? '+' : ''}${e.pnl.toFixed(2)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Win</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Loss</span>
        <span>Brighter = streak of 3+</span>
        <span className="ml-auto">{entries.length} total</span>
      </div>
    </div>
  )
}

// ─── P&L Calendar heatmap ─────────────────────────────────────────────────────
const DAY_LABELS = ['S','M','T','W','T','F','S']

function PnLCalendar({ closedPositions }) {
  const now = new Date(), year = now.getFullYear(), month = now.getMonth()
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
      const key = d.getDate(); map[key] = (map[key] || 0) + Number(pos.realized_pnl || 0)
    }
    return map
  }, [closedPositions, year, month])

  const maxAbs = useMemo(() => Math.max(...Object.values(dailyPnl).map(Math.abs), 1), [dailyPnl])
  const monthName = now.toLocaleString('default', { month: 'long' })
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

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
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-400">{monthName} {year}</div>
        {tradingDays > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-500">{tradingDays} trading days</span>
            <span className="text-emerald-400 font-semibold">{profitDays}W / {tradingDays - profitDays}L</span>
            <span className={`font-semibold ${totalRealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalRealized >= 0 ? '+' : ''}${totalRealized.toFixed(0)}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => <div key={i} className="text-center text-[10px] text-slate-600 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const hasPnl = day && dailyPnl[day] !== undefined
          return (
            <div key={i}
              className={`aspect-square rounded-sm ${hasPnl ? 'cursor-default hover:scale-110 transition-transform' : ''} relative`}
              style={getStyle(day)}
              onMouseEnter={() => hasPnl && setTooltip({ day, pnl: dailyPnl[day] })}
              onMouseLeave={() => setTooltip(null)}
            >
              {day === today && <div className="absolute inset-0 rounded-sm ring-1 ring-emerald-400/60 ring-offset-1 ring-offset-[#161b22]" />}
              {tooltip?.day === day && (
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 bg-slate-800 border border-white/10 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-xl pointer-events-none">
                  {monthName} {day}: <span className={tooltip.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{tooltip.pnl >= 0 ? '+' : ''}${tooltip.pnl.toFixed(2)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1e293b]" /> No trades</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/70" /> Profit</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/70" /> Loss</span>
      </div>
    </div>
  )
}

// ─── Interactive allocation donut ──────────────────────────────────────────────
function DonutChart({ slices, totalValue, equity, hoveredIdx, onHover }) {
  const cx = 90, cy = 90, outerR = 72, innerR = 46
  const angles = useMemo(() => {
    const result = []; let acc = -Math.PI / 2
    for (const s of slices) {
      const delta = (s.pct / 100) * 2 * Math.PI
      result.push({ start: acc, end: acc + delta }); acc += delta
    }
    return result
  }, [slices])
  const hov = hoveredIdx !== null ? slices[hoveredIdx] : null
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="select-none">
      {slices.length === 0
        ? <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="#1e293b" strokeWidth={outerR - innerR} />
        : slices.map((s, i) => {
          const { start, end } = angles[i]
          const mid = (start + end) / 2, bump = hoveredIdx === i ? 6 : 0
          const ox = (Math.cos(mid) * bump).toFixed(2), oy = (Math.sin(mid) * bump).toFixed(2)
          const la = (end - start) > Math.PI ? 1 : 0
          const x1o = cx + outerR * Math.cos(start), y1o = cy + outerR * Math.sin(start)
          const x2o = cx + outerR * Math.cos(end), y2o = cy + outerR * Math.sin(end)
          const x1i = cx + innerR * Math.cos(end), y1i = cy + innerR * Math.sin(end)
          const x2i = cx + innerR * Math.cos(start), y2i = cy + innerR * Math.sin(start)
          const path = `M ${x1o.toFixed(1)} ${y1o.toFixed(1)} A ${outerR} ${outerR} 0 ${la} 1 ${x2o.toFixed(1)} ${y2o.toFixed(1)} L ${x1i.toFixed(1)} ${y1i.toFixed(1)} A ${innerR} ${innerR} 0 ${la} 0 ${x2i.toFixed(1)} ${y2i.toFixed(1)} Z`
          return (
            <path key={i} d={path} fill={s.color} transform={`translate(${ox} ${oy})`}
              opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.35}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}
              onTouchStart={() => onHover(hoveredIdx === i ? null : i)} />
          )
        })
      }
      <circle cx={cx} cy={cy} r={innerR - 5} fill="#161b22" />
      <text x={cx} y={cy - 11} textAnchor="middle" fill="white" fontSize="8" fontWeight="600" opacity="0.35" fontFamily="inherit">{hov ? hov.label.toUpperCase() : 'OPEN'}</text>
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="inherit">
        {hov ? `$${hov.value >= 1000 ? (hov.value/1000).toFixed(1)+'k' : hov.value.toFixed(0)}` : `$${totalValue >= 1000 ? (totalValue/1000).toFixed(1)+'k' : totalValue.toFixed(0)}`}
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fill={hov ? hov.color : 'rgba(255,255,255,0.3)'} fontSize="10" fontWeight="600" fontFamily="inherit">
        {hov ? `${hov.pct.toFixed(1)}% of equity` : equity > 0 ? `${((totalValue / equity) * 100).toFixed(1)}% invested` : ''}
      </text>
    </svg>
  )
}

// ─── AI pattern detection ──────────────────────────────────────────────────────
function getAIInsights(closedPositions, marketPrices) {
  const insights = []
  if (closedPositions.length === 0) return insights

  // Per-trade grade
  const gradePos = (pos) => {
    const pnl = pos.realized_pnl || 0
    const hasSL = pos.stop_loss && parseFloat(pos.stop_loss) > 0
    if (pnl > 0) return hasSL ? { grade: 'A',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' } : { grade: 'B+', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
    if (pnl < 0) return hasSL ? { grade: 'C',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'   } : { grade: 'F',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'       }
    return { grade: 'B', color: 'text-slate-400', bg: 'bg-slate-700/40 border-slate-600/40' }
  }

  // 1. Early exits — group by symbol, count positions where closed_price < entry but symbol went on to higher
  const bySymbol = {}
  for (const p of closedPositions) {
    const sym = p.symbol; if (!bySymbol[sym]) bySymbol[sym] = []
    bySymbol[sym].push(p)
  }
  for (const [sym, trades] of Object.entries(bySymbol)) {
    const earlyWins = trades.filter(t => {
      if ((t.realized_pnl || 0) <= 0) return false
      const entry = parseFloat(t.entry_price), closed = parseFloat(t.closed_price || entry)
      return (closed - entry) / entry < 0.005 // closed < 0.5% gain — could have held
    })
    if (earlyWins.length >= 2) {
      insights.push({ type: 'pattern', icon: '📈', title: `Early exits on ${sym}`, text: `You closed ${earlyWins.length} ${sym} trades with tiny gains. These setups usually move further — consider a wider TP or trailing stop.` })
    }
  }

  // 2. No stop-loss pattern
  const noSLLosses = closedPositions.filter(p => (p.realized_pnl || 0) < 0 && (!p.stop_loss || parseFloat(p.stop_loss) === 0))
  if (noSLLosses.length >= 2) {
    const avgLoss = noSLLosses.reduce((s, p) => s + Math.abs(p.realized_pnl || 0), 0) / noSLLosses.length
    insights.push({ type: 'warning', icon: '⛔', title: 'Missing stop-losses', text: `${noSLLosses.length} losing trades had no stop-loss. Average loss: $${avgLoss.toFixed(2)}. Set stop-losses before every entry to cap your downside.` })
  }

  // 3. Win/loss ratio
  const wins = closedPositions.filter(p => (p.realized_pnl || 0) > 0)
  const losses = closedPositions.filter(p => (p.realized_pnl || 0) < 0)
  if (wins.length > 0 && losses.length > 0) {
    const avgWin = wins.reduce((s, p) => s + (p.realized_pnl || 0), 0) / wins.length
    const avgLoss = Math.abs(losses.reduce((s, p) => s + (p.realized_pnl || 0), 0)) / losses.length
    const rr = avgWin / avgLoss
    if (rr < 1) {
      insights.push({ type: 'warning', icon: '⚖️', title: 'R:R below 1:1', text: `Your average win ($${avgWin.toFixed(2)}) is smaller than your average loss ($${avgLoss.toFixed(2)}). Ratio: ${rr.toFixed(2)}:1. Aim for at least 1.5:1 to stay profitable long-term.` })
    } else {
      insights.push({ type: 'positive', icon: '✅', title: `Strong R:R — ${rr.toFixed(2)}:1`, text: `Your average win is ${rr.toFixed(2)}× your average loss. This is above the 1:1 minimum — keep this discipline.` })
    }
  }

  // 4. Best performing symbol
  const symPnl = {}
  for (const p of closedPositions) { symPnl[p.symbol] = (symPnl[p.symbol] || 0) + (p.realized_pnl || 0) }
  const best = Object.entries(symPnl).sort((a, b) => b[1] - a[1])[0]
  const worst = Object.entries(symPnl).sort((a, b) => a[1] - b[1])[0]
  if (best && best[1] > 0) insights.push({ type: 'positive', icon: '⭐', title: `Best: ${best[0]}`, text: `${best[0]} is your most profitable instrument (+$${best[1].toFixed(2)}). Focus more capital here when the setup is clean.` })
  if (worst && worst[1] < 0) insights.push({ type: 'warning', icon: '🔴', title: `Watch: ${worst[0]}`, text: `${worst[0]} has cost you $${Math.abs(worst[1]).toFixed(2)} total. Review your setups on this instrument before the next entry.` })

  return insights.slice(0, 5)
}

function getPerTradeGrade(pos) {
  const pnl = pos.realized_pnl || 0
  const hasSL = pos.stop_loss && parseFloat(pos.stop_loss) > 0
  if (pnl > 0) return hasSL
    ? { grade: 'A',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'Expert execution — profitable with risk management in place.' }
    : { grade: 'B+', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'Good result. Add a Stop Loss next time to lock in gains earlier.' }
  if (pnl < 0) return hasSL
    ? { grade: 'C',  color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', text: 'Stop Loss limited the damage — review your entry timing.' }
    : { grade: 'F',  color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     text: 'No Stop Loss set. Always define your max loss before entering.' }
  return { grade: 'B', color: 'text-slate-400', bg: 'bg-slate-700/40 border-slate-600/40', text: 'Break-even. Look for stronger conviction before next entry.' }
}

// ─── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'Overview'     },
  { id: 'positions',  label: 'Positions'    },
  { id: 'history',    label: 'Trade History'},
  { id: 'coach',      label: 'AI Coach'     },
  { id: 'log',        label: 'Trade Log'    },
]

export default function AnalyticsPage() {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [account, setAccount]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab]     = useState('overview')
  const [refreshing, setRefreshing]   = useState(false)
  const [closingId, setClosingId]     = useState(null)
  const [expandedAI, setExpandedAI]   = useState(null)
  const [hoveredSlice, setHoveredSlice] = useState(null)

  const [openPositions,   setOpenPositions]   = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [trades,          setTrades]          = useState([])
  const [snapshots,       setSnapshots]       = useState([])
  const [quotes,          setQuotes]          = useState({})
  const [marketPrices,    setMarketPrices]    = useState({})

  const intervalRef = useRef(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  // Live market prices + quotes refresh
  useEffect(() => {
    if (!user) return
    fetch('/api/market/prices', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.prices) setMarketPrices(d.prices) }).catch(() => {})
    intervalRef.current = setInterval(() => {
      fetch('/api/market/tick', { method: 'POST' })
        .then(r => r.ok ? r.json() : null).then(d => { if (d?.prices) setMarketPrices(d.prices) }).catch(() => {})
    }, 5000)
    return () => clearInterval(intervalRef.current)
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      setUser((await res.json()).user)
    } catch { router.push('/') } finally { setLoading(false) }
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

      const symbols = [...new Set((openData.positions || []).map(p => `${p.symbol}:${p.type}`))]
      if (symbols.length > 0) fetchQuotes(symbols)
    } catch (err) { console.error('[Analytics] loadData:', err) }
  }

  const fetchQuotes = async (symbolTypes) => {
    try {
      const param = symbolTypes.map(st => { const [s, t] = st.split(':'); return `${s},${t || 'stock'}` }).join('|')
      const r = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(param)}`)
      if (r.ok) setQuotes((await r.json())?.quotes || {})
    } catch {}
  }

  const refreshData = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const getPrice = useCallback((pos) => {
    const mp = marketPrices[pos.symbol]; if (mp?.mid) return Number(mp.mid)
    const q = quotes[pos.symbol]; if (q?.price) return Number(q.price)
    return null
  }, [marketPrices, quotes])

  const computePnl = (pos, cp) => {
    const side = (pos.side || 'BUY').toUpperCase()
    return (side === 'BUY' ? cp - pos.entry_price : pos.entry_price - cp) * Math.abs(pos.quantity)
  }

  const quickClose = async (pos) => {
    setClosingId(pos.id)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: pos.symbol, type: pos.type, action: 'SELL', quantity: parseFloat(pos.quantity) })
      })
      if (res.ok) await loadData()
    } catch {} finally { setClosingId(null) }
  }

  const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)
  const fmtDur = (openedAt, closedAt) => {
    if (!openedAt || !closedAt) return '—'
    const mins = Math.floor((new Date(closedAt) - new Date(openedAt)) / 60000)
    if (mins < 60) return `${mins}m`; if (mins < 1440) return `${Math.floor(mins/60)}h`; return `${Math.floor(mins/1440)}d`
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const wins    = closedPositions.filter(p => (p.realized_pnl || 0) > 0)
  const losses  = closedPositions.filter(p => (p.realized_pnl || 0) < 0)
  const winRate = closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0
  const grossProfit = wins.reduce((s, p) => s + (p.realized_pnl || 0), 0)
  const grossLoss   = Math.abs(losses.reduce((s, p) => s + (p.realized_pnl || 0), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
  const totalRealizedPnl = closedPositions.reduce((s, p) => s + (p.realized_pnl || 0), 0)
  const startingBalance  = 100000
  const currentBalance   = account?.balance || startingBalance
  const accountGrowth    = ((currentBalance - startingBalance) / startingBalance) * 100
  const cashBalance      = account?.balance ?? 0
  const openPnl          = account?.openPnl ?? 0
  const equity           = account?.equity ?? (cashBalance + openPnl)

  const donutSlices = useMemo(() => {
    const groups = {}
    for (const pos of openPositions) {
      const type = pos.type || 'stock', cp = getPrice(pos) ?? pos.entry_price
      groups[type] = (groups[type] || 0) + Math.abs(cp * pos.quantity)
    }
    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    if (total === 0) return []
    return Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([type, value]) => ({
      type, label: TYPE_META[type]?.label || type, color: TYPE_META[type]?.color || '#64748b',
      value, pct: (value / total) * 100,
    }))
  }, [openPositions, getPrice])

  const totalPositionsValue = donutSlices.reduce((s, sl) => s + sl.value, 0)
  const aiInsights = useMemo(() => getAIInsights(closedPositions, marketPrices), [closedPositions, marketPrices])

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/history" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0">
        {/* Mobile nav */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
          <span className="font-bold text-white text-sm">Analytics</span>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Analytics</h1>
              <p className="text-slate-400 text-sm">Portfolio · Performance · History · AI Coach</p>
            </div>
            <div className="flex items-center gap-3">
              {account && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  (account.tradingMode ?? account.trading_mode) === 'DEMO'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {(account.tradingMode ?? account.trading_mode) === 'DEMO' ? '🎯 Demo Data' : '💼 Real Data'}
                </span>
              )}
              <Button variant="ghost" onClick={refreshData} disabled={refreshing}
                className="hidden lg:flex text-slate-400 hover:text-white">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>
          </div>

          {/* ── Stats bar ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="bg-[#161b22] border-slate-800"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-blue-400" /><span className="text-slate-500 text-xs">Win Rate</span></div>
              <div className={`text-2xl font-bold ${winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{winRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-500 mt-0.5">{wins.length}W / {losses.length}L</div>
            </CardContent></Card>
            <Card className="bg-[#161b22] border-slate-800"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Award className="h-4 w-4 text-purple-400" /><span className="text-slate-500 text-xs">Profit Factor</span></div>
              <div className={`text-2xl font-bold ${profitFactor >= 1.5 ? 'text-emerald-500' : profitFactor >= 1 ? 'text-amber-400' : 'text-red-500'}`}>{profitFactor === 999 ? '∞' : profitFactor.toFixed(2)}×</div>
              <div className="text-xs text-slate-500 mt-0.5">{profitFactor >= 1.5 ? 'Expert level' : profitFactor >= 1 ? 'Profitable' : 'Needs work'}</div>
            </CardContent></Card>
            <Card className="bg-[#161b22] border-slate-800"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-400" /><span className="text-slate-500 text-xs">Realized P&amp;L</span></div>
              <div className={`text-2xl font-bold ${totalRealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{totalRealizedPnl >= 0 ? '+' : ''}{fmt(totalRealizedPnl)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{closedPositions.length} closed trades</div>
            </CardContent></Card>
            <Card className="bg-[#161b22] border-slate-800"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-amber-400" /><span className="text-slate-500 text-xs">Account Growth</span></div>
              <div className={`text-2xl font-bold ${accountGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{accountGrowth >= 0 ? '+' : ''}{accountGrowth.toFixed(1)}%</div>
              <div className="text-xs text-slate-500 mt-0.5">vs {fmt(startingBalance)} start</div>
            </CardContent></Card>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <div className="flex gap-1 mb-5 bg-slate-800/50 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              TAB: OVERVIEW
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Equity curve */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="pb-0 pt-4 px-5"><CardTitle className="text-white text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-400" /> Equity Curve</CardTitle></CardHeader>
                <CardContent className="px-5 pb-5 pt-3"><EquityCurveChart snapshots={snapshots} /></CardContent>
              </Card>

              {/* Donut + Calendar side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allocation donut */}
                <Card className="bg-[#161b22] border-slate-800">
                  <CardHeader className="pb-2"><CardTitle className="text-white text-sm flex items-center gap-2"><PieChart className="h-4 w-4 text-slate-400" /> Allocation</CardTitle></CardHeader>
                  <CardContent>
                    {totalPositionsValue === 0 ? (
                      <div className="flex flex-col items-center justify-center h-36 text-slate-600 gap-2">
                        <PieChart className="h-7 w-7 opacity-30" /><p className="text-sm">No open positions</p>
                        <Link href="/markets"><Button variant="link" className="text-emerald-500 text-xs p-0 h-auto">Open a trade →</Button></Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <DonutChart slices={donutSlices} totalValue={totalPositionsValue} equity={equity} hoveredIdx={hoveredSlice} onHover={setHoveredSlice} />
                        <div className="flex-1 space-y-1.5 min-w-0">
                          {donutSlices.map((s, i) => (
                            <div key={s.type}
                              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 cursor-default transition-colors ${hoveredSlice === i ? 'border-white/15 bg-white/[0.05]' : 'border-transparent hover:bg-white/[0.02]'}`}
                              onMouseEnter={() => setHoveredSlice(i)} onMouseLeave={() => setHoveredSlice(null)}>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-xs text-slate-300">{s.label}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-white tabular-nums">{fmt(s.value)}</div>
                                <div className="text-[10px] text-slate-500 tabular-nums">{s.pct.toFixed(1)}%</div>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-2.5 py-1.5">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-slate-700" /><span className="text-xs text-slate-500">Cash</span></div>
                            <div className="text-xs text-slate-500 tabular-nums">{fmt(cashBalance)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* P&L Calendar */}
                <Card className="bg-[#161b22] border-slate-800">
                  <CardHeader className="pb-2"><CardTitle className="text-white text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" /> P&amp;L Calendar</CardTitle></CardHeader>
                  <CardContent>
                    {closedPositions.length === 0
                      ? <div className="flex flex-col items-center justify-center h-36 text-slate-600 gap-2"><CalendarDays className="h-7 w-7 opacity-30" /><p className="text-sm">No closed trades yet</p></div>
                      : <PnLCalendar closedPositions={closedPositions} />
                    }
                  </CardContent>
                </Card>
              </div>

              {/* W/L streak ribbon */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="pb-2"><CardTitle className="text-white text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-slate-400" /> Win / Loss Streak</CardTitle></CardHeader>
                <CardContent><StreakRibbon positions={closedPositions} /></CardContent>
              </Card>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB: OPEN POSITIONS
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'positions' && (
            <Card className="bg-[#161b22] border-slate-800 overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-slate-800 flex-row items-center justify-between">
                <CardTitle className="text-white text-sm">Live Open Positions</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              </CardHeader>
              <CardContent className="p-0">
                {openPositions.length === 0 ? (
                  <div className="py-14 text-center"><Activity className="h-10 w-10 text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm">No open positions</p><Link href="/markets"><Button variant="link" className="text-emerald-500">Start Trading →</Button></Link></div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-slate-800">
                      {openPositions.map(pos => {
                        const cp = getPrice(pos) ?? pos.entry_price
                        const pnl = computePnl(pos, cp)
                        return (
                          <div key={pos.id} className="p-4 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: `${(TYPE_META[pos.type]?.color || '#64748b')}1a`, color: TYPE_META[pos.type]?.color || '#94a3b8' }}>
                                {pos.symbol.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white text-sm">{pos.symbol}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <span className={`text-[10px] font-bold px-1 rounded ${(pos.side||'BUY')==='BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{pos.side||'BUY'}</span>
                                  {pos.quantity} @ {fmt(pos.entry_price)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`font-semibold text-sm tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                              <Button size="sm" onClick={() => quickClose(pos)} disabled={closingId === pos.id}
                                className="mt-1 bg-red-600/80 hover:bg-red-600 text-white text-[10px] h-6 px-2">
                                {closingId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Close'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-800 uppercase tracking-wider">
                          <th className="text-left p-4">Asset</th><th className="text-center p-4">Side</th>
                          <th className="text-right p-4">Size</th><th className="text-right p-4">Entry</th>
                          <th className="text-right p-4">Current</th><th className="text-right p-4">Unrealized P&amp;L</th>
                          <th className="text-right p-4">Action</th>
                        </tr></thead>
                        <tbody>
                          {openPositions.map(pos => {
                            const cp = getPrice(pos) ?? pos.entry_price
                            const pnl = computePnl(pos, cp)
                            const pnlPct = ((cp / pos.entry_price) - 1) * 100 * ((pos.side || 'BUY') === 'SELL' ? -1 : 1)
                            return (
                              <tr key={pos.id} className="border-b border-slate-800/60 hover:bg-slate-800/25 transition-colors">
                                <td className="p-4"><div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: `${(TYPE_META[pos.type]?.color||'#64748b')}1a`, color: TYPE_META[pos.type]?.color||'#94a3b8' }}>
                                    {pos.symbol.slice(0, 2)}
                                  </div>
                                  <div><div className="font-medium text-white text-sm">{pos.symbol}</div><div className="text-xs text-slate-500">{pos.name || (TYPE_META[pos.type]?.label||pos.type)}</div></div>
                                </div></td>
                                <td className="p-4 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded-md ${(pos.side||'BUY')==='BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{pos.side||'BUY'}</span></td>
                                <td className="p-4 text-right text-slate-300 tabular-nums text-sm">{pos.quantity}</td>
                                <td className="p-4 text-right text-slate-400 tabular-nums text-sm">{fmt(pos.entry_price)}</td>
                                <td className="p-4 text-right text-white tabular-nums text-sm">{fmt(cp)}</td>
                                <td className="p-4 text-right">
                                  <div className={`font-semibold tabular-nums text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                                  <div className={`text-xs tabular-nums ${pnlPct >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</div>
                                </td>
                                <td className="p-4 text-right">
                                  <Button size="sm" onClick={() => quickClose(pos)} disabled={closingId === pos.id}
                                    className="bg-red-600/80 hover:bg-red-600 text-white text-xs h-7 px-3">
                                    {closingId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Close'}
                                  </Button>
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
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB: TRADE HISTORY (closed) — per-trade AI grade
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {closedPositions.length > 0 && (
                <div className="flex justify-end">
                  <a
                    href="/api/export/trades"
                    download
                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </a>
                </div>
              )}
              {closedPositions.length === 0 ? (
                <Card className="bg-[#161b22] border-slate-800"><CardContent className="py-14 text-center text-slate-500 text-sm">No closed trades yet.</CardContent></Card>
              ) : closedPositions.map(pos => {
                const pnl = pos.realized_pnl || 0
                const isWin = pnl > 0
                const ai = getPerTradeGrade(pos)
                const isExpanded = expandedAI === pos.id
                return (
                  <Card key={pos.id} className="bg-[#161b22] border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: `${(TYPE_META[pos.type]?.color||'#64748b')}1a`, color: TYPE_META[pos.type]?.color||'#94a3b8' }}>
                            {pos.symbol?.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{pos.symbol}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(pos.side||'BUY')==='BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{pos.side||'BUY'}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{isWin ? '✓ WIN' : '✗ LOSS'}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{pos.quantity} units · {fmtDur(pos.created_at, pos.closed_at)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Entry → Exit</div>
                            <div className="text-sm text-white">{fmt(pos.entry_price)} → <span className={isWin ? 'text-emerald-400' : 'text-red-400'}>{pos.closed_price ? fmt(pos.closed_price) : '—'}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Realized P&amp;L</div>
                            <div className={`text-lg font-bold ${isWin ? 'text-emerald-500' : 'text-red-500'}`}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                          </div>
                          <button onClick={() => setExpandedAI(isExpanded ? null : pos.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ai.bg} ${ai.color}`}>
                            <Brain className="h-3 w-3" />
                            {ai.grade} {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={`mt-3 p-3 rounded-lg border text-sm ${ai.bg}`}>
                          <div className="flex items-start gap-2">
                            <span className={`text-xl font-black ${ai.color}`}>{ai.grade}</span>
                            <p className="text-slate-300 leading-relaxed">{ai.text}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB: AI COACH — pattern-level insights
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'coach' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                <Brain className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-300">AI Trade Coach</div>
                  <div className="text-xs text-slate-400">Pattern analysis based on your {closedPositions.length} closed trades.</div>
                </div>
              </div>
              {aiInsights.length === 0 ? (
                <Card className="bg-[#161b22] border-slate-800"><CardContent className="py-14 text-center text-slate-500 text-sm">Close more trades to unlock pattern insights.</CardContent></Card>
              ) : aiInsights.map((ins, i) => (
                <Card key={i} className={`border ${ins.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : ins.type === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5">{ins.icon}</span>
                    <div>
                      <div className={`font-semibold text-sm mb-1 ${ins.type === 'warning' ? 'text-amber-300' : ins.type === 'positive' ? 'text-emerald-300' : 'text-blue-300'}`}>{ins.title}</div>
                      <p className="text-slate-300 text-sm leading-relaxed">{ins.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              TAB: TRADE LOG
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'log' && (
            <Card className="bg-[#161b22] border-slate-800 overflow-hidden">
              <CardContent className="p-0">
                {trades.length === 0 ? (
                  <div className="py-14 text-center text-slate-500 text-sm">No trades yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead><tr className="text-slate-500 text-xs border-b border-slate-800 uppercase tracking-wider">
                        <th className="text-left p-4">Asset</th><th className="text-left p-4">Side</th>
                        <th className="text-right p-4">Qty</th><th className="text-right p-4">Price</th>
                        <th className="text-right p-4">Value</th><th className="text-right p-4">Fee</th>
                        <th className="text-right p-4">Date</th>
                      </tr></thead>
                      <tbody>
                        {trades.map(t => (
                          <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                            <td className="p-4"><div className="font-medium text-white text-sm">{t.symbol}</div><div className="text-xs text-slate-500">{t.name}</div></td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-medium ${t.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{t.side}</span></td>
                            <td className="p-4 text-right text-slate-300 text-sm tabular-nums">{parseFloat(t.quantity).toFixed(4)}</td>
                            <td className="p-4 text-right text-slate-300 text-sm tabular-nums">{fmt(t.price)}</td>
                            <td className="p-4 text-right text-white text-sm tabular-nums">{fmt(t.total_value)}</td>
                            <td className="p-4 text-right text-slate-500 text-sm tabular-nums">{fmt(t.fee_amount)}</td>
                            <td className="p-4 text-right text-slate-500 text-xs">{new Date(t.executed_at).toLocaleString()}</td>
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
