'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, TrendingUp, Copy, Pause, Play, XCircle, BarChart3,
  Activity, Menu, RefreshCw, Loader2, Radio, Shield, PieChart,
  ArrowUpRight, ArrowDownRight, Zap, ChevronRight, AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import AppSidebar from '@/components/AppSidebar'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtName = (u) => {
  if (!u) return 'Unknown'
  if (u.first_name || u.last_name) return [u.first_name, u.last_name].filter(Boolean).join(' ')
  if (u.leader_first_name || u.leader_last_name) return [u.leader_first_name, u.leader_last_name].filter(Boolean).join(' ')
  return u.username || u.leader_username || u.email?.split('@')[0] || u.leader_email?.split('@')[0] || 'Unknown'
}

// ── Live Feed ─────────────────────────────────────────────────────────────────
function LiveFeed() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const feedRef = useRef(null)
  const prevCountRef = useRef(0)

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/copy-trading/feed?limit=40')
      if (res.ok) {
        const data = await res.json()
        const incoming = data.events || []
        setEvents(incoming)
        // Flash animation on new events
        if (prevCountRef.current > 0 && incoming.length > prevCountRef.current) {
          const topEl = feedRef.current?.querySelector('[data-first]')
          if (topEl) {
            topEl.classList.add('animate-pulse')
            setTimeout(() => topEl.classList.remove('animate-pulse'), 1000)
          }
        }
        prevCountRef.current = incoming.length
      }
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchFeed()
    const interval = setInterval(fetchFeed, 5000)
    return () => clearInterval(interval)
  }, [fetchFeed])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-500 mr-2" />
      <span className="text-slate-400 text-sm">Connecting to feed…</span>
    </div>
  )

  if (events.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Radio className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm">No copy activity yet. Activity will appear as leaders trade.</p>
    </div>
  )

  return (
    <div ref={feedRef} className="space-y-2">
      {events.map((ev, i) => {
        const isOpen = ev.action === 'OPEN'
        const name = ev.first_name || ev.last_name
          ? [ev.first_name, ev.last_name].filter(Boolean).join(' ')
          : ev.username || 'Trader'
        const symbol = ev.symbol || '—'
        const side = ev.side || ''
        const fc = Number(ev.follower_count)
        return (
          <div
            key={ev.id}
            data-first={i === 0 ? true : undefined}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-800 text-sm"
          >
            {/* icon */}
            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isOpen ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              {isOpen
                ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                : <ArrowDownRight className="h-4 w-4 text-red-400" />}
            </div>

            {/* text */}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-white">@{name}</span>
              {' '}
              <span className="text-slate-400">
                {isOpen ? 'opened' : 'closed'}{' '}
                <span className="text-white font-medium">{symbol}</span>
                {side && <span className={` font-medium ${side === 'BUY' ? ' text-emerald-400' : ' text-red-400'}`}> {side}</span>}
              </span>
            </div>

            {/* badge */}
            {fc > 0 && (
              <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[11px] whitespace-nowrap flex-shrink-0">
                <Copy className="h-3 w-3 mr-1" />
                {fc} {fc === 1 ? 'follower' : 'followers'} copied
              </Badge>
            )}

            <span className="text-xs text-slate-600 flex-shrink-0">{fmtDate(ev.created_at)}</span>
          </div>
        )
      })}
      <p className="text-center text-xs text-slate-700 pt-2">Auto-refreshes every 5 s</p>
    </div>
  )
}

