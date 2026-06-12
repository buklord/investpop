'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, ArrowDownUp,
  Send, ArrowDownToLine, DollarSign, Clock
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

function MiniChart({ data = [], color = '#10b981' }) {
  if (!data.length) return <div className="h-[140px] bg-muted/30 rounded-lg animate-pulse" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 600
  const h = 140
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 10) - 5
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const area = points + ` L${w},${h} L0,${h} Z`
  const pct = data.length > 1 ? (((data[data.length - 1] - data[0]) / data[0]) * 100).toFixed(2) : '0.00'
  const up = Number(pct) >= 0

  return (
    <div>
      <div className="flex items-end justify-between mb-2 px-1">
        <div className={`text-sm font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{pct}%
        </div>
        <div className="text-[10px] text-muted-foreground">7 days</div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[100px]">
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace('#','')})`} />
        <path d={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function generateMockHistory(basePrice) {
  const vals = []
  let v = basePrice
  for (let i = 0; i < 30; i++) {
    v = v * (1 + (Math.random() * 0.06 - 0.028))
    vals.push(v)
  }
  return vals
}

export default function AssetDetailPage() {
  const router = useRouter()
  const params = useParams()
  const symbol = String(params?.symbol || '').toUpperCase()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [balances, setBalances] = useState([])
  const [prices, setPrices] = useState({})
  const [historyData, setHistoryData] = useState([])

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

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
      const [balRes, priceRes] = await Promise.all([
        fetch('/api/wallet/balances'),
        fetch('/api/market/prices', { cache: 'no-store' })
      ])
      if (balRes.ok) {
        const d = await balRes.json()
        setBalances(d.balances || [])
      }
      if (priceRes.ok) {
        const d = await priceRes.json()
        setPrices(d.prices || {})
      }
    } catch (_) {}
  }

  const balance = useMemo(() => balances.find(b => b.asset === symbol), [balances, symbol])
  const priceUsd = balance?.priceUsd || 0
  const totalValue = (balance?.balance || 0) * priceUsd

  useEffect(() => {
    if (priceUsd > 0) setHistoryData(generateMockHistory(priceUsd))
  }, [priceUsd])

  const fmt = (n, d = 8) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })
  const fmt$ = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
          {/* Back */}
          <Link href="/wallet" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Wallet
          </Link>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-300 text-lg font-bold">
              {symbol.slice(0, 3)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{symbol}</h1>
              <p className="text-muted-foreground text-sm">{balance?.name || symbol}</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold text-foreground">{fmt$(totalValue)}</div>
              <div className="text-muted-foreground text-sm">{fmt(balance?.balance || 0)} {symbol}</div>
            </div>
          </div>

          {/* Chart */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Price History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniChart data={historyData} />
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs mb-1">Price</div>
                <div className="text-lg font-bold text-foreground">{fmt$(priceUsd)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs mb-1">24h Change</div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> +2.14%
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs mb-1">Holdings</div>
                <div className="text-lg font-bold text-foreground">{fmt(balance?.balance || 0)} {symbol}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs mb-1">Value (USD)</div>
                <div className="text-lg font-bold text-foreground">{fmt$(totalValue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Button onClick={() => router.push('/wallet/convert')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
              <ArrowDownUp className="h-4 w-4 mr-1.5" /> Convert
            </Button>
            <Button onClick={() => router.push('/wallet/send')} className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 w-full">
              <Send className="h-4 w-4 mr-1.5" /> Send
            </Button>
            <Button onClick={() => router.push('/wallet/deposit')} className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 w-full">
              <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Deposit
            </Button>
            <Button onClick={() => router.push('/wallet/history')} className="bg-muted/40 hover:bg-muted/60 text-foreground border border-border w-full">
              <Clock className="h-4 w-4 mr-1.5" /> History
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
