'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AppSidebar from '@/components/AppSidebar'
import { useRouter } from 'next/navigation'
import {
  Zap, Shield, TrendingUp, Lock, Users, Filter,
  ChevronRight, Sparkles, BarChart3, AlertTriangle,
  ArrowUpDown, Crown, Activity, Clock, Wallet,
  CheckCircle2, XCircle, TrendingDown, RefreshCw,
  BadgeCheck, Play, StopCircle, Info, Ban
} from 'lucide-react'

// ── Sparkline ────────────────────────────────────────────────────────────────
function BotSparkline({ data, width = 80, height = 30, positive = true }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
  const fill = '0,' + height + ' ' + pts + ' ' + width + ',' + height
  const color = positive ? '#10b981' : '#ef4444'
  return (
    <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} className="flex-shrink-0">
      <defs>
        <linearGradient id={'sg' + width} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={'url(#sg' + width + ')'} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Static Data ───────────────────────────────────────────────────────────────
const LIVE_TRADES = [
  { bot: 'EthBlitz',  pair: 'ETH/USDT',  side: 'BUY',  pnl: '+$4.21',  ago: '2s ago' },
  { bot: 'BnbRocket', pair: 'BNB/USDT',  side: 'SELL', pnl: '+$12.84', ago: '5s ago' },
  { bot: 'XrpFlash',  pair: 'XRP/USDC',  side: 'BUY',  pnl: '+$2.17',  ago: '9s ago' },
  { bot: 'DogeSurge', pair: 'DOGE/USD',  side: 'BUY',  pnl: '+$31.06', ago: '14s ago' },
  { bot: 'TonCalm',   pair: 'TON/USD',   side: 'SELL', pnl: '+$8.90',  ago: '18s ago' },
  { bot: 'EthShield', pair: 'ETH/DAI',   side: 'BUY',  pnl: '+$5.55',  ago: '22s ago' },
]

const BOT_DATA = [
  { id:'ethblitz',  name:'EthBlitz USDT',  emoji:'⚡', desc:'Lightning-fast bot for ETH/USDT. Catches micro-trends for rapid, high-profit trades.',       risk:'Low', tier:null,    isNew:true,  champion:false, activeTraders:2349, allTimePnl:273.75,  last30dPct:23.9,  duration:15, minDeposit:51,    sparkData:[12,18,14,20,22,19,25,23,28,30,27,32,35,31,36,38,40,37,42,45] },
  { id:'hypewave',  name:'HypeWave USDC',  emoji:'🌊', desc:'Advanced bot for HYPE/USDC. Uses trends for confident and stable trading.',                  risk:'Low', tier:null,    isNew:false, champion:false, activeTraders:450,  allTimePnl:347.07,  last30dPct:28.4,  duration:30, minDeposit:147,   soldOut:true, sparkData:[10,14,13,16,15,18,20,17,22,24,21,26,28,25,30,32,29,34,36,33] },
  { id:'ethshield', name:'EthShield DAI',  emoji:'🛡️', desc:'Protective bot for ETH/DAI. Focuses on safety and stability for long-term investors.',       risk:'Low', tier:null,    isNew:false, champion:false, activeTraders:1821, allTimePnl:420.02,  last30dPct:31.8,  duration:30, minDeposit:297,   sparkData:[8,11,10,14,13,16,18,15,20,22,19,24,26,23,28,30,27,32,34,31] },
  { id:'xrpflash',  name:'XrpFlash USDC', emoji:'⚡', desc:'Balanced bot for XRP/USDC. Mines profits from small fluctuations with a moderate approach.',  risk:'Mid', tier:null,    isNew:true,  champion:false, activeTraders:2199, allTimePnl:511.35,  last30dPct:44.3,  duration:25, minDeposit:499,   sparkData:[15,22,19,28,25,33,30,38,35,42,39,46,43,50,47,54,51,58,55,62] },
  { id:'toncalm',   name:'TonCalm USD',   emoji:'🔷', desc:'Energetic bot for TON/USD. Reacts quickly to market pulses for rhythmic trading.',            risk:'Mid', tier:null,    isNew:false, champion:false, activeTraders:1355, allTimePnl:658.32,  last30dPct:60.3,  duration:40, minDeposit:987,   sparkData:[10,16,14,22,20,28,26,34,32,40,38,46,44,52,50,58,56,64,62,70] },
  { id:'bnbrocket',  name:'BnbRocket USDT', emoji:'🚀', desc:'Dynamic bot for BNB/USDT. Soars on volatile movements, perfect for active traders.',        risk:'Mid', tier:'Pro',   isNew:false, champion:false, activeTraders:1733, allTimePnl:748.57,  last30dPct:57.1,  duration:60, minDeposit:1941,  sparkData:[20,28,25,35,32,42,39,50,47,56,53,62,59,68,65,74,71,80,77,86] },
  { id:'pepeflare', name:'PepeFlare USDC', emoji:'🔥', desc:'Aggressive bot for PEPE/USDC. Rides momentum spikes for explosive short-term gains.',        risk:'High',tier:null,    isNew:false, champion:false, activeTraders:1693, allTimePnl:894.52,  last30dPct:70.1,  duration:40, minDeposit:2476,  sparkData:[12,20,17,28,25,36,33,44,41,52,49,60,57,68,65,76,73,84,81,92] },
  { id:'trxflow',   name:'TrxFlow USDT',  emoji:'💫', desc:'Vivid bot for TRX/USDT. Uses market flares for rapid profit growth on volatile trends.',       risk:'Mid', tier:null,    isNew:false, champion:false, activeTraders:978,  allTimePnl:796.52,  last30dPct:64.1,  duration:45, minDeposit:3430,  sparkData:[10,18,15,26,23,34,31,42,39,50,47,58,55,66,63,74,71,82,79,90] },
  { id:'solsniper', name:'SolSniper USDS',emoji:'🎯', desc:'Aggressive bot for SOL/USDS. Targets sharp price strikes for maximum gains in volatile markets.', risk:'Mid', tier:'Elite', isNew:false, champion:false, activeTraders:328, allTimePnl:1024.18, last30dPct:81.9,  duration:90, minDeposit:4232,  locked:true, lockBalance:4232,  sparkData:[8,16,13,24,21,32,29,40,37,48,45,56,53,64,61,72,69,80,77,88] },
  { id:'dogesurge', name:'DogeSurge USD', emoji:'🚀', desc:'Powerful bot for DOGE/USD. Leverages market surges for aggressive profit growth.',             risk:'High',tier:'Pro',   isNew:false, champion:true,  activeTraders:1861, allTimePnl:1186.17, last30dPct:98.7,  duration:90, minDeposit:9735,  sparkData:[15,25,22,35,32,44,41,54,51,64,61,74,71,84,81,94,91,104,101,114] },
  { id:'shibboom',  name:'ShibBoom USDC', emoji:'💥', desc:'Smooth bot for SHIB/USDC. Follows steady trends for constant profit growth.',                  risk:'Mid', tier:'Elite', isNew:false, champion:false, activeTraders:579,  allTimePnl:1380.44, last30dPct:91.8,  duration:90, minDeposit:10000, locked:true, lockBalance:10000, sparkData:[10,20,17,30,27,40,37,50,47,60,57,70,67,80,77,90,87,100,97,110] },
  { id:'btcpulse',  name:'BtcPulse USD',  emoji:'💎', desc:'Stable bot for BTC/USD. Minimises risks and ensures steady growth on long-term trends.',       risk:'Mid', tier:'Elite', isNew:false, champion:false, activeTraders:409,  allTimePnl:1601.33, last30dPct:107.2, duration:90, minDeposit:13422, locked:true, lockBalance:13422, sparkData:[12,22,19,32,29,42,39,52,49,62,59,72,69,82,79,92,89,102,99,112] },
]

const RISK_CLR = { Low:'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', Mid:'bg-amber-500/15 text-amber-400 border-amber-500/20', High:'bg-red-500/15 text-red-400 border-red-500/20' }
const TIER_CLR = { Pro:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', Elite:'bg-amber-500/10 text-amber-300 border-amber-500/20' }

// ── Active Bot Card (user's running bot) ─────────────────────────────────────
function ActiveBotCard({ sub, onCancel, canceling }) {
  const bot = BOT_DATA.find(b => b.id === sub.bot_id) || {}
  const pnl = sub.cumulative_pnl || 0
  const isPos = pnl >= 0

  return (
    <div className="relative rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-4 flex flex-col gap-3">
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-emerald-400 font-semibold">Running</span>
      </div>

      <div className="flex items-center gap-3 pr-20">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl flex-shrink-0">
          {sub.bot_emoji}
        </div>
        <div>
          <div className="text-white font-bold text-sm">{sub.bot_name}</div>
          <div className="text-white/40 text-[11px]">{sub.days_active}d active · ${Number(sub.allocated_amount).toLocaleString()} allocated</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
          <div className="text-[10px] text-white/30 mb-0.5">PnL</div>
          <div className={`font-bold text-sm ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPos ? '+' : ''}${pnl.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
          <div className="text-[10px] text-white/30 mb-0.5">Return</div>
          <div className={`font-bold text-sm ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPos ? '+' : ''}{sub.pnl_pct?.toFixed(2) || '0.00'}%
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
          <div className="text-[10px] text-white/30 mb-0.5">Risk</div>
          <div className="text-white/60 font-semibold text-sm">{sub.risk_level}</div>
        </div>
      </div>

      {bot.sparkData && (
        <div className="flex justify-center">
          <BotSparkline data={bot.sparkData} width={200} height={36} positive={isPos} />
        </div>
      )}

      <button
        onClick={() => onCancel(sub)}
        disabled={canceling === sub.id}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-400 text-xs font-semibold hover:bg-red-500/15 transition-colors disabled:opacity-50"
      >
        {canceling === sub.id ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <StopCircle className="w-3.5 h-3.5" />
        )}
        {canceling === sub.id ? 'Stopping…' : 'Stop Bot & Return Funds'}
      </button>
    </div>
  )
}

// ── Bot Marketplace Card ──────────────────────────────────────────────────────
function BotCard({ bot, onSubscribe, activeSub }) {
  if (bot.locked) {
    return (
      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 overflow-hidden select-none">
        <div className="absolute inset-0 bg-[#0d1117]/75 backdrop-blur-[3px] flex flex-col items-center justify-center z-10 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-white/35" />
          </div>
          <div className="text-white/70 font-bold text-sm mb-1">Elite Tier Locked</div>
          <div className="text-white/35 text-xs">Requires <span className="text-white/55 font-semibold">${bot.lockBalance?.toLocaleString()}</span> total balance</div>
          <Link href="/wallet/deposit" className="mt-4 px-4 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors">
            Fund to Unlock
          </Link>
        </div>
        <div className="opacity-25">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xl">{bot.emoji}</div>
            <div><div className="text-white font-semibold text-sm">{bot.name}</div><div className="text-white/40 text-xs mt-0.5 leading-snug">{bot.desc}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-[10px] text-white/25">All Time PnL</div><div className="text-emerald-400 font-bold">+{bot.allTimePnl.toFixed(2)}</div></div>
            <div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-[10px] text-white/25">Last 30d</div><div className="text-emerald-400 font-bold">+{bot.last30dPct}%</div></div>
          </div>
        </div>
      </div>
    )
  }

  const riskCls = RISK_CLR[bot.risk] || ''
  const tierCls = bot.tier ? (TIER_CLR[bot.tier] || '') : ''
  const isActive = !!activeSub

  return (
    <div className={[
      'relative rounded-2xl border p-5 flex flex-col gap-3.5 transition-all duration-200',
      'hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(16,185,129,0.08)] group',
      isActive ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.07] to-transparent ring-1 ring-emerald-500/20'
        : bot.champion ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.06] to-transparent'
        : bot.isNew ? 'border-emerald-500/25 bg-white/[0.025]'
        : 'border-white/[0.08] bg-white/[0.02]'
    ].join(' ')}>

      {bot.champion && !isActive && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-[0_2px_12px_rgba(16,185,129,0.4)]">
          <Crown className="w-3 h-3" /> Top Performer
        </div>
      )}
      {isActive && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-[0_2px_12px_rgba(16,185,129,0.4)]">
          <BadgeCheck className="w-3 h-3" /> Active
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={['w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border',
          (isActive || bot.champion) ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.06] border-white/[0.09]'
        ].join(' ')}>{bot.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-white font-bold text-sm">{bot.name}</span>
            {bot.tier && <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + tierCls}>{bot.tier}</span>}
            {bot.isNew && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">New</span>}
            <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ' + riskCls}>{bot.risk}</span>
          </div>
          <p className="text-white/40 text-[11px] leading-snug">{bot.desc}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold">Executing</span>
        </div>
        <div className="flex items-center gap-1 text-white/30 text-[11px]">
          <Users className="w-3 h-3" />
          <span className="text-white/50 font-medium">{bot.activeTraders.toLocaleString()}+</span>
          <span>traders</span>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">All Time PnL</div>
          <div className="text-emerald-400 font-extrabold text-xl tabular-nums leading-tight">+{bot.allTimePnl.toFixed(2)}</div>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-white/20" />
            <span className="text-[10px] text-white/30">{bot.duration} Day bot</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-white/30 mb-0.5">Last 30d</div>
          <div className="text-emerald-400 font-bold text-sm mb-1">+{bot.last30dPct}%</div>
          <BotSparkline data={bot.sparkData} />
        </div>
      </div>

      {/* If active — show live PnL mini-widget */}
      {isActive && (
        <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-emerald-400/60 mb-0.5">Your PnL</div>
            <div className="text-emerald-400 font-bold text-base tabular-nums">
              {activeSub.cumulative_pnl >= 0 ? '+' : ''}${activeSub.cumulative_pnl?.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-emerald-400/60 mb-0.5">Return</div>
            <div className="text-emerald-400 font-bold text-base">
              {activeSub.pnl_pct >= 0 ? '+' : ''}{activeSub.pnl_pct?.toFixed(2)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/30 mb-0.5">Allocated</div>
            <div className="text-white font-semibold text-sm">${Number(activeSub.allocated_amount).toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <div>
          <span className="text-[10px] text-white/25">Min deposit </span>
          <span className="text-white font-bold text-sm">${bot.minDeposit.toLocaleString()}</span>
        </div>
        {bot.soldOut ? (
          <span className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/30 text-xs font-semibold">Sold Out</span>
        ) : isActive ? (
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Running
          </span>
        ) : (
          <button
            onClick={() => onSubscribe(bot)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors shadow-[0_2px_12px_rgba(16,185,129,0.25)] hover:shadow-[0_2px_18px_rgba(16,185,129,0.4)]"
          >
            Subscribe <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Subscribe Modal ───────────────────────────────────────────────────────────
function SubscribeModal({ bot, onClose, onSubscribed, userBalance }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [newBalance, setNewBalance] = useState(null)

  const parsedAmount = parseFloat(amount) || 0
  const min = bot?.minDeposit || 0
  const canSubmit = parsedAmount >= min && parsedAmount <= userBalance && !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bots/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          botName: bot.name,
          botEmoji: bot.emoji,
          allocatedAmount: parsedAmount,
          dailyRate: bot.last30dPct / 30,  // daily rate from 30d performance
          riskLevel: bot.risk,
          durationDays: bot.duration,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Subscription failed'); return }
      setSuccess(true)
      setNewBalance(data.newBalance)
      if (onSubscribed) onSubscribed()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!bot) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-[#0d1117] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-emerald-500/10 blur-2xl" />
        </div>

        {success ? (
          <div className="relative text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-white font-bold text-lg mb-1">{bot.name} Activated!</div>
            <div className="text-emerald-400 text-sm mb-1">+${parsedAmount.toLocaleString()} allocated</div>
            {newBalance !== null && (
              <div className="text-white/40 text-xs mb-4">New balance: ${newBalance.toFixed(2)}</div>
            )}
            <p className="text-white/45 text-sm mb-6">Your bot is now running 24/7. Track live PnL in <strong className="text-white/70">My Active Bots</strong>.</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors">
              View My Bots
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-2xl">{bot.emoji}</div>
              <div>
                <div className="text-white font-bold text-base">{bot.name}</div>
                <div className="text-emerald-400 text-sm font-semibold mt-0.5">+{bot.last30dPct}% last 30d · {bot.duration}d bot</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[['30d Return', '+' + bot.last30dPct + '%', 'text-emerald-400'], ['Duration', bot.duration + 'd', 'text-white'], ['Risk', bot.risk, bot.risk === 'Low' ? 'text-emerald-400' : bot.risk === 'High' ? 'text-red-400' : 'text-amber-400']].map(([label, val, cls]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center">
                  <div className="text-[10px] text-white/30 mb-1">{label}</div>
                  <div className={'font-bold text-sm ' + cls}>{val}</div>
                </div>
              ))}
            </div>

            {/* Balance info */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 mb-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white/35">Available Balance</span>
                <span className="text-white font-semibold">${userBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Minimum Required</span>
                <span className="text-white/70">${min.toLocaleString()}</span>
              </div>
            </div>

            {/* Amount input */}
            <div className="mb-1">
              <label className="text-xs text-white/40 mb-1.5 block">Allocation Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm font-bold">$</span>
                <input
                  type="number"
                  min={min}
                  max={userBalance}
                  step="0.01"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setError('') }}
                  placeholder={min.toString()}
                  className="w-full pl-7 pr-4 h-11 rounded-xl bg-white/[0.05] border border-white/[0.10] text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => setAmount((userBalance * pct / 100).toFixed(2))}
                  className="flex-1 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/40 text-[11px] hover:text-white/70 hover:bg-white/[0.07] transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 mb-4">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300/80 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {userBalance < min && (
              <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/20 px-4 py-3 mb-4 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-200/60 text-xs leading-relaxed">
                  Need <span className="text-amber-300 font-semibold">${min.toLocaleString()}</span> to activate. Deposit more funds first.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-white/[0.10] text-white/50 text-sm hover:text-white hover:border-white/[0.20] transition-colors">Cancel</button>
              {userBalance < min ? (
                <Link href="/wallet/deposit" className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-[0_4px_16px_rgba(16,185,129,0.3)]">
                  <Wallet className="w-4 h-4" /> Fund Wallet
                </Link>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Activating…' : 'Activate Bot'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Cancel Confirm Modal ──────────────────────────────────────────────────────
function CancelModal({ sub, onClose, onCanceled }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bots/cancel/${sub.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Cancel failed'); setLoading(false); return }
      setResult(data)
      if (onCanceled) onCanceled()
    } catch {
      alert('Network error'); setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0d1117] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
        {result ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-white font-bold text-base mb-1">Bot Stopped</div>
            <div className="text-emerald-400 font-semibold text-sm mb-1">${result.returnAmount?.toFixed(2)} returned to wallet</div>
            <div className="text-white/40 text-xs mb-4">PnL: {result.pnl >= 0 ? '+' : ''}${result.pnl?.toFixed(2)}</div>
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors">Done</button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                <StopCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-white font-bold">Stop {sub.bot_name}?</div>
                <div className="text-white/40 text-xs">Your funds + PnL will be returned</div>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-5 grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-[10px] text-white/30 mb-0.5">Allocated</div><div className="text-white font-semibold">${Number(sub.allocated_amount).toLocaleString()}</div></div>
              <div><div className="text-[10px] text-white/30 mb-0.5">Earned PnL</div><div className="text-emerald-400 font-semibold">{sub.cumulative_pnl >= 0 ? '+' : ''}${sub.cumulative_pnl?.toFixed(2)}</div></div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/[0.10] text-white/50 text-sm hover:text-white transition-colors">Keep Running</button>
              <button onClick={handleCancel} disabled={loading} className="flex-1 h-10 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                {loading ? 'Stopping…' : 'Stop Bot'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BotsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [userBalance, setUserBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('popular')
  const [subscribingBot, setSubscribingBot] = useState(null)
  const [cancelingSub, setCancelingSub] = useState(null)
  const [activeSubs, setActiveSubs] = useState([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [canceling, setCanceling] = useState(null)

  // Auth + balance
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          setUser(d.user)
          // Fetch real balance separately — /api/auth/me doesn't return account data
          return fetch('/api/account').then(r => r.ok ? r.json() : null).then(acc => {
            setUserBalance(parseFloat(acc?.realBalance ?? 0))
          })
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const loadSubs = useCallback(() => {
    setSubsLoading(true)
    fetch('/api/bots/my')
      .then(r => r.ok ? r.json() : { subscriptions: [] })
      .then(d => setActiveSubs(d.subscriptions || []))
      .catch(() => {})
      .finally(() => setSubsLoading(false))
  }, [])

  useEffect(() => {
    if (user) {
      loadSubs()
      // Refresh PnL every 30s
      const int = setInterval(loadSubs, 30000)
      return () => clearInterval(int)
    }
  }, [user, loadSubs])

  const activeSubMap = useMemo(() => {
    const m = {}
    for (const s of activeSubs) if (s.status === 'ACTIVE') m[s.bot_id] = s
    return m
  }, [activeSubs])

  const runningBots = useMemo(() => activeSubs.filter(s => s.status === 'ACTIVE'), [activeSubs])

  const filteredBots = useMemo(() => {
    let bots = [...BOT_DATA]
    if (filter === 'Low Risk') bots = bots.filter(b => b.risk === 'Low')
    else if (filter === 'Mid Risk') bots = bots.filter(b => b.risk === 'Mid')
    else if (filter === 'High Risk') bots = bots.filter(b => b.risk === 'High')
    else if (filter === 'New') bots = bots.filter(b => b.isNew)
    else if (filter === 'Active') bots = bots.filter(b => !!activeSubMap[b.id])
    if (sort === 'popular') bots.sort((a, b) => b.activeTraders - a.activeTraders)
    else if (sort === 'pnl') bots.sort((a, b) => b.allTimePnl - a.allTimePnl)
    else if (sort === '30d') bots.sort((a, b) => b.last30dPct - a.last30dPct)
    else if (sort === 'min') bots.sort((a, b) => a.minDeposit - b.minDeposit)
    return bots
  }, [filter, sort, activeSubMap])

  const totalTraders = BOT_DATA.reduce((s, b) => s + b.activeTraders, 0)
  const totalPnl = runningBots.reduce((s, b) => s + (b.cumulative_pnl || 0), 0)
  const totalAllocated = runningBots.reduce((s, b) => s + (parseFloat(b.allocated_amount) || 0), 0)

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground/40 text-sm">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">

        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 h-14 flex items-center gap-3">
          <button className="lg:hidden text-white/60 hover:text-white mr-1" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">AI Trading Bots</h1>
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
            </span>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-4 text-[11px] text-white/35">
            {runningBots.length > 0 && (
              <span className="text-emerald-400 font-semibold">{runningBots.length} bot{runningBots.length > 1 ? 's' : ''} running</span>
            )}
            <span>{BOT_DATA.filter(b => !b.locked && !b.soldOut).length} bots active · {totalTraders.toLocaleString()}+ traders</span>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto">

          {/* ── Hero ── */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-[#0d1117] to-emerald-600/[0.04] px-6 py-7 mb-6">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/[0.07] rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-600/[0.05] rounded-full blur-3xl" />
            </div>
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Kartom AI Core — System Online
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                  Trade smarter with <span className="text-emerald-400">Exclusive Bots</span>
                </h2>
                <p className="text-white/45 text-sm max-w-lg leading-relaxed mb-4">
                  Built by our team with advanced private strategies for maximum performance. Automated 24/7 execution — no monitors, no guesswork.
                </p>
                <div className="flex flex-wrap gap-6">
                  {[['$5.28M','Managed by bots'],['20×','Faster execution'],['5,000+','Active traders']].map(([label, sub]) => (
                    <div key={label}>
                      <div className="text-white font-extrabold text-xl leading-none">{label}</div>
                      <div className="text-white/35 text-[11px] mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Live trade ticker */}
              <div className="w-full sm:w-72 flex-shrink-0 rounded-xl border border-emerald-500/15 bg-black/30 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-semibold">Live Executions</span>
                  <span className="ml-auto text-[10px] text-white/25">real-time</span>
                </div>
                <div className="px-3 py-2 overflow-hidden h-7 flex items-center">
                  <div className="flex gap-6 w-max" style={{ animation: 'ticker 22s linear infinite' }}>
                    {[...LIVE_TRADES, ...LIVE_TRADES].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
                        <span className="text-white/30">{t.bot}</span>
                        <span className="text-white/50">{t.pair}</span>
                        <span className={'font-bold px-1.5 py-0.5 rounded text-[10px] ' + (t.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{t.side}</span>
                        <span className="text-emerald-400 font-semibold">{t.pnl}</span>
                        <span className="text-white/20">{t.ago}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── My Active Bots ── */}
          {runningBots.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-base">My Active Bots</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold">{runningBots.length} running</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>Allocated <span className="text-white font-semibold">${totalAllocated.toLocaleString()}</span></span>
                  <span>Total PnL <span className={totalPnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span></span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {runningBots.map(sub => (
                  <ActiveBotCard
                    key={sub.id}
                    sub={sub}
                    onCancel={s => setCancelingSub(s)}
                    canceling={canceling}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── How it works ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { n:'1', Icon:BarChart3,  title:'Select a Bot',    body:'Pick a bot tuned for your risk level and trading pair.' },
              { n:'2', Icon:Filter,     title:'Set Strategy',    body:'Spot or Futures, conservative to aggressive — you choose.' },
              { n:'3', Icon:Zap,        title:'Fund & Activate', body:'Deposit the minimum amount to start execution.' },
              { n:'4', Icon:TrendingUp, title:'Watch It Trade',  body:'Orders fire 24/7 via high-speed API. Track profits live.' },
            ].map(({ n, Icon, title, body }) => (
              <div key={n} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">{n}</div>
                  <Icon className="w-4 h-4 text-white/30" />
                </div>
                <div className="text-white font-semibold text-xs mb-1">{title}</div>
                <div className="text-white/35 text-[11px] leading-snug">{body}</div>
              </div>
            ))}
          </div>

          {/* ── Filters + sort ── */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <Filter className="w-4 h-4 text-white/30 flex-shrink-0" />
            {['All','Low Risk','Mid Risk','High Risk','New', runningBots.length > 0 ? 'Active' : null].filter(Boolean).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={'px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ' + (
                  filter === f
                    ? 'bg-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.35)]'
                    : 'bg-white/[0.05] text-white/50 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                )}>
                {f}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-white/30" />
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="bg-white/[0.05] border border-white/[0.08] text-white/60 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500/40 cursor-pointer">
                <option value="popular">Most Popular</option>
                <option value="pnl">Best All-Time PnL</option>
                <option value="30d">Best 30d Return</option>
                <option value="min">Lowest Min Deposit</option>
              </select>
              <span className="text-xs text-white/20 hidden sm:block">{filteredBots.length} bots</span>
            </div>
          </div>

          {/* ── Bot grid ── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBots.map(bot => (
              <BotCard
                key={bot.id}
                bot={bot}
                activeSub={activeSubMap[bot.id] || null}
                onSubscribe={b => setSubscribingBot(b)}
              />
            ))}
          </div>

          {/* ── Disclaimer ── */}
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm mb-1">Orders executed via high-speed corporate API</div>
              <div className="text-white/30 text-xs leading-relaxed">All bots trade via our enterprise execution layer with sub-millisecond order routing. Past performance is not indicative of future results. Trading always involves risk of loss.</div>
            </div>
            <Link href="/risk-disclosure" className="text-xs text-white/25 hover:text-white/60 underline flex-shrink-0 transition-colors">Risk Disclosure</Link>
          </div>
        </main>
      </div>

      {subscribingBot && (
        <SubscribeModal
          bot={subscribingBot}
          userBalance={userBalance}
          onClose={() => setSubscribingBot(null)}
          onSubscribed={() => {
            setSubscribingBot(null)
            loadSubs()
            // Refresh real balance
            fetch('/api/account').then(r => r.ok ? r.json() : null).then(acc => {
              if (acc) setUserBalance(parseFloat(acc.realBalance ?? 0))
            })
          }}
        />
      )}

      {cancelingSub && (
        <CancelModal
          sub={cancelingSub}
          onClose={() => setCancelingSub(null)}
          onCanceled={() => {
            setCancelingSub(null)
            loadSubs()
            fetch('/api/account').then(r => r.ok ? r.json() : null).then(acc => {
              if (acc) setUserBalance(parseFloat(acc.realBalance ?? 0))
            })
          }}
        />
      )}
    </div>
  )
}
