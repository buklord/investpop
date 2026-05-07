'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import AppSidebar from '@/components/AppSidebar'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  Bot, Zap, Shield, TrendingUp, Lock, Users, Star,
  Filter, Plus, ChevronRight, Trophy, Flame, Sparkles,
  BarChart3, Clock, AlertTriangle, CheckCircle2
} from 'lucide-react'

// ─── Sparkline tiny chart ─────────────────────────────────────────────────
function BotSparkline({ data, positive = true, width = 90, height = 32 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const stroke = positive ? '#10b981' : '#ef4444'
  const fillPts = `0,${height} ${pts} ${width},${height}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sg-${positive})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Bot data ─────────────────────────────────────────────────────────────
const BOT_DATA = [
  {
    id: 'ethblitz',
    name: 'EthBlitz USDT',
    emoji: '⚡',
    desc: 'Lightning-fast bot for ETH/USDT. Catches micro-trends for rapid, high-profit trades.',
    risk: 'Low',
    tier: null,
    isNew: true,
    activeTraders: 2349,
    allTimePnl: 273.75,
    last30dPct: 23.9,
    duration: 15,
    minDeposit: 51,
    sparkData: [12,18,14,20,22,19,25,23,28,30,27,32,35,31,36,38,40,37,42,45],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'hypewave',
    name: 'HypeWave USDC',
    emoji: '🌊',
    desc: 'Advanced bot for HYPE/USDC. Uses trends for confident and stable trading.',
    risk: 'Low',
    tier: null,
    isNew: false,
    activeTraders: 450,
    allTimePnl: 347.07,
    last30dPct: 28.4,
    duration: 30,
    minDeposit: 147,
    soldOut: true,
    sparkData: [10,14,13,16,15,18,20,17,22,24,21,26,28,25,30,32,29,34,36,33],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'ethshield',
    name: 'EthShield DAI',
    emoji: '🛡️',
    desc: 'Protective bot for ETH/DAI. Focuses on safety and stability for long-term investors.',
    risk: 'Low',
    tier: null,
    isNew: false,
    activeTraders: 1821,
    allTimePnl: 420.02,
    last30dPct: 31.8,
    duration: 30,
    minDeposit: 297,
    sparkData: [8,11,10,14,13,16,18,15,20,22,19,24,26,23,28,30,27,32,34,31],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'xrpflash',
    name: 'XrpFlash USDC',
    emoji: '🤖',
    desc: 'Balanced bot for XRP/USDC. Mines profits from small fluctuations with a moderate approach.',
    risk: 'Mid',
    tier: null,
    isNew: true,
    activeTraders: 2199,
    allTimePnl: 511.34998,
    last30dPct: 44.3,
    duration: 25,
    minDeposit: 499,
    sparkData: [15,22,19,28,25,33,30,38,35,42,39,46,43,50,47,54,51,58,55,62],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'toncalm',
    name: 'TonCalm USD',
    emoji: '🤖',
    desc: 'Energetic bot for TON/USD. Reacts quickly to market pulses for rhythmic trading.',
    risk: 'Mid',
    tier: null,
    isNew: false,
    activeTraders: 1355,
    allTimePnl: 658.31995,
    last30dPct: 60.3,
    duration: 40,
    minDeposit: 987,
    sparkData: [10,16,14,22,20,28,26,34,32,40,38,46,44,52,50,58,56,64,62,70],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'bnbrocket',
    name: 'BnbRocket USDT',
    emoji: '🚀',
    desc: 'Dynamic bot for BNB/USDT. Soars on volatile movements, perfect for active traders.',
    risk: 'Mid',
    tier: 'Pro',
    isNew: false,
    activeTraders: 1733,
    allTimePnl: 748.57,
    last30dPct: 57.1,
    duration: 60,
    minDeposit: 1941,
    sparkData: [20,28,25,35,32,42,39,50,47,56,53,62,59,68,65,74,71,80,77,86],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'pepeflare',
    name: 'PepeFlare USDC',
    emoji: '🤖',
    desc: 'Calm bot for PEPE/USDC. Ideal for those who prefer low risk and steady returns.',
    risk: 'High',
    tier: null,
    isNew: false,
    activeTraders: 1693,
    allTimePnl: 894.52,
    last30dPct: 70.1,
    duration: 40,
    minDeposit: 2476,
    sparkData: [12,20,17,28,25,36,33,44,41,52,49,60,57,68,65,76,73,84,81,92],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'trxflow',
    name: 'TrxFlow USDT',
    emoji: '🤖',
    desc: 'Vivid bot for TRX/USDT. Uses market flares for rapid profit growth on volatile trends.',
    risk: 'Mid',
    tier: null,
    isNew: false,
    activeTraders: 978,
    allTimePnl: 796.52,
    last30dPct: 64.1,
    duration: 45,
    minDeposit: 3430,
    sparkData: [10,18,15,26,23,34,31,42,39,50,47,58,55,66,63,74,71,82,79,90],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'solsniper',
    name: 'SolSniper USDS',
    emoji: '🎯',
    desc: 'Aggressive bot for SOL/USDS. Targets sharp price strikes for maximum gains in volatile markets.',
    risk: 'Mid',
    tier: 'Elite',
    isNew: false,
    activeTraders: 328,
    allTimePnl: 1024.18,
    last30dPct: 81.9,
    duration: 90,
    minDeposit: 4232,
    locked: true,
    lockBalance: 4232,
    sparkData: [8,16,13,24,21,32,29,40,37,48,45,56,53,64,61,72,69,80,77,88],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'dogesurge',
    name: 'DogeSurge USD',
    emoji: '🚀',
    desc: 'Powerful bot for DOGE/USD. Leverages market surges for aggressive profit growth.',
    risk: 'High',
    tier: 'Pro',
    isNew: false,
    activeTraders: 1861,
    allTimePnl: 1186.17,
    last30dPct: 98.7,
    duration: 90,
    minDeposit: 9735,
    sparkData: [15,25,22,35,32,44,41,54,51,64,61,74,71,84,81,94,91,104,101,114],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'shibboom',
    name: 'ShibBoom USDC',
    emoji: '💥',
    desc: 'Smooth bot for SHIB/USDC. Follows steady trends for constant profit growth.',
    risk: 'Mid',
    tier: 'Elite',
    isNew: false,
    activeTraders: 579,
    allTimePnl: 1380.44,
    last30dPct: 91.8,
    duration: 90,
    minDeposit: 10000,
    locked: true,
    lockBalance: 10000,
    sparkData: [10,20,17,30,27,40,37,50,47,60,57,70,67,80,77,90,87,100,97,110],
    features: ['⚡','🛡️','🔄','↔️'],
  },
  {
    id: 'btcpulse',
    name: 'BtcPulse USD',
    emoji: '💎',
    desc: 'Stable bot for BTC/USD. Minimises risks and ensures steady growth on long-term trends.',
    risk: 'Mid',
    tier: 'Elite',
    isNew: false,
    activeTraders: 409,
    allTimePnl: 1601.33,
    last30dPct: 107.2,
    duration: 90,
    minDeposit: 13422,
    locked: true,
    lockBalance: 13422,
    sparkData: [12,22,19,32,29,42,39,52,49,62,59,72,69,82,79,92,89,102,99,112],
    features: ['⚡','🛡️','🔄','↔️'],
  },
]

const RISK_COLORS = {
  Low:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Mid:  'bg-amber-500/15  text-amber-400  border-amber-500/20',
  High: 'bg-red-500/15    text-red-400    border-red-500/20',
}

const TIER_COLORS = {
  Pro:   'bg-blue-500/15  text-blue-400  border-blue-500/20',
  Elite: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

function BotCard({ bot, onSubscribe }) {
  const riskCls = RISK_COLORS[bot.risk] || ''
  const tierCls = bot.tier ? (TIER_COLORS[bot.tier] || '') : ''
  const pnlPositive = bot.allTimePnl >= 0
  const pnlFormatted = bot.allTimePnl >= 1000
    ? `+${bot.allTimePnl.toFixed(2)}`
    : `+${bot.allTimePnl.toFixed(2)}`

  if (bot.locked) {
    return (
      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 overflow-hidden opacity-60 select-none">
        <div className="absolute inset-0 bg-[#0d1117]/70 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 rounded-2xl">
          <Lock className="w-6 h-6 text-white/40 mb-2" />
          <div className="text-white/70 font-semibold text-sm">Elite Tier Locked</div>
          <div className="text-white/35 text-xs mt-1">Unlock requires ${bot.lockBalance?.toLocaleString()} Total Balance</div>
        </div>
        {/* blurred content behind lock */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xl flex-shrink-0">{bot.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{bot.name}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="text-[10px] text-white/25 mb-1">All Time PnL</div>
            <div className="text-emerald-400 font-bold text-base">{pnlFormatted}</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="text-[10px] text-white/25 mb-1">Last 30d</div>
            <div className="text-emerald-400 font-bold text-base">+{bot.last30dPct}%</div>
          </div>
        </div>
        <div className="h-9 rounded-xl bg-white/[0.05] border border-white/[0.08]" />
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border bg-white/[0.025] p-5 flex flex-col gap-4 hover:border-white/[0.14] transition-all group ${bot.isNew ? 'border-emerald-500/25' : 'border-white/[0.08]'}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center text-xl flex-shrink-0">{bot.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-white font-semibold text-sm leading-tight">{bot.name}</span>
            {bot.tier && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierCls}`}>
                {bot.tier}
              </span>
            )}
            {bot.isNew && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/25">
                New
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${riskCls}`}>
              {bot.risk}
            </span>
          </div>
          <p className="text-white/40 text-xs leading-snug">{bot.desc}</p>
        </div>
      </div>

      {/* Feature icons row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 text-sm">{bot.features.map((f, i) => <span key={i}>{f}</span>)}</div>
        <div className="flex items-center gap-1 text-white/35 text-xs">
          <Users className="w-3.5 h-3.5" />
          <span>Active Traders <span className="text-white/55 font-semibold">{bot.activeTraders.toLocaleString()}+</span></span>
        </div>
      </div>

      {/* PnL + sparkline */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] text-white/30 mb-0.5">All Time PnL</div>
          <div className={`font-bold text-lg tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnlFormatted}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-white/25">Duration</span>
            <span className="text-[10px] text-white/40 font-semibold">{bot.duration} Days</span>
            <Lock className="w-2.5 h-2.5 text-white/20" />
          </div>
        </div>
        <BotSparkline data={bot.sparkData} positive={pnlPositive} width={90} height={36} />
      </div>

      {/* Last 30d */}
      <div className="flex items-center gap-1.5 text-xs">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-white/35">Last 30d:</span>
        <span className="text-emerald-400 font-semibold">+{bot.last30dPct}%</span>
      </div>

      {/* Footer: min deposit + CTA */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
        <div>
          <span className="text-[10px] text-white/30">Min deposit </span>
          <span className="text-white/70 text-sm font-semibold">${bot.minDeposit.toLocaleString()}</span>
        </div>
        {bot.soldOut ? (
          <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/30 text-xs font-semibold">
            Sold Out
          </div>
        ) : (
          <button
            onClick={() => onSubscribe(bot)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Subscribe
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Subscribe modal ───────────────────────────────────────────────────────
function SubscribeModal({ bot, onClose }) {
  if (!bot) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.10] bg-[#0d1117] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center text-2xl">{bot.emoji}</div>
          <div>
            <div className="text-white font-bold">{bot.name}</div>
            <div className="text-white/40 text-xs">{bot.desc}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
            <div className="text-[10px] text-white/30 mb-1">All Time PnL</div>
            <div className="text-emerald-400 font-bold">+{bot.allTimePnl.toFixed(2)}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
            <div className="text-[10px] text-white/30 mb-1">Min Deposit</div>
            <div className="text-white font-bold">${bot.minDeposit.toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 mb-4 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200/70 text-xs leading-relaxed">
            You need to fund your wallet with at least <strong>${bot.minDeposit.toLocaleString()}</strong> to activate this bot. Deposit via your wallet page.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/[0.10] text-white/50 text-sm hover:text-white hover:border-white/20 transition-colors">
            Cancel
          </button>
          <Link href="/wallet/deposit" className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
            Fund Wallet <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function BotsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [subscribingBot, setSubscribingBot] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setUser(d.user); else router.push('/login') })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const filters = ['All', 'Low Risk', 'Mid Risk', 'High Risk', 'New']

  const filteredBots = useMemo(() => {
    if (filter === 'All') return BOT_DATA
    if (filter === 'Low Risk') return BOT_DATA.filter(b => b.risk === 'Low')
    if (filter === 'Mid Risk') return BOT_DATA.filter(b => b.risk === 'Mid')
    if (filter === 'High Risk') return BOT_DATA.filter(b => b.risk === 'High')
    if (filter === 'New') return BOT_DATA.filter(b => b.isNew)
    return BOT_DATA
  }, [filter])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground/40 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            className="lg:hidden text-white/60 hover:text-white mr-1"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold tracking-tight">AI Trading Bots</h1>
          <span className="ml-auto text-[10px] text-white/30 hidden sm:block">Powered by advanced algorithmic strategies</span>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">

          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/10 via-[#0d1117] to-purple-600/10 px-6 py-8 mb-8">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
            </div>
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-300 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Neura AI Core — System Online
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                  Trade smarter with{' '}
                  <span className="text-blue-400">Exclusive Bots</span>
                </h2>
                <p className="text-white/45 text-sm max-w-lg leading-relaxed">
                  Built by our team with advanced private strategies for maximum performance. Deploy sophisticated trading
                  algorithms powered by deep learning — maximise your profits 24/7.
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  {[
                    { label: '$5.28M', sub: 'Managed by bots' },
                    { label: '20×',   sub: 'Faster execution' },
                    { label: '5,000+', sub: 'Happy traders' },
                  ].map(({ label, sub }) => (
                    <div key={label} className="text-center">
                      <div className="text-white font-extrabold text-lg leading-none">{label}</div>
                      <div className="text-white/35 text-[11px] mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-24 h-24 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Bot className="w-12 h-12 text-blue-400" />
                </div>
              </div>
            </div>
          </div>

          {/* "How bots work" 4-step strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[
              { n: '1', icon: <BarChart3 className="w-4 h-4" />, title: 'Select a Bot', body: 'Choose from bots tuned for your preferred risk level and trading pair.' },
              { n: '2', icon: <Filter className="w-4 h-4" />, title: 'Set Strategy', body: 'Pick between Spot and Futures and configure the aggressiveness level.' },
              { n: '3', icon: <Zap className="w-4 h-4" />, title: 'Fund & Activate', body: 'Deposit the minimum amount to activate the bot and start executing.' },
              { n: '4', icon: <TrendingUp className="w-4 h-4" />, title: 'Watch It Trade', body: 'Orders execute automatically 24/7 via high-speed API. Track profits live.' },
            ].map(({ n, icon, title, body }) => (
              <div key={n} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 text-sm flex-shrink-0">{n}</div>
                  <span className="text-white/70 text-xs font-medium">{icon}</span>
                </div>
                <div className="text-white font-semibold text-xs mb-1">{title}</div>
                <div className="text-white/35 text-[11px] leading-snug">{body}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            <Filter className="w-4 h-4 text-white/30 flex-shrink-0" />
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.05] text-white/50 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-xs text-white/25 flex-shrink-0">{filteredBots.length} bots</span>
          </div>

          {/* Bot grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBots.map(bot => (
              <BotCard key={bot.id} bot={bot} onSubscribe={b => setSubscribingBot(b)} />
            ))}
          </div>

          {/* Bottom info */}
          <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm mb-1">Orders executed via high-speed corporate API</div>
              <div className="text-white/35 text-xs leading-relaxed">
                All bots trade via our enterprise execution layer with sub-millisecond order routing.
                Past performance is not indicative of future results. Trading involves risk.
              </div>
            </div>
            <Link href="/risk-disclosure" className="text-xs text-white/30 hover:text-white/60 underline flex-shrink-0 transition-colors">
              Risk Disclosure
            </Link>
          </div>

        </main>
      </div>

      {subscribingBot && <SubscribeModal bot={subscribingBot} onClose={() => setSubscribingBot(null)} />}
    </div>
  )
}
