'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  TrendingUp, TrendingDown, Eye, Plus, RefreshCw, Menu, Activity,
  Loader2, Newspaper, AlertTriangle, Bell, X, CheckCircle,
  BrainCircuit, Clock, GripVertical, Sparkles, Timer
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({ data = [], width = 72, height = 24, positive = true }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const stroke = positive ? '#10b981' : '#ef4444'
  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── AI Briefing ─────────────────────────────────────────────────────────────
function AIBriefing({ account, positions, quotes, perfSetups, perfMetrics, snapshots }) {
  const lines = useMemo(() => {
    const out = []
    const currency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)

    // Top mover in watchlist / quotes
    const tickers = Object.entries(quotes || {})
    if (tickers.length > 0) {
      const topMover = tickers.reduce((a, b) => Math.abs(b[1]?.changePercent || 0) > Math.abs(a[1]?.changePercent || 0) ? b : a)
      const chg = topMover[1]?.changePercent || 0
      out.push(`${topMover[0]} moved ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% today${Math.abs(chg) > 2 ? ' — significant move' : ''}.`)
    }

    // Open positions summary
    if (positions && positions.length > 0) {
      const totalOpenPnl = account?.openPnl ?? 0
      out.push(`You have ${positions.length} open position${positions.length > 1 ? 's' : ''} ${totalOpenPnl >= 0 ? 'up' : 'down'} ${currency(Math.abs(totalOpenPnl))} in unrealised P&L.`)
    } else {
      out.push('No open positions. Consider scanning for setups in Markets.')
    }

    // Best setup from analytics
    if (perfSetups && perfSetups.length > 0) {
      const best = perfSetups[0]
      out.push(`Your strongest setup this period: ${best.setup_tag} · ${(Number(best.win_rate || 0) * 100).toFixed(0)}% win rate over ${best.trades} trade${best.trades > 1 ? 's' : ''}.`)
    } else if (perfMetrics) {
      const wr = Number(perfMetrics.winRate || 0)
      out.push(`Win rate recently: ${wr.toFixed(1)}%. ${wr >= 60 ? 'Strong consistency.' : wr >= 45 ? 'Room to improve — review your journal.' : 'Focus on quality setups, not quantity.'}`)
    }

    // 7-day equity trend from snapshots
    if (snapshots && snapshots.length >= 2) {
      const oldest = Number(snapshots[snapshots.length - 1]?.equity || 0)
      const newest = Number(snapshots[0]?.equity || 0)
      const delta = newest - oldest
      out.push(`Your equity has ${delta >= 0 ? 'grown' : 'declined'} by ${currency(Math.abs(delta))} over the last 7 days.`)
    }

    return out
  }, [account, positions, quotes, perfSetups, perfMetrics, snapshots])

  if (lines.length === 0) return null
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-[#1c2128] to-emerald-500/5 border border-violet-500/20 p-4 sm:p-5 mb-4 sm:mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <BrainCircuit className="h-4 w-4 text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-white">Today's AI Briefing</span>
        <span className="text-[11px] text-slate-500 ml-1">based on your account data</span>
      </div>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Session Badge ─────────────────────────────────────────────────────────────
function SessionBadge({ elapsedSeconds, sessionDelta }) {
  const fmt = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  const currency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700">
        <Timer className="h-3 w-3 text-slate-500" />
        Session: {fmt(elapsedSeconds)}
      </span>
      {sessionDelta !== null && (
        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold ${
          sessionDelta >= 0
            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-700/40'
            : 'text-red-300 bg-red-500/10 border-red-700/40'
        }`}>
          {sessionDelta >= 0 ? '+' : ''}{currency(sessionDelta)} today
        </span>
      )}
    </div>
  )
}

// ── Drag handle ──────────────────────────────────────────────────────────────
function DragHandle({ onMouseDown }) {
  return (
    <button
      onMouseDown={onMouseDown}
      className="hidden sm:flex items-center cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-400 transition-colors p-1 rounded"
      title="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
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

// ── Widget order default ──────────────────────────────────────────────────────
const DEFAULT_WIDGET_ORDER = ['positions_watchlist', 'trades', 'sectors', 'news']
const STORAGE_KEY = 'dashboard_widget_order_v1'

function loadWidgetOrder() {
  if (typeof window === 'undefined') return DEFAULT_WIDGET_ORDER
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGET_ORDER
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDGET_ORDER.length) return parsed
  } catch {}
  return DEFAULT_WIDGET_ORDER
}

// ── Onboarding Modal ──────────────────────────────────────────────────────────
const ONBOARDING_KEY = 'vaultquokka_onboarding_done'
const ONBOARDING_STEPS = [
  {
    emoji: '📈',
    title: 'Start Trading',
    desc: 'Open your first trade on the Markets page. Choose any asset — forex, crypto, stocks, or indices. Set your position size and execute with one click.',
    cta: 'Go to Trade',
    href: '/trade',
  },
  {
    emoji: '🤖',
    title: 'Try an AI Bot',
    desc: 'Let an AI bot trade for you. Allocate demo funds and watch your portfolio grow automatically. Choose from Conservative, Balanced, or Aggressive strategies.',
    cta: 'Browse Bots',
    href: '/ai-bots',
  },
  {
    emoji: '📓',
    title: 'Keep a Trade Journal',
    desc: 'Log your trades, moods, and learnings. The AI weekly summary will highlight patterns and help you improve your edge over time.',
    cta: 'Open Journal',
    href: '/journal',
  },
]

function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const s = ONBOARDING_STEPS[step]
  const isLast = step === ONBOARDING_STEPS.length - 1

  const handleSkip = () => {
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, '1')
    onDone()
  }

  const handleNext = () => {
    if (isLast) { handleSkip(); return }
    setStep(s => s + 1)
  }

  const handleCta = () => {
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, '1')
    onDone()
    router.push(s.href)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-emerald-500 w-6' : i < step ? 'bg-emerald-500/50' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="px-8 py-6 text-center">
          <div className="text-5xl mb-4">{s.emoji}</div>
          <h2 className="text-xl font-bold mb-2">{s.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
        </div>

        <div className="px-8 pb-6 space-y-2">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCta}>
            {s.cta} →
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleNext}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>

        <div className="px-8 pb-5 text-center">
          <button onClick={handleSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip tour
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')

  // Data
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [trades, setTrades] = useState([])
  const [quotes, setQuotes] = useState({})
  const [perfMetrics, setPerfMetrics] = useState(null)
  const [perfSetups, setPerfSetups] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  // Trading mode
  const [tradingMode, setTradingMode] = useState('REAL')
  const [switchingMode, setSwitchingMode] = useState(false)

  // Watchlist add
  const [showAddWatchlist, setShowAddWatchlist] = useState(false)
  const [watchlistSearch, setWatchlistSearch] = useState('')
  const [availableAssets, setAvailableAssets] = useState([])
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)

  // Session
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionDelta, setSessionDelta] = useState(null)

  // Drag-and-drop
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER)
  const [draggedIdx, setDraggedIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const dragCounterRef = useRef(0)

  // Init widget order from localStorage after mount
  useEffect(() => {
    setWidgetOrder(loadWidgetOrder())
  }, [])

  // Tick session clock
  useEffect(() => {
    const nowMs = Date.now()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startOfDay.getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  // Compute session delta when snapshots or equity changes
  useEffect(() => {
    if (!account || snapshots.length === 0) return
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    // find the last snapshot before today's start (i.e. yesterday's close)
    const sorted = [...snapshots].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const baseline = sorted.findLast(s => new Date(s.created_at) < startOfDay)
      || sorted[0] // fallback to oldest
    if (baseline) {
      const currentEquity = (account.balance ?? 0) + (account.openPnl ?? 0)
      setSessionDelta(currentEquity - Number(baseline.equity || 0))
    }
  }, [account, snapshots])

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  // Auto-refresh account every 30s
  useEffect(() => {
    if (!user) return
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/account')
        if (res.ok) setAccount(await res.json())
      } catch {}
    }, 30000)
    return () => clearInterval(id)
  }, [user])

  // Notifications every 15s
  useEffect(() => {
    if (!user) return
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) setNotifications((await res.json()).notifications || [])
      } catch {}
    }
    fetchNotifs()
    const id = setInterval(fetchNotifs, 15000)
    return () => clearInterval(id)
  }, [user])

  const markNotifsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
      if (data.broadcastMessage) setBroadcastMessage(data.broadcastMessage)
      if (data.user?.email) {
        let attempts = 0
        const identifyTawk = () => {
          if (typeof window !== 'undefined' && window.Tawk_API?.setAttributes) {
            window.Tawk_API.setAttributes({
              name: data.user.firstName ? `${data.user.firstName} ${data.user.lastName || ''}`.trim() : data.user.email,
              email: data.user.email,
            }, () => {})
          } else if (++attempts < 10) { setTimeout(identifyTawk, 400) }
        }
        identifyTawk()
      }
    } catch { router.push('/') }
    finally {
      setLoading(false)
      // Check onboarding only if not dismissed before
      if (typeof window !== 'undefined' && !localStorage.getItem(ONBOARDING_KEY)) {
        try {
          const ob = await fetch('/api/onboarding/status')
          if (ob.ok) {
            const { isNew } = await ob.json()
            if (isNew) setShowOnboarding(true)
          }
        } catch { /* non-critical */ }
      }
    }
  }

  const loadData = async () => {
    setDataLoading(true)
    try {
      const [accountRes, positionsRes, watchlistRes, tradesRes, snapshotRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/positions?status=open'),
        fetch('/api/watchlist'),
        fetch('/api/trades'),
        fetch('/api/account/snapshots')
      ])
      const accountData  = await accountRes.json()
      const positionsData = await positionsRes.json()
      const watchlistData = await watchlistRes.json()
      const tradesData   = await tradesRes.json()

      setAccount(accountData)
      if (accountData.tradingMode) setTradingMode(accountData.tradingMode)
      setPositions(positionsData.positions || [])
      setWatchlist(watchlistData.watchlist || [])
      setTrades(tradesData.trades || [])

      if (snapshotRes.ok) {
        const snapshotData = await snapshotRes.json()
        setSnapshots(snapshotData.snapshots || [])
      }

      try {
        const perfRes = await fetch('/api/performance/metrics?days=30')
        if (perfRes.ok) {
          const perf = await perfRes.json()
          setPerfMetrics(perf.metrics || null)
          setPerfSetups(Array.isArray(perf.setups) ? perf.setups : [])
        }
      } catch {}

      const symbols = new Set()
      watchlistData.watchlist?.forEach(i => symbols.add(`${i.symbol}:${i.type}`))
      positionsData.positions?.forEach(i => symbols.add(`${i.symbol}:${i.type}`))
      fetchQuotesParallel(Array.from(symbols))
    } catch (err) { console.error('Failed to load data:', err) }
    finally { setDataLoading(false) }
  }

  const fetchQuotesParallel = async (symbolTypes) => {
    if (!symbolTypes?.length) return
    try {
      const symbolsParam = symbolTypes.map(st => { const [s, t] = st.split(':'); return `${s},${t || 'stock'}` }).join('|')
      const res = await fetch(`/api/quotes/batch?symbols=${encodeURIComponent(symbolsParam)}`)
      if (res.ok) {
        const data = await res.json()
        setQuotes(prev => ({ ...prev, ...(data?.quotes || {}) }))
      }
    } catch {}
  }

  const refreshData = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const loadAvailableAssets = async () => {
    try {
      const res = await fetch('/api/assets?_t=' + Date.now())
      if (res.ok) setAvailableAssets((await res.json()).assets || [])
    } catch {}
  }

  const addToWatchlist = async (assetId) => {
    setAddingToWatchlist(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })
      if (res.ok) {
        const wRes = await fetch('/api/watchlist?_t=' + Date.now())
        if (wRes.ok) {
          const d = await wRes.json()
          const newWL = d.watchlist || []
          setWatchlist(newWL)
          const newSyms = newWL.filter(i => !quotes[i.symbol]).map(i => `${i.symbol},${i.type}`)
          if (newSyms.length > 0) fetchQuotesParallel(newSyms)
        }
        setShowAddWatchlist(false); setWatchlistSearch('')
      }
    } catch {}
    finally { setAddingToWatchlist(false) }
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
        // Zero out immediately — let loadData() repopulate the correct balance.
        // Never use prev.balance here as it belongs to the previous mode.
        setAccount(prev => prev ? {
          ...prev,
          balance: data.balance ?? 0,
          tradingMode: resolvedMode,
          openPnl: 0,
          equity: data.balance ?? 0,
          available: data.balance ?? 0,
          marginReserved: 0,
          positionsCount: 0,
        } : prev)
        loadData().catch(() => {})
      }
    } catch {}
    finally { setSwitchingMode(false) }
  }

  // ── Drag and drop handlers ─────────────────────────────────────────────────
  const handleDragStart = useCallback((idx) => (e) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((idx) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback((idx) => (e) => {
    e.preventDefault()
    setDraggedIdx(prev => {
      if (prev === null || prev === idx) return null
      setWidgetOrder(order => {
        const next = [...order]
        const moved = next.splice(prev, 1)[0]
        next.splice(idx, 0, moved)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
        return next
      })
      return null
    })
    setDragOverIdx(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }, [])

  // ── helpers ────────────────────────────────────────────────────────────────
  const formatCurrency = (v) => {
    if (!v && v !== 0) return '$0.00'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
  }
  const formatPercent = (v) => {
    if (!v && v !== 0) return '0.00%'
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  }
  const formatMinutes = (mins) => {
    const m = Number(mins || 0)
    if (!Number.isFinite(m) || m <= 0) return '0m'
    if (m < 60) return `${Math.round(m)}m`
    const h = Math.floor(m / 60); const rem = Math.round(m % 60)
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  }

  const cashBalance = account?.balance ?? 0
  const availableCash = account?.available ?? cashBalance
  const openPnl = account?.openPnl ?? 0
  const equity = cashBalance + openPnl
  const marginUsed = Math.max(0, cashBalance - availableCash)

  // 7-day sparkline data from snapshots (oldest→newest)
  const sparklineData = useMemo(() => {
    const sorted = [...snapshots]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-7)
      .map(s => Number(s.equity || 0))
    // append current equity as the final point
    if (sorted.length > 0) sorted.push(equity)
    return sorted
  }, [snapshots, equity])

  const cashSparkline = useMemo(() => {
    const sorted = [...snapshots]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-7)
      .map(s => Number(s.balance || 0))
    if (sorted.length > 0) sorted.push(cashBalance)
    return sorted
  }, [snapshots, cashBalance])

  const sparkPositive = sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
    : true

  // ── Widget renderers ───────────────────────────────────────────────────────
  const renderWidget = (id) => {
    switch (id) {
      case 'positions_watchlist': return (
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Open Positions */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border flex items-center justify-between">
              <h2 className="text-foreground font-semibold text-base sm:text-lg">Open Positions</h2>
              <Link href="/portfolio">
                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm h-auto p-0">View All →</Button>
              </Link>
            </div>
            <div className="py-4 sm:py-5 px-4 sm:px-6">
              {dataLoading ? (
                <div className="space-y-2 sm:space-y-3"><SkeletonRow /><SkeletonRow /></div>
              ) : positions.length === 0 ? (
                <div className="text-center py-8 sm:py-10">
                  <Activity className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No open positions</p>
                  <Link href="/markets"><Button variant="link" className="text-blue-400 hover:text-blue-300 mt-2 text-sm h-auto p-0">Start Trading →</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.slice(0, 5).map(pos => {
                    const quote = quotes[pos.symbol]
                    const currentPrice = quote?.price || pos.entry_price
                    const pnl = (currentPrice - pos.entry_price) * pos.quantity
                    const pnlPercent = ((currentPrice / pos.entry_price) - 1) * 100
                    return (
                      <Link key={pos.id} href={`/asset/${pos.symbol}?type=${pos.type}`}
                        className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${pos.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
                            {pos.type === 'crypto' ? '₿' : pos.symbol.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-sm sm:text-base">{pos.symbol}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{pos.quantity} @ {formatCurrency(pos.entry_price)}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className={`font-semibold text-sm sm:text-base ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</div>
                          <div className={`text-xs sm:text-sm font-medium ${pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(pnlPercent)}</div>
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
            <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border flex items-center justify-between">
              <h2 className="text-foreground font-semibold text-base sm:text-lg">Watchlist</h2>
              <Button variant="ghost" size="sm"
                onClick={() => { setShowAddWatchlist(!showAddWatchlist); if (!showAddWatchlist) { loadAvailableAssets(); setWatchlistSearch('') } }}
                className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm h-auto p-0 flex items-center gap-1">
                <Plus className="h-4 w-4" />Add
              </Button>
            </div>
            {showAddWatchlist && (
              <div className="px-4 sm:px-6 pt-3 pb-0 space-y-2">
                <Input value={watchlistSearch} onChange={e => setWatchlistSearch(e.target.value)} placeholder="Search assets..."
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground h-8 text-sm" />
                {availableAssets.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">Loading assets...</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pb-3">
                    {(() => {
                      const filtered = availableAssets.filter(a =>
                        !watchlist.some(w => w.asset_id === a.id) &&
                        (!watchlistSearch || a.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) || a.name.toLowerCase().includes(watchlistSearch.toLowerCase()))
                      )
                      if (filtered.length === 0) return <div className="px-2 py-1 text-sm text-muted-foreground">No assets found</div>
                      return filtered.slice(0, 8).map(asset => (
                        <button key={asset.id} onClick={() => addToWatchlist(asset.id)} disabled={addingToWatchlist}
                          className="w-full text-left px-2 py-1 text-sm hover:bg-muted/50 rounded flex items-center justify-between">
                          <div><span className="font-medium">{asset.symbol}</span><span className="text-muted-foreground ml-2 text-xs">{asset.name}</span></div>
                          {addingToWatchlist ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        </button>
                      ))
                    })()}
                  </div>
                )}
              </div>
            )}
            <div className="py-4 sm:py-5 px-4 sm:px-6">
              {dataLoading ? (
                <div className="space-y-2 sm:space-y-3"><SkeletonRow /><SkeletonRow /></div>
              ) : watchlist.length === 0 ? (
                <div className="text-center py-8 sm:py-10">
                  <Eye className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">No assets in watchlist</p>
                  <Link href="/markets"><Button variant="link" className="text-blue-400 hover:text-blue-300 mt-2 text-sm h-auto p-0">Browse Markets →</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlist.slice(0, 5).map(item => {
                    const quote = quotes[item.symbol]
                    return (
                      <Link key={item.id} href={`/asset/${item.symbol}?type=${item.type}`}
                        className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'crypto' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
                            {item.type === 'crypto' ? '₿' : item.symbol.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-sm sm:text-base">{item.symbol}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{item.name}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="font-semibold text-foreground text-sm sm:text-base">{quote ? formatCurrency(quote.price) : '—'}</div>
                          <div className={`text-xs sm:text-sm font-medium flex items-center justify-end gap-1 ${(quote?.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(quote?.changePercent || 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
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
      )

      case 'trades': return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border flex items-center justify-between">
            <h2 className="text-foreground font-semibold text-base sm:text-lg">Recent Trades</h2>
          </div>
          <div className="py-4 sm:py-5 px-4 sm:px-6">
            {dataLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="flex justify-between items-center py-2 border-t border-border"><div className="h-3 w-24 bg-muted rounded animate-pulse" /><div className="h-3 w-16 bg-muted rounded animate-pulse" /></div>)}</div>
            ) : trades.length === 0 ? (
              <div className="text-center py-8 sm:py-10"><Activity className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground text-sm font-medium">No trades yet</p></div>
            ) : (
              <>
                <div className="sm:hidden divide-y divide-border/60">
                  {trades.slice(0, 10).map(trade => {
                    const pnl = trade.position_status === 'CLOSED' ? Number(trade.realized_pnl || 0) : null
                    return (
                      <div key={trade.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${trade.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{trade.side}</span>
                          <div className="min-w-0"><div className="font-medium text-foreground text-sm">{trade.symbol}</div><div className="text-xs text-muted-foreground">Qty: {trade.quantity}</div></div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          {pnl !== null ? <div className={`font-semibold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</div> : <div className="font-medium text-foreground text-sm">{formatCurrency(trade.price)}</div>}
                          <div className="text-xs text-muted-foreground">{new Date(trade.executed_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
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
                          <tr key={trade.id} className={idx !== trades.slice(0, 10).length - 1 ? 'border-b border-border/60' : ''}>
                            <td className="py-2.5 sm:py-3"><div className="font-medium text-foreground text-sm">{trade.symbol}</div></td>
                            <td className="py-2.5 sm:py-3"><span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${trade.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{trade.side}</span></td>
                            <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-sm">{trade.quantity}</td>
                            <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-sm">{formatCurrency(trade.price)}</td>
                            <td className="py-2.5 sm:py-3 text-right text-sm font-medium">
                              {pnl !== null ? <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</span> : <span className="text-muted-foreground">{formatCurrency(trade.fee_amount || 0)}</span>}
                            </td>
                            <td className="py-2.5 sm:py-3 text-right text-muted-foreground text-xs">{new Date(trade.executed_at).toLocaleDateString()}</td>
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
      )

      case 'sectors': return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
            <h2 className="text-foreground font-semibold text-base sm:text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-amber-400" />Hot Sectors</h2>
          </div>
          <div className="py-4 sm:py-5 px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'AI / Technology', change: +3.24, assets: ['NVDA', 'MSFT', 'AAPL'], color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', barColor: 'bg-emerald-500' },
                { name: 'Cryptocurrency', change: +1.87, assets: ['BTCUSD', 'ETHUSD', 'SOLUSD'], color: 'bg-orange-500/15 border-orange-500/30 text-orange-400', barColor: 'bg-orange-500' },
                { name: 'Energy', change: -1.12, assets: ['XOM', 'CVX'], color: 'bg-red-500/15 border-red-500/30 text-red-400', barColor: 'bg-red-500' },
                { name: 'Finance', change: +0.54, assets: ['JPM', 'GS', 'BAC'], color: 'bg-blue-500/15 border-blue-500/30 text-blue-400', barColor: 'bg-blue-500' },
              ].map(sector => (
                <div key={sector.name} className={`p-3 rounded-lg border ${sector.color}`}>
                  <div className="text-xs font-semibold mb-1">{sector.name}</div>
                  <div className="text-xl font-bold mb-1.5">{sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%</div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${sector.barColor} transition-all duration-700`} style={{ width: `${Math.min(100, Math.abs(sector.change) * 20 + 40)}%` }} />
                  </div>
                  <div className="text-xs opacity-70">{sector.assets.slice(0, 2).join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )

      case 'news': return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="py-4 sm:py-5 px-4 sm:px-6 border-b border-border">
            <h2 className="text-foreground font-semibold text-base sm:text-lg flex items-center gap-2"><Newspaper className="h-5 w-5 text-blue-400" />Market News</h2>
          </div>
          <div className="py-4 sm:py-5 px-4 sm:px-6">
            <div className="space-y-3">
              {[
                { title: 'Fed Holds Rates Steady, Markets React Positively', source: 'Financial Times', time: '2h ago', sentiment: 'positive', summary: 'The Federal Reserve maintained its benchmark interest rate, citing stable inflation trends and strong employment data.' },
                { title: 'Tech Sector Leads Market Rally Amid AI Optimism', source: 'Reuters', time: '4h ago', sentiment: 'positive', summary: 'Major technology stocks surged as investors remained bullish on artificial intelligence developments and quarterly earnings.' },
                { title: 'Bitcoin Consolidates Near Key Resistance Level', source: 'CoinDesk', time: '5h ago', sentiment: 'neutral', summary: 'Crypto markets remain cautious as Bitcoin tests resistance near recent highs, with traders watching for a breakout.' },
                { title: 'Energy Stocks Fall on Supply Concerns', source: 'Bloomberg', time: '7h ago', sentiment: 'negative', summary: 'Oil prices dipped and energy equities fell after OPEC signaled potential increases in production output for Q2.' },
              ].map((item, i) => (
                <div key={i} className="p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 border border-border/60 rounded-lg transition-all duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.sentiment === 'positive' ? 'bg-emerald-500' : item.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-500'}`} />
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
      )

      default: return null
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex">
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <AppSidebar currentPage="/dashboard" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} account={account} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        {/* Broadcast Banner */}
        {broadcastMessage && (
          <div className="bg-red-600/90 border-b border-red-500 px-4 py-2 flex items-center gap-2 overflow-hidden">
            <AlertTriangle className="h-4 w-4 text-white flex-shrink-0" />
            <div className="text-white text-sm font-medium whitespace-nowrap animate-marquee">{broadcastMessage}</div>
          </div>
        )}

        <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
              <p className={`text-sm font-medium ${tradingMode === 'DEMO' ? 'text-amber-400' : 'text-emerald-400'}`}>{tradingMode === 'DEMO' ? '🎯 Demo Account — Virtual Money' : '💼 Live Account — Real Funds'}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Demo / Real toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                <button onClick={() => switchMode('DEMO')} disabled={switchingMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tradingMode === 'DEMO' ? 'bg-amber-500 text-black shadow' : 'text-muted-foreground hover:text-foreground'}`}>Demo</button>
                <button onClick={() => switchMode('REAL')} disabled={switchingMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tradingMode === 'REAL' ? 'bg-emerald-500 text-black shadow' : 'text-muted-foreground hover:text-foreground'}`}>Real</button>
              </div>
              {/* Notifications */}
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => { const opening = !showNotifs; setShowNotifs(opening); if (opening) markNotifsRead() }}
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
                      <Button variant="ghost" size="sm" onClick={() => setShowNotifs(false)} className="text-muted-foreground h-6 w-6 p-0"><X className="h-4 w-4" /></Button>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-muted-foreground text-sm">No notifications</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-border">
                        {notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <div><p>{n.message}</p><p className="text-muted-foreground text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" onClick={refreshData} disabled={refreshing} className="hidden lg:flex text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>
          </div>

          {/* AI Briefing */}
          {!dataLoading && (
            <AIBriefing
              account={account}
              positions={positions}
              quotes={quotes}
              perfSetups={perfSetups}
              perfMetrics={perfMetrics}
              snapshots={snapshots}
            />
          )}

          {/* Equity card */}
          <div className="mb-4 sm:mb-6">
            {dataLoading ? (
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-muted rounded-lg animate-pulse" />
                      <div className="space-y-2"><div className="h-3 w-24 bg-muted rounded animate-pulse" /><div className="h-8 w-40 bg-muted rounded animate-pulse" /></div>
                    </div>
                    <div className="h-6 w-28 bg-muted rounded-full animate-pulse" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="h-16 bg-muted/50 rounded-lg animate-pulse" /><div className="h-16 bg-muted/50 rounded-lg animate-pulse" /><div className="h-16 bg-muted/50 rounded-lg animate-pulse hidden sm:block" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className={`border rounded-xl ${tradingMode === 'DEMO' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border'}`}>
                {tradingMode === 'DEMO' && (
                  <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 rounded-t-xl">
                    <span className="text-amber-400 text-sm">🎯</span>
                    <span className="text-amber-300 text-xs sm:text-sm font-semibold">Demo Account — Virtual money only, no real funds at risk</span>
                  </div>
                )}
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${tradingMode === 'DEMO' ? 'bg-amber-500/15' : equity >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        <TrendingUp className={`h-5 w-5 ${tradingMode === 'DEMO' ? 'text-amber-400' : equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${tradingMode === 'DEMO' ? 'text-amber-400/70' : 'text-muted-foreground'}`}>Total equity</div>
                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="text-3xl sm:text-4xl font-bold text-foreground truncate">{formatCurrency(equity)}</div>
                          {sparklineData.length >= 2 && (
                            <div className="mb-1.5"><Sparkline data={sparklineData} positive={sparkPositive} /></div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{tradingMode === 'DEMO' ? 'Demo account · virtual funds' : 'Live account · cash + open P&L'}</div>
                        {/* Session indicator */}
                        <div className="mt-2">
                          <SessionBadge elapsedSeconds={elapsedSeconds} sessionDelta={sessionDelta} />
                        </div>
                      </div>
                    </div>
                    <div className={`self-start px-3 py-1 rounded-full text-xs font-semibold border ${openPnl >= 0 ? 'text-emerald-300 border-emerald-700/50 bg-emerald-500/10' : 'text-red-300 border-red-700/50 bg-red-500/10'}`}>
                      {(openPnl >= 0 ? '+' : '')}{formatCurrency(openPnl)} open P&amp;L
                    </div>
                  </div>

                  {/* Metric sub-cards with sparklines */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Cash</div>
                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(cashBalance)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">After realised P&amp;L</div>
                        </div>
                        {cashSparkline.length >= 2 && (
                          <Sparkline data={cashSparkline} positive={cashSparkline[cashSparkline.length-1] >= cashSparkline[0]} width={56} height={20} />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Available</div>
                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(availableCash)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Ready to trade</div>
                        </div>
                        {cashSparkline.length >= 2 && (
                          <Sparkline data={cashSparkline} positive={cashSparkline[cashSparkline.length-1] >= cashSparkline[0]} width={56} height={20} />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border/60 p-3 hidden sm:block">
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Margin used</div>
                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <div className="text-base sm:text-lg font-semibold text-foreground truncate">{formatCurrency(marginUsed)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Cash reserved</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Performance metrics */}
          {perfMetrics && (
            <div className="mb-4 sm:mb-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="bg-card border-border"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Win Rate</div><div className="text-lg sm:text-xl font-bold text-foreground">{formatPercent(perfMetrics.winRate || 0)}</div></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Expectancy</div><div className={`text-lg sm:text-xl font-bold ${(perfMetrics.expectancy || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(perfMetrics.expectancy || 0)}</div></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Avg R</div><div className={`text-lg sm:text-xl font-bold ${(perfMetrics.avgR || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(perfMetrics.avgR || 0).toFixed(2)}R</div></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Hold</div><div className="text-lg sm:text-xl font-bold text-foreground">{formatMinutes(perfMetrics.avgHoldMinutes || 0)}</div></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Max Drawdown</div><div className="text-lg sm:text-xl font-bold text-red-400">-{Number(perfMetrics.maxDrawdownPct || 0).toFixed(2)}%</div></CardContent></Card>
              {perfSetups.length > 0 && (
                <Card className="bg-card border-border col-span-2 lg:col-span-5"><CardContent className="p-3 sm:p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Top Setups (30d)</div><div className="flex flex-wrap gap-2">{perfSetups.map(s => <span key={s.setup_tag} className="px-2.5 py-1 rounded-md bg-muted text-foreground text-xs">{s.setup_tag} · {(Number(s.win_rate || 0) * 100).toFixed(0)}% WR · {Number(s.trades || 0)} trades</span>)}</div></CardContent></Card>
              )}
            </div>
          )}

          {/* Draggable widgets */}
          <div className="space-y-4 sm:space-y-6">
            {widgetOrder.map((widgetId, idx) => (
              <div
                key={widgetId}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`relative transition-opacity ${draggedIdx === idx ? 'opacity-40' : 'opacity-100'} ${dragOverIdx === idx && draggedIdx !== idx ? 'ring-2 ring-emerald-500/40 rounded-xl' : ''}`}
              >
                {/* Drag handle strip — desktop only */}
                <div className="hidden sm:flex absolute -left-6 top-1/2 -translate-y-1/2 items-center">
                  <div className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 p-1">
                    <GripVertical className="h-4 w-4" />
                  </div>
                </div>
                {renderWidget(widgetId)}
              </div>
            ))}
          </div>

          {/* AI Trading Bots teaser */}
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-card to-emerald-600/[0.03] p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <BrainCircuit className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm">AI Trading Bots — Active</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">New</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Deploy algorithmic bots that trade 24/7 on your behalf. Choose your risk level, fund your balance, and let AI execute automatically.
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { name: 'EthBlitz USDT', pct: '+23.9%' },
                    { name: 'BnbRocket USDT', pct: '+57.1%' },
                    { name: 'DogeSurge USD', pct: '+98.7%' },
                  ].map(({ name, pct }) => (
                    <span key={name} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="text-emerald-400">⚡</span>{name}
                      <span className="text-emerald-400 font-semibold">{pct}/30d</span>
                    </span>
                  ))}
                </div>
              </div>
              <a
                href="/bots"
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors shadow-[0_2px_10px_rgba(16,185,129,0.25)]"
              >
                Explore Bots
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
          </div>

          {/* Layout hint */}
          <p className="text-center text-xs text-slate-800 mt-6 pb-4 hidden sm:block">
            Drag the ⠿ handle to rearrange widgets · layout saved automatically
          </p>
        </div>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}
