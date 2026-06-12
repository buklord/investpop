'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Send, CheckCircle, BookUser, X, User, Plus, Trash2, Users } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function SendPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [balances, setBalances] = useState([])
  const [asset, setAsset] = useState('USDT')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [savedRecipients, setSavedRecipients] = useState([])
  const [batchMode, setBatchMode] = useState(false)
  const [recipients, setRecipients] = useState([{ email: '', amount: '' }])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vq_savedRecipients')
      if (raw) setSavedRecipients(JSON.parse(raw))
    } catch {}
  }, [])

  const saveRecipient = (email) => {
    if (!email || savedRecipients.includes(email)) return
    const next = [...savedRecipients, email]
    setSavedRecipients(next)
    localStorage.setItem('vq_savedRecipients', JSON.stringify(next))
  }

  const removeSavedRecipient = (email) => {
    const next = savedRecipients.filter(r => r !== email)
    setSavedRecipients(next)
    localStorage.setItem('vq_savedRecipients', JSON.stringify(next))
  }

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

  const addRecipientRow = () => setRecipients([...recipients, { email: '', amount: '' }])
  const removeRecipientRow = (i) => setRecipients(recipients.filter((_, idx) => idx !== i))
  const updateRecipient = (i, field, val) => {
    const next = [...recipients]
    next[i][field] = val
    setRecipients(next)
  }

  const totalBatchAmount = () => recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  const submit = async () => {
    setError(''); setResult(null)
    if (batchMode) {
      // Batch send
      const valid = recipients.filter(r => r.email.includes('@') && parseFloat(r.amount) > 0)
      if (!valid.length) { setError('Add at least one valid recipient'); return }
      const total = totalBatchAmount()
      if (total > balOf(asset)) { setError(`Insufficient ${asset} balance (need ${total})`); return }
      setSubmitting(true)
      try {
        const results = []
        for (const r of valid) {
          const res = await fetch('/api/wallet/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset, amount: parseFloat(r.amount), recipientEmail: r.email }),
          })
          const data = await res.json()
          if (res.ok) { results.push({ ok: true, email: r.email }); saveRecipient(r.email) }
          else results.push({ ok: false, email: r.email, error: data.error })
        }
        const okCount = results.filter(r => r.ok).length
        setResult({ message: `Sent to ${okCount}/${valid.length} recipients` })
        setRecipients([{ email: '', amount: '' }])
        loadBalances()
      } catch { setError('Batch transfer failed') }
      finally { setSubmitting(false) }
    } else {
      // Single send
      const r = recipients[0]
      const amt = parseFloat(r.amount)
      if (!r.email.includes('@')) { setError('Enter a valid recipient email'); return }
      if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
      if (amt > balOf(asset)) { setError(`Insufficient ${asset} balance`); return }
      setSubmitting(true)
      try {
        const res = await fetch('/api/wallet/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset, amount: amt, recipientEmail: r.email }),
        })
        const data = await res.json()
        if (res.ok) {
          setResult(data)
          saveRecipient(r.email)
          setRecipients([{ email: '', amount: '' }])
          loadBalances()
        } else {
          setError(data.error || 'Transfer failed')
        }
      } catch { setError('Transfer failed') }
      finally { setSubmitting(false) }
    }
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

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-4">
            <button
              onClick={() => { setBatchMode(false); setError(''); setResult(null) }}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${!batchMode ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Single Send
            </button>
            <button
              onClick={() => { setBatchMode(true); setError(''); setResult(null) }}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${batchMode ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Users className="h-3 w-3 inline mr-1" />Batch Send
            </button>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><BookUser className="h-4 w-4 text-emerald-400" /> {batchMode ? 'Batch Transfer' : 'Withdraw to user'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1.5 block">Coin</label>
                <Select value={asset} onValueChange={v => { setAsset(v); setResult(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assets.map(a => <SelectItem key={a.asset} value={a.asset}>{a.asset} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  Available: {fmt(balOf(asset))} {asset}
                  {batchMode && <span className="ml-2 text-emerald-400">Total to send: {fmt(totalBatchAmount())} {asset}</span>}
                </div>
              </div>

              {/* Recipients */}
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs block">{batchMode ? 'Recipients' : 'Recipient'}</label>
                {recipients.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={r.email}
                      onChange={e => updateRecipient(i, 'email', e.target.value)}
                      className="flex-[2]"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={r.amount}
                      onChange={e => updateRecipient(i, 'amount', e.target.value)}
                      className="flex-1"
                    />
                    {batchMode && recipients.length > 1 && (
                      <button onClick={() => removeRecipientRow(i)} className="p-2 text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {batchMode && (
                  <button onClick={addRecipientRow} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add another recipient
                  </button>
                )}
                {savedRecipients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {savedRecipients.map(email => (
                      <button
                        key={email}
                        onClick={() => {
                          if (batchMode) {
                            const emptyIdx = recipients.findIndex(r => !r.email)
                            if (emptyIdx >= 0) updateRecipient(emptyIdx, 'email', email)
                            else updateRecipient(recipients.length - 1, 'email', email)
                          } else {
                            updateRecipient(0, 'email', email)
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-foreground border border-border hover:border-emerald-500/30 transition-colors"
                      >
                        <User className="h-3 w-3 text-muted-foreground" />
                        {email}
                        <span
                          onClick={e => { e.stopPropagation(); removeSavedRecipient(email) }}
                          className="ml-0.5 p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
              {result && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" /> {result.message}
                </div>
              )}

              <Button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {batchMode ? `Send to ${recipients.filter(r => r.email.includes('@') && parseFloat(r.amount) > 0).length} recipients` : 'Send'}
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
