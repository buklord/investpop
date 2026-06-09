'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Menu, Loader2, Send, CheckCircle } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function SendPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [balances, setBalances] = useState([])
  const [asset, setAsset] = useState('USDT')
  const [amount, setAmount] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
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

  const balOf = (a) => balances.find(b => b.asset === a)?.balance ?? 0

  const submit = async () => {
    setError(''); setResult(null)
    const amt = parseFloat(amount)
    if (!recipientEmail.includes('@')) { setError('Enter a valid recipient email'); return }
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (amt > balOf(asset)) { setError(`Insufficient ${asset} balance`); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, amount: amt, recipientEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setAmount(''); setRecipientEmail('')
        loadBalances()
      } else {
        setError(data.error || 'Transfer failed')
      }
    } catch { setError('Transfer failed') }
    finally { setSubmitting(false) }
  }

  const fmt = (n, d = 8) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  const assets = balances.length ? balances : [{ asset: 'USDT', name: 'TetherUS' }]

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/send" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Send Crypto</h1>
            <p className="text-muted-foreground text-sm">Transfer instantly to another investpop user by email — no fees.</p>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><Send className="h-4 w-4 text-emerald-400" /> Withdraw to user</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1.5 block">Recipient email</label>
                <Input type="email" placeholder="user@example.com" value={recipientEmail}
                  onChange={e => { setRecipientEmail(e.target.value); setResult(null) }} />
              </div>

              <div>
                <label className="text-muted-foreground text-xs mb-1.5 block">Coin</label>
                <Select value={asset} onValueChange={v => { setAsset(v); setResult(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assets.map(a => <SelectItem key={a.asset} value={a.asset}>{a.asset} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-muted-foreground text-xs">Amount</label>
                  <button onClick={() => setAmount(String(balOf(asset)))} className="text-emerald-400 text-xs hover:underline">
                    Available: {fmt(balOf(asset))} {asset} (Max)
                  </button>
                </div>
                <Input type="number" min="0" placeholder="0.00" value={amount}
                  onChange={e => { setAmount(e.target.value); setResult(null) }} />
              </div>

              {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
              {result && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" /> {result.message}
                </div>
              )}

              <Button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send
              </Button>
            </CardContent>
          </Card>

          <div className="mt-4">
            <Button variant="ghost" onClick={() => router.push('/wallet')} className="text-muted-foreground">Back to Wallet</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
