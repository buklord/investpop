'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Menu, Loader2, ArrowDownUp, CheckCircle, RefreshCw } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function ConvertPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [balances, setBalances] = useState([])
  const [fromAsset, setFromAsset] = useState('USDT')
  const [toAsset, setToAsset] = useState('BTC')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadBalances() }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      setUser((await res.json()).user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadBalances = async () => {
    try {
      const res = await fetch('/api/wallet/balances')
      if (res.ok) setBalances((await res.json()).balances || [])
    } catch (_) {}
  }

  const balOf = (asset) => balances.find(b => b.asset === asset)?.balance ?? 0
  const priceOf = (asset) => balances.find(b => b.asset === asset)?.priceUsd ?? 0

  const estimate = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return 0
    const fp = priceOf(fromAsset), tp = priceOf(toAsset)
    if (!fp || !tp) return 0
    return (amt * fp * 0.999) / tp
  }

  const swap = () => { setFromAsset(toAsset); setToAsset(fromAsset); setResult(null); setError('') }

  const submit = async () => {
    setError(''); setResult(null)
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (fromAsset === toAsset) { setError('Choose two different assets'); return }
    if (amt > balOf(fromAsset)) { setError(`Insufficient ${fromAsset} balance`); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAsset, toAsset, amount: amt }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setAmount('')
        loadBalances()
      } else {
        setError(data.error || 'Conversion failed')
      }
    } catch { setError('Conversion failed') }
    finally { setSubmitting(false) }
  }

  const fmt = (n, d = 8) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  const assets = balances.length ? balances.map(b => ({ asset: b.asset, name: b.name })) : [
    { asset: 'USDT', name: 'TetherUS' }, { asset: 'BTC', name: 'Bitcoin' }, { asset: 'ETH', name: 'Ethereum' },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/convert" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Convert</h1>
            <p className="text-muted-foreground text-sm">Instantly swap one coin for another at market price.</p>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><ArrowDownUp className="h-4 w-4 text-emerald-400" /> Swap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* From */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-xs">From</span>
                  <button onClick={() => setAmount(String(balOf(fromAsset)))} className="text-emerald-400 text-xs hover:underline">
                    Balance: {fmt(balOf(fromAsset))} {fromAsset} (Max)
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Input type="number" min="0" placeholder="0.00" value={amount}
                    onChange={e => { setAmount(e.target.value); setResult(null) }}
                    className="border-0 bg-transparent text-2xl font-bold px-0 focus-visible:ring-0" />
                  <Select value={fromAsset} onValueChange={v => { setFromAsset(v); setResult(null) }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assets.map(a => <SelectItem key={a.asset} value={a.asset}>{a.asset}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Swap button */}
              <div className="flex justify-center">
                <Button variant="outline" size="icon" onClick={swap} className="rounded-full border-border">
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </div>

              {/* To */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-xs">To (estimated)</span>
                  <span className="text-muted-foreground text-xs">Balance: {fmt(balOf(toAsset))} {toAsset}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-2xl font-bold text-foreground">{fmt(estimate())}</div>
                  <Select value={toAsset} onValueChange={v => { setToAsset(v); setResult(null) }}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assets.map(a => <SelectItem key={a.asset} value={a.asset}>{a.asset}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {priceOf(fromAsset) > 0 && priceOf(toAsset) > 0 && (
                <div className="text-muted-foreground text-xs px-1">
                  Rate: 1 {fromAsset} ≈ {fmt(priceOf(fromAsset) / priceOf(toAsset))} {toAsset} · Fee 0.1%
                </div>
              )}

              {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
              {result && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  Converted {fmt(result.fromAmount)} {result.fromAsset} → {fmt(result.toAmount)} {result.toAsset}
                </div>
              )}

              <Button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Convert
              </Button>
            </CardContent>
          </Card>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/wallet')} className="text-muted-foreground">Back to Wallet</Button>
            <Button variant="ghost" onClick={loadBalances} className="text-muted-foreground"><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
