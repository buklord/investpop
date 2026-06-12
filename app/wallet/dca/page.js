'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, Repeat, ArrowLeft, Clock, Calendar, Trash2,
  TrendingUp, CheckCircle, AlertTriangle
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { symbol: 'USDT', name: 'TetherUS', color: '#26a17b' },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775ca' },
]

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', days: 1 },
  { id: 'weekly', label: 'Weekly', days: 7 },
  { id: 'biweekly', label: 'Bi-weekly', days: 14 },
  { id: 'monthly', label: 'Monthly', days: 30 },
]

export default function DCAPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [plans, setPlans] = useState([])
  const [amount, setAmount] = useState('50')
  const [asset, setAsset] = useState('BTC')
  const [frequency, setFrequency] = useState('weekly')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vq_dcaPlans')
      if (raw) setPlans(JSON.parse(raw))
    } catch {}
  }, [])

  const savePlans = (next) => {
    setPlans(next)
    localStorage.setItem('vq_dcaPlans', JSON.stringify(next))
  }

  const addPlan = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return }
    const freq = FREQUENCIES.find(f => f.id === frequency)
    const next = [...plans, {
      id: Date.now(),
      asset,
      amount: amt,
      frequency: frequency,
      frequencyLabel: freq?.label,
      days: freq?.days,
      createdAt: Date.now(),
      nextRun: Date.now() + (freq?.days || 7) * 86400000,
      executed: 0,
      totalInvested: 0,
    }]
    savePlans(next)
    setAdding(false)
    setAmount('50')
    toast({ title: 'DCA plan created', description: `Buying ${amt} USD of ${asset} ${freq?.label?.toLowerCase()}.` })
  }

  const deletePlan = (id) => {
    savePlans(plans.filter(p => p.id !== id))
    toast({ title: 'Plan removed' })
  }

  const fmt$ = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
          <button onClick={() => router.push('/wallet')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Wallet
          </button>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Recurring Buy (DCA)</h1>
            <p className="text-muted-foreground text-sm">Automate your investments. Buy a fixed amount on a schedule.</p>
          </div>

          {/* Create Plan */}
          {!adding ? (
            <Button onClick={() => setAdding(true)} className="mb-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              <Repeat className="h-4 w-4 mr-2" /> Create Recurring Plan
            </Button>
          ) : (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-emerald-400" /> New Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-muted-foreground text-xs mb-1.5 block">Asset to buy</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ASSETS.map(a => (
                      <button
                        key={a.symbol}
                        onClick={() => setAsset(a.symbol)}
                        className={`flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors ${
                          asset === a.symbol ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border hover:border-emerald-500/30'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: a.color }}>
                          {a.symbol[0]}
                        </div>
                        <span className="text-xs font-medium text-foreground">{a.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs mb-1.5 block">Amount per purchase (USD)</label>
                  <Input type="number" min="10" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50" />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs mb-1.5 block">Frequency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {FREQUENCIES.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFrequency(f.id)}
                        className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                          frequency === f.id ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-border text-muted-foreground hover:border-emerald-500/30'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAdding(false)} className="flex-1 border-border">Cancel</Button>
                  <Button onClick={addPlan} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle className="h-4 w-4 mr-1.5" /> Create Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Plans */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" /> Active Plans ({plans.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recurring plans yet. Create one to start dollar-cost averaging.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {plans.map(plan => {
                    const a = ASSETS.find(x => x.symbol === plan.asset)
                    const isDue = plan.nextRun <= Date.now()
                    return (
                      <div key={plan.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: a?.color || '#10b981' }}>
                            {plan.asset[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{fmt$(plan.amount)} of {plan.asset} · {plan.frequencyLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {plan.executed} purchases · {fmt$(plan.totalInvested)} invested
                            </div>
                            <div className={`text-xs mt-0.5 flex items-center gap-1 ${isDue ? 'text-amber-400' : 'text-muted-foreground'}`}>
                              {isDue ? (
                                <><AlertTriangle className="h-3 w-3" /> Ready to execute</>
                              ) : (
                                <><Calendar className="h-3 w-3" /> Next: {fmtDate(plan.nextRun)}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => deletePlan(plan.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
            <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              DCA (Dollar-Cost Averaging) reduces the impact of volatility by spreading purchases over time.
              Plans are simulated for educational purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
