'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, PiggyBank, ArrowLeft, TrendingUp, Plus, Minus,
  Clock, Zap, Info
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

const POOLS = [
  { asset: 'USDT', name: 'TetherUS', apy: 5.2, color: '#26a17b', min: 10, flexible: true },
  { asset: 'BTC', name: 'Bitcoin', apy: 2.8, color: '#f7931a', min: 0.001, flexible: true },
  { asset: 'ETH', name: 'Ethereum', apy: 3.5, color: '#627eea', min: 0.01, flexible: true },
  { asset: 'USDC', name: 'USD Coin', apy: 5.0, color: '#2775ca', min: 10, flexible: true },
]

const DAY_MS = 86400000

function calcInterest(principal, apy, days) {
  return principal * (Math.pow(1 + apy / 100, days / 365) - 1)
}

export default function SimpleEarnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [balances, setBalances] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [subscribeAsset, setSubscribeAsset] = useState('USDT')
  const [subscribeAmount, setSubscribeAmount] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { if (user) loadBalances() }, [user])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vq_earnSubscriptions')
      if (raw) setSubscriptions(JSON.parse(raw))
    } catch {}
  }, [])

  const loadBalances = async () => {
    try {
      const res = await fetch('/api/wallet/balances')
      if (res.ok) setBalances((await res.json()).balances || [])
    } catch {}
  }

  const saveSubs = (next) => {
    setSubscriptions(next)
    localStorage.setItem('vq_earnSubscriptions', JSON.stringify(next))
  }

  const balOf = (asset) => balances.find(b => b.asset === asset)?.balance ?? 0

  const handleSubscribe = () => {
    const amt = parseFloat(subscribeAmount)
    const pool = POOLS.find(p => p.asset === subscribeAsset)
    if (!amt || amt <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return }
    if (amt > balOf(subscribeAsset)) { toast({ title: 'Insufficient balance', variant: 'destructive' }); return }
    if (pool && amt < pool.min) { toast({ title: `Minimum ${pool.min} ${pool.asset}`, variant: 'destructive' }); return }

    setActionLoading('sub')
    setTimeout(() => {
      const existing = subscriptions.find(s => s.asset === subscribeAsset)
      if (existing) {
        saveSubs(subscriptions.map(s => s.asset === subscribeAsset
          ? { ...s, principal: s.principal + amt, subscribedAt: Math.min(s.subscribedAt, Date.now()) }
          : s
        ))
      } else {
        saveSubs([...subscriptions, { id: Date.now(), asset: subscribeAsset, principal: amt, subscribedAt: Date.now() }])
      }
      setSubscribeAmount('')
      setActionLoading('')
      toast({ title: 'Subscribed!', description: `${amt} ${subscribeAsset} is now earning ${pool?.apy}% APY.` })
    }, 800)
  }

  const handleRedeem = (asset) => {
    setActionLoading(asset)
    setTimeout(() => {
      const sub = subscriptions.find(s => s.asset === asset)
      if (!sub) { setActionLoading(''); return }
      const days = Math.max(0, (Date.now() - sub.subscribedAt) / DAY_MS)
      const interest = calcInterest(sub.principal, POOLS.find(p => p.asset === asset)?.apy || 0, days)
      const total = sub.principal + interest
      saveSubs(subscriptions.filter(s => s.asset !== asset))
      setActionLoading('')
      toast({ title: 'Redeemed!', description: `Received ${total.toFixed(8)} ${asset} (principal + ${interest.toFixed(6)} interest).` })
    }, 800)
  }

  const fmt = (n, d = 8) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/earn" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
          <button onClick={() => router.push('/earn')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Earn
          </button>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Simple Earn</h1>
            <p className="text-muted-foreground text-sm">Earn daily rewards on idle assets. Subscribe and redeem anytime.</p>
          </div>

          {/* Subscribe Card */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" /> Subscribe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {POOLS.map(p => (
                  <button
                    key={p.asset}
                    onClick={() => setSubscribeAsset(p.asset)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors text-left ${
                      subscribeAsset === p.asset
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-border hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: p.color }}>
                      {p.asset[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{p.asset}</div>
                      <div className="text-[10px] text-emerald-400 font-medium">{p.apy}% APY</div>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-muted-foreground text-xs">Amount to subscribe</label>
                  <span className="text-xs text-muted-foreground">Available: {fmt(balOf(subscribeAsset))} {subscribeAsset}</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`Min ${POOLS.find(p => p.asset === subscribeAsset)?.min || 0} ${subscribeAsset}`}
                    value={subscribeAmount}
                    onChange={e => setSubscribeAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSubscribe} disabled={!!actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {actionLoading === 'sub' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Subscriptions */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-400" /> Active Earnings ({subscriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No active subscriptions. Subscribe above to start earning.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {subscriptions.map(sub => {
                    const pool = POOLS.find(p => p.asset === sub.asset)
                    const days = Math.max(0, (Date.now() - sub.subscribedAt) / DAY_MS)
                    const interest = calcInterest(sub.principal, pool?.apy || 0, days)
                    const total = sub.principal + interest
                    return (
                      <div key={sub.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: pool?.color || '#10b981' }}>
                            {sub.asset[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{sub.asset} Simple Earn</div>
                            <div className="text-xs text-muted-foreground">
                              {fmt(sub.principal)} subscribed · {pool?.apy}% APY
                            </div>
                            <div className="text-xs text-emerald-400 mt-0.5">
                              +{fmt(interest, 6)} accrued ({days < 1 ? '<1 day' : `${Math.floor(days)} days`})
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">{fmt(total)} {sub.asset}</div>
                          <button
                            onClick={() => handleRedeem(sub.asset)}
                            disabled={actionLoading === sub.asset}
                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1 ml-auto"
                          >
                            {actionLoading === sub.asset ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />}
                            Redeem
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Interest compounds daily based on the advertised APY. You can redeem your principal + accrued interest anytime with no lock-up period. Rates are subject to change based on market conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