// ── Attribution chart ─────────────────────────────────────────────────────────
function AttributionSection() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/copy-trading/attribution')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center gap-2 py-8 justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
      <span className="text-slate-400 text-sm">Loading attribution…</span>
    </div>
  )

  const self = data?.breakdown?.find(b => b.source === 'self') || { total_pnl: 0, trade_count: 0 }
  const copied = data?.breakdown?.find(b => b.source === 'copied') || { total_pnl: 0, trade_count: 0 }

  const selfPnl = parseFloat(self.total_pnl)
  const copiedPnl = parseFloat(copied.total_pnl)
  const totalAbs = Math.abs(selfPnl) + Math.abs(copiedPnl)
  const selfPct = totalAbs > 0 ? (Math.abs(selfPnl) / totalAbs) * 100 : 50
  const copiedPct = 100 - selfPct

  // Monthly chart data
  const months = [...new Set((data?.monthly || []).map(m => m.month))].slice(-6)
  const monthlyMap = {}
  for (const m of (data?.monthly || [])) {
    if (!monthlyMap[m.month]) monthlyMap[m.month] = { self: 0, copied: 0 }
    monthlyMap[m.month][m.source] = parseFloat(m.pnl)
  }

  const maxMonthPnl = Math.max(
    ...months.map(m => Math.max(Math.abs(monthlyMap[m]?.self || 0), Math.abs(monthlyMap[m]?.copied || 0))),
    1
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-400">Self-Directed P&L</span>
          </div>
          <div className={`text-2xl font-bold ${selfPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(selfPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{self.trade_count} trades</div>
        </div>
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span className="text-sm text-slate-400">Copy-Trading P&L</span>
          </div>
          <div className={`text-2xl font-bold ${copiedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(copiedPnl)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{copied.trade_count} trades copied</div>
        </div>
      </div>

      {/* Share bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>Self {selfPct.toFixed(0)}%</span>
          <span>Copied {copiedPct.toFixed(0)}%</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div className="bg-emerald-500 transition-all" style={{ width: `${selfPct}%` }} />
          <div className="bg-violet-500 transition-all" style={{ width: `${copiedPct}%` }} />
        </div>
      </div>

      {/* Monthly comparison bars */}
      {months.length > 0 && (
        <div>
          <h4 className="text-sm text-slate-400 mb-3">Monthly P&L Comparison</h4>
          <div className="grid gap-2">
            {months.map(month => {
              const s = monthlyMap[month]?.self || 0
              const c = monthlyMap[month]?.copied || 0
              const sBar = (Math.abs(s) / maxMonthPnl) * 100
              const cBar = (Math.abs(c) / maxMonthPnl) * 100
              return (
                <div key={month} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-right text-slate-500 flex-shrink-0">{month}</span>
                  <div className="flex-1 space-y-1">
                    {/* Self bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm bg-emerald-500 flex-shrink-0" />
                      <div className="flex-1 bg-slate-800 rounded h-2">
                        <div
                          className={`h-2 rounded transition-all ${s >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${sBar}%` }}
                        />
                      </div>
                      <span className={`w-16 text-right flex-shrink-0 ${s >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(s)}</span>
                    </div>
                    {/* Copied bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm bg-violet-500 flex-shrink-0" />
                      <div className="flex-1 bg-slate-800 rounded h-2">
                        <div
                          className={`h-2 rounded transition-all ${c >= 0 ? 'bg-violet-500' : 'bg-red-500'}`}
                          style={{ width: `${cBar}%` }}
                        />
                      </div>
                      <span className={`w-16 text-right flex-shrink-0 ${c >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(c)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-emerald-500 rounded-sm inline-block" />Self-directed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-violet-500 rounded-sm inline-block" />Copy-trading</span>
          </div>
        </div>
      )}

      {months.length === 0 && totalAbs === 0 && (
        <p className="text-center text-slate-600 text-sm py-4">
          Close some positions to see P&L attribution data.
        </p>
      )}
    </div>
  )
}

// ── Guardrails popover ────────────────────────────────────────────────────────
function GuardrailsButton({ connection, onSaved }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(
    connection.max_daily_loss != null ? String(connection.max_daily_loss) : ''
  )
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    try {
      const maxDailyLoss = value === '' ? null : parseFloat(value)
      if (maxDailyLoss !== null && (isNaN(maxDailyLoss) || maxDailyLoss <= 0)) {
        toast({ title: 'Invalid value', description: 'Enter a positive dollar amount or leave blank to remove', variant: 'destructive' })
        return
      }
      const res = await fetch('/api/copy-trading/guardrails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId: connection.leader_id, maxDailyLoss })
      })
      if (res.ok) {
        toast({ title: 'Guardrail saved', description: maxDailyLoss ? `Will pause if you lose $${maxDailyLoss} in one day from this leader's trades` : 'Guardrail removed (using default 10% limit)' })
        setOpen(false)
        onSaved?.()
      } else {
        const d = await res.json()
        toast({ title: 'Error', description: d.error || 'Failed to save', variant: 'destructive' })
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(o => !o)}
        className={`border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 ${connection.max_daily_loss != null ? 'border-amber-500/40 text-amber-300' : ''}`}
      >
        <Shield className="h-3.5 w-3.5 mr-1" />
        {connection.max_daily_loss != null ? `$${Number(connection.max_daily_loss).toLocaleString()} limit` : 'Set guardrail'}
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 bg-[#1c2128] border border-slate-700 rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Max Daily Loss</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Copying from this leader will automatically pause if you lose this amount in a single day from their trades.
          </p>
          <Label className="text-xs text-slate-400 mb-1 block">Dollar limit (blank = use default 10%)</Label>
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <Input
              type="number"
              min="1"
              step="10"
              placeholder="e.g. 200"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="pl-7 bg-slate-900 border-slate-700 text-white"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="border-slate-700">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CopyTradingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast } = useToast()
  const [leaders, setLeaders] = useState([])
  const [following, setFollowing] = useState([])
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLeader, setSelectedLeader] = useState(null)
  const [copyRatio, setCopyRatio] = useState(1.0)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('feed')

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadData = async () => {
    setRefreshing(true)
    try {
      const [leadersRes, followingRes, statsRes, historyRes] = await Promise.all([
        fetch('/api/copy-trading/leaders'),
        fetch('/api/copy-trading/following'),
        fetch('/api/copy-trading/stats'),
        fetch('/api/copy-trading/history?limit=20')
      ])
      if (leadersRes.ok) setLeaders((await leadersRes.json()).leaders || [])
      if (followingRes.ok) setFollowing((await followingRes.json()).following || [])
      if (statsRes.ok) setStats((await statsRes.json()).stats)
      if (historyRes.ok) setHistory((await historyRes.json()).history || [])
    } catch (err) { console.error(err) }
    finally { setRefreshing(false) }
  }

  const handleFollow = async (leaderId, ratio = 1.0) => {
    try {
      const res = await fetch('/api/copy-trading/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId, copyRatio: ratio })
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Started copying', description: 'You are now copying this leader' })
        await loadData(); setSelectedLeader(null)
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to follow', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Failed to follow leader', variant: 'destructive' }) }
  }

  const handleUnfollow = async (leaderId) => {
    try {
      const res = await fetch('/api/copy-trading/unfollow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId })
      })
      if (res.ok) { toast({ title: 'Unfollowed' }); await loadData() }
    } catch { toast({ title: 'Error', description: 'Failed to unfollow', variant: 'destructive' }) }
  }

  const handleStatusChange = async (leaderId, status) => {
    try {
      const res = await fetch('/api/copy-trading/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId, status })
      })
      if (res.ok) {
        toast({ title: status === 'ACTIVE' ? 'Resumed copying' : 'Paused copying' })
        await loadData()
      }
    } catch { toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }) }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/copy-trading" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white"><Menu className="h-6 w-6" /></button>
          <span className="font-bold text-white">Copy Trading</span>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={refreshing} className="text-slate-400">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Copy Trading</h1>
              <p className="text-slate-400 text-sm mt-0.5">Mirror expert traders automatically</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing} className="hidden lg:flex border-slate-700 text-slate-300">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Following', value: stats.asFollower?.leaders_following || 0, icon: Users, plain: true },
                { label: 'Trades Copied', value: stats.asFollower?.total_trades || 0, icon: Copy, plain: true },
                { label: 'Copied Volume', value: fmt(stats.asFollower?.total_volume || 0), icon: BarChart3, plain: true },
                { label: 'Copy P&L', value: fmt(stats.asFollower?.total_profit || 0), icon: TrendingUp, pos: (stats.asFollower?.total_profit || 0) >= 0 },
              ].map(({ label, value, icon: Icon, plain, pos }) => (
                <div key={label} className="bg-[#161b22] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{label}</span>
                    <Icon className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div className={`text-xl font-bold ${plain ? 'text-white' : pos ? 'text-emerald-400' : 'text-red-400'}`}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-[#161b22] border border-slate-800 overflow-x-auto flex-nowrap w-full">
              <TabsTrigger value="feed" className="flex-shrink-0 data-[state=active]:bg-slate-700">
                <Radio className="h-3.5 w-3.5 mr-1.5" />Feed
              </TabsTrigger>
              <TabsTrigger value="leaders" className="flex-shrink-0 data-[state=active]:bg-slate-700">
                <Activity className="h-3.5 w-3.5 mr-1.5" />Leaders
              </TabsTrigger>
              <TabsTrigger value="following" className="flex-shrink-0 data-[state=active]:bg-slate-700">
                <Zap className="h-3.5 w-3.5 mr-1.5" />Copying ({following.filter(f => f.status === 'ACTIVE').length})
              </TabsTrigger>
              <TabsTrigger value="attribution" className="flex-shrink-0 data-[state=active]:bg-slate-700">
                <PieChart className="h-3.5 w-3.5 mr-1.5" />Attribution
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-shrink-0 data-[state=active]:bg-slate-700">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />History
              </TabsTrigger>
            </TabsList>

            {/* ── FEED ── */}
            <TabsContent value="feed">
              <div className="bg-[#161b22] border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <h2 className="font-semibold text-white text-sm">Live Copy Feed</h2>
                  <span className="text-xs text-slate-500">Platform-wide · real-time</span>
                </div>
                <LiveFeed />
              </div>
            </TabsContent>

            {/* ── LEADERS ── */}
            <TabsContent value="leaders">
              <div className="bg-[#161b22] border border-slate-800 rounded-xl p-5">
                <h2 className="font-semibold text-white mb-4">Expert Traders</h2>
                {leaders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No leaders available at the moment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaders.map((leader) => {
                      const isFollowing = following.some(f => f.leader_id === leader.id && f.status !== 'STOPPED')
                      return (
                        <div key={leader.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Activity className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{fmtName(leader)}</div>
                              <div className="flex gap-2 mt-0.5 flex-wrap">
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">
                                  {leader.follower_count || 0} followers
                                </Badge>
                                <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[11px]">
                                  {fmt(leader.total_volume || 0)} vol
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {isFollowing ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Following</Badge>
                            ) : selectedLeader === leader.id ? (
                              <div className="space-y-3 w-52">
                                <div>
                                  <Label className="text-xs text-slate-400">Copy Ratio: <span className="text-white font-semibold">{copyRatio.toFixed(1)}x</span></Label>
                                  <Slider min={0.1} max={2.0} step={0.1} value={[copyRatio]} onValueChange={v => setCopyRatio(v[0])} className="mt-1" />
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    {copyRatio < 1 ? 'Conservative — smaller positions' : copyRatio === 1 ? 'Standard — proportional' : 'Aggressive — larger positions'}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleFollow(leader.id, copyRatio)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Confirm</Button>
                                  <Button size="sm" variant="outline" onClick={() => setSelectedLeader(null)} className="border-slate-700">Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <Button size="sm" onClick={() => { setSelectedLeader(leader.id); setCopyRatio(1.0) }} className="bg-emerald-600 hover:bg-emerald-700">
                                <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── FOLLOWING ── */}
            <TabsContent value="following">
              <div className="bg-[#161b22] border border-slate-800 rounded-xl p-5">
                <h2 className="font-semibold text-white mb-4">Active Connections</h2>
                {following.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Copy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm mb-3">Not copying anyone yet</p>
                    <Button size="sm" onClick={() => setActiveTab('leaders')} className="bg-emerald-600 hover:bg-emerald-700">
                      Browse Leaders <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {following.map((conn) => (
                      <div key={conn.id} className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          {/* Leader info */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Activity className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white">{fmtName(conn)}</div>
                              <div className="flex gap-2 mt-0.5 flex-wrap">
                                <Badge variant={conn.status === 'ACTIVE' ? 'default' : 'secondary'} className={conn.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : ''}>
                                  {conn.status}
                                </Badge>
                                <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[11px]">{conn.copy_ratio}x</Badge>
                                {conn.max_daily_loss != null && (
                                  <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[11px]">
                                    <Shield className="h-2.5 w-2.5 mr-1" />${Number(conn.max_daily_loss).toLocaleString()} limit
                                  </Badge>
                                )}
                              </div>
                              {/* Stats row */}
                              <div className="grid grid-cols-3 gap-x-4 mt-3">
                                <div>
                                  <div className="text-xs text-slate-500">Copied</div>
                                  <div className="text-sm font-semibold text-white">{conn.total_trades_copied || 0}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">Volume</div>
                                  <div className="text-sm font-semibold text-white">{fmt(conn.total_copied_volume || 0)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">P&L</div>
                                  <div className={`text-sm font-semibold ${(conn.total_profit_from_copying || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {fmt(conn.total_profit_from_copying || 0)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                            <GuardrailsButton connection={conn} onSaved={loadData} />
                            {conn.status === 'ACTIVE' ? (
                              <Button size="sm" variant="outline" onClick={() => handleStatusChange(conn.leader_id, 'PAUSED')} className="border-slate-700 text-slate-300">
                                <Pause className="h-3.5 w-3.5 mr-1" />Pause
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => handleStatusChange(conn.leader_id, 'ACTIVE')} className="bg-emerald-600 hover:bg-emerald-700">
                                <Play className="h-3.5 w-3.5 mr-1" />Resume
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => handleUnfollow(conn.leader_id)}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Unfollow
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── ATTRIBUTION ── */}
            <TabsContent value="attribution">
              <div className="bg-[#161b22] border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-5">
                  <PieChart className="h-4 w-4 text-violet-400" />
                  <h2 className="font-semibold text-white">Performance Attribution</h2>
                  <span className="text-xs text-slate-500">Self-directed vs copied trades</span>
                </div>
                <AttributionSection />
              </div>
            </TabsContent>

            {/* ── HISTORY ── */}
            <TabsContent value="history">
              <div className="bg-[#161b22] border border-slate-800 rounded-xl p-5">
                <h2 className="font-semibold text-white mb-4">Copy Trade History</h2>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No copy trades yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((trade) => (
                      <div key={trade.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/50 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant={trade.status === 'EXECUTED' ? 'default' : 'destructive'} className={trade.status === 'EXECUTED' ? 'bg-emerald-600' : ''}>
                            {trade.status}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-white">{trade.original_trade_data?.symbol} · {trade.original_trade_data?.action}</p>
                            <p className="text-xs text-slate-500">From @{trade.leader_username || trade.leader_email?.split('@')[0]}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-white">{fmt(trade.copied_value)}</p>
                          <p className="text-xs text-slate-500">Qty: {parseFloat(trade.copied_quantity).toFixed(4)}</p>
                          <p className="text-xs text-slate-600">{fmtDate(trade.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
