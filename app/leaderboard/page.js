'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Menu, Loader2, RefreshCw, Trophy, Copy, TrendingUp,
  Users, BarChart2, Target, ChevronUp, ChevronDown, Minus, Crown
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt  = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(v || 0))
const pct  = (v) => `${v >= 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`
const wr   = (v) => `${(Number(v || 0) * 100).toFixed(0)}%`
const rr   = (v) => v === null || v === undefined ? '—' : `${Number(v).toFixed(2)}`

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All-Time' },
]

const MEDALS = ['🥇', '🥈', '🥉']

function WinRatePill({ rate }) {
  const pctVal = Math.round(Number(rate || 0) * 100)
  const col = pctVal >= 60 ? 'text-emerald-400 bg-emerald-500/10' :
              pctVal >= 40 ? 'text-amber-400 bg-amber-500/10' :
                             'text-red-400 bg-red-500/10'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${col}`}>
      <Target className="h-2.5 w-2.5" />
      {pctVal}%
    </span>
  )
}

function RRBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-slate-600 text-sm">—</span>
  const n = Number(value)
  const col = n >= 2 ? 'text-emerald-400' : n >= 1 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-sm font-semibold tabular-nums ${col}`}>{n.toFixed(2)}</span>
}

function PnlCell({ value }) {
  const n = Number(value || 0)
  if (n === 0) return <span className="text-slate-500 text-sm">—</span>
  return (
    <span className={`text-sm font-semibold tabular-nums flex items-center gap-0.5 ${n >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {n >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {fmt(Math.abs(n))}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [entries, setEntries] = useState([])
  const [period, setPeriod] = useState('all')
  const [copyingId, setCopyingId] = useState(null)
  const [followingIds, setFollowingIds] = useState(new Set())

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) { loadBoard(period); loadFollowing() } }, [user, period])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch (_) { router.push('/') }
    finally { setLoading(false) }
  }

  const loadFollowing = async () => {
    try {
      const res = await fetch('/api/copy-trading/following')
      if (!res.ok) return
      const data = await res.json()
      const active = (data.following || [])
        .filter(f => f.status !== 'STOPPED')
        .map(f => f.leader_id)
      setFollowingIds(new Set(active))
    } catch (_) {}
  }

  const loadBoard = useCallback(async (p) => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/leaderboard?limit=8&period=${p}`)
      if (!res.ok) return
      const data = await res.json()
      setEntries(Array.isArray(data.leaderboard) ? data.leaderboard : [])
    } catch (_) {}
    finally { setRefreshing(false) }
  }, [])

  const handleCopy = async (entry) => {
    if (followingIds.has(entry.userId)) {
      toast({ title: 'Already copying', description: `You are already copying ${entry.handle}` })
      return
    }
    setCopyingId(entry.userId)
    try {
      const res = await fetch('/api/copy-trading/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId: entry.userId, copyRatio: 1.0 })
      })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: `Copying ${entry.handle}`,
          description: 'Their future trades will be mirrored to your account at 1× ratio.'
        })
        setFollowingIds(prev => new Set([...prev, entry.userId]))
      } else {
        toast({ title: 'Could not follow', description: data.error || 'Try again', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setCopyingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const isAllTime = period === 'all'

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/leaderboard" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white text-sm">Leaderboard</span>
          <Button variant="ghost" size="sm" onClick={() => loadBoard(period)} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                <Trophy className="h-7 w-7 text-amber-400" />
                Top Traders
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">Ranked by skill · period P&L · win rate · R:R</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadBoard(period)}
              disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Period tabs */}
          <div className="flex gap-1 bg-[#161b22] border border-slate-800 rounded-xl p-1 w-fit">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  period === key
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" />{isAllTime ? 'Balance' : 'Period P&L'} — primary sort</span>
            <span className="flex items-center gap-1"><Target className="h-3 w-3" />Win Rate — % of winning trades</span>
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />R:R — avg win ÷ avg loss</span>
            <span className="flex items-center gap-1"><Copy className="h-3 w-3" />One-click copy trading</span>
          </div>

          {/* Table */}
          <div className="bg-[#161b22] border border-slate-800 rounded-xl overflow-hidden">

            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto_auto_auto_auto] gap-x-4 items-center px-5 py-3 border-b border-slate-800 text-xs text-slate-500 font-medium">
              <span>#</span>
              <span>Trader</span>
              <span className="text-right">{isAllTime ? 'Balance' : 'Period P&L'}</span>
              <span className="text-right">{isAllTime ? 'Return' : 'Trades'}</span>
              <span className="text-right">Win Rate</span>
              <span className="text-right">Avg R:R</span>
              <span className="text-right">Copy</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-800/60">
              {entries.length === 0 && (
                <div className="py-16 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-slate-500 text-sm">
                    {period === 'today' ? 'No trades closed today yet.' :
                     period === 'week'  ? 'No trades this week yet.' :
                     period === 'month' ? 'No trades this month yet.' :
                     'No trading data yet. Start trading to appear here!'}
                  </p>
                </div>
              )}

              {entries.map((e) => {
                const isFollowing = followingIds.has(e.userId)
                const isCopying  = copyingId === e.userId
                const medal      = MEDALS[e.rank - 1]

                return (
                  <div
                    key={e.userId}
                    className={`transition-colors ${e.isMe ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : 'hover:bg-slate-800/30'}`}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto_auto_auto_auto] gap-x-4 items-center px-5 py-4">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/60 text-sm font-bold text-amber-400">
                        {medal || `${e.rank}`}
                      </div>

                      {/* Trader info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                          {e.handle.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {e.handle}{e.isMe ? ' (You)' : ''}
                          </div>
                          {e.followerCount > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Users className="h-2.5 w-2.5" />
                              {e.followerCount} {e.followerCount === 1 ? 'follower' : 'followers'}
                            </div>
                          )}
                        </div>
                        {e.rank === 1 && !e.isMe && (
                          <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Primary metric */}
                      <div className="text-right">
                        {isAllTime ? (
                          <span className="text-sm font-bold text-white tabular-nums">{fmt(e.balance)}</span>
                        ) : (
                          <PnlCell value={e.periodPnl} />
                        )}
                      </div>

                      {/* Secondary metric */}
                      <div className="text-right">
                        {isAllTime ? (
                          <span className={`text-sm font-semibold tabular-nums ${e.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pct(e.returnPct)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400 tabular-nums">{e.periodTrades} trades</span>
                        )}
                      </div>

                      {/* Win rate */}
                      <div className="flex justify-end">
                        {e.periodTrades > 0 ? <WinRatePill rate={e.winRate} /> : <span className="text-slate-600 text-sm">—</span>}
                      </div>

                      {/* Avg R:R */}
                      <div className="flex justify-end">
                        {e.periodTrades > 0 ? <RRBadge value={e.avgRR} /> : <span className="text-slate-600 text-sm">—</span>}
                      </div>

                      {/* Copy CTA */}
                      <div className="flex justify-end">
                        {e.isMe ? (
                          <span className="text-xs text-slate-600 italic">you</span>
                        ) : isFollowing ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">
                            Copying
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleCopy(e)}
                            disabled={isCopying}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs"
                          >
                            {isCopying ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Mobile row — card layout */}
                    <div className="sm:hidden p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-sm font-bold text-amber-400 flex-shrink-0">
                            {medal || `#${e.rank}`}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{e.handle}{e.isMe ? ' (You)' : ''}</div>
                            {e.followerCount > 0 && (
                              <div className="text-[11px] text-slate-500">{e.followerCount} followers</div>
                            )}
                          </div>
                        </div>
                        {e.isMe ? (
                          <span className="text-xs text-slate-600 italic">you</span>
                        ) : isFollowing ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs flex-shrink-0">Copying</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleCopy(e)}
                            disabled={isCopying}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs flex-shrink-0"
                          >
                            {isCopying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-[10px] text-slate-500 mb-0.5">{isAllTime ? 'Balance' : 'P&L'}</div>
                          <div className="text-xs font-bold text-white">
                            {isAllTime ? fmt(e.balance) : (e.periodTrades > 0 ? fmt(e.periodPnl) : '—')}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-[10px] text-slate-500 mb-0.5">Trades</div>
                          <div className="text-xs font-bold text-white">{e.periodTrades}</div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-[10px] text-slate-500 mb-0.5">Win Rate</div>
                          <div className={`text-xs font-bold ${Number(e.winRate || 0) >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {e.periodTrades > 0 ? wr(e.winRate) : '—'}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-[10px] text-slate-500 mb-0.5">R:R</div>
                          <div className={`text-xs font-bold ${e.avgRR && Number(e.avgRR) >= 1 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {e.periodTrades > 0 ? rr(e.avgRR) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-700 pb-4">
            Ranked by {isAllTime ? 'account balance' : 'P&L in period'} · Win Rate &amp; R:R based on closed positions · Only shown when ≥1 trade
          </p>
        </div>
      </div>
    </div>
  )
}
