'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Menu,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wallet,
  ArrowUpFromLine,
  DollarSign,
  Clock,
  XCircle
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const WITHDRAWAL_METHODS = [
  { id: 'BTC', label: 'Bitcoin', network: 'Bitcoin Network' },
  { id: 'USDT', label: 'Tether (USDT)', network: 'ERC-20 (Ethereum)' },
  { id: 'USDC', label: 'USD Coin (USDC)', network: 'ERC-20 (Ethereum)' },
]

export default function WithdrawalPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('BTC')
  const [address, setAddress] = useState('')
  const [step, setStep] = useState(1) // 1=form, 2=success
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pastWithdrawals, setPastWithdrawals] = useState([])
  const [realBalance, setRealBalance] = useState(0)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => {
    if (user) {
      loadWithdrawals()
      loadBalance()
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadBalance = async () => {
    try {
      const res = await fetch('/api/account/summary')
      if (res.ok) {
        const data = await res.json()
        setRealBalance(data.real_balance || 0)
      }
    } catch (_) {}
  }

  const loadWithdrawals = async () => {
    try {
      const res = await fetch('/api/withdrawal/list')
      if (res.ok) {
        const data = await res.json()
        setPastWithdrawals(data.withdrawals || [])
      }
    } catch (_) {}
  }

  const handleSubmit = async () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num < 10) {
      setMsg({ type: 'error', text: 'Please enter an amount of at least $10.' })
      return
    }
    if (!address || address.trim().length < 10) {
      setMsg({ type: 'error', text: 'Please enter a valid wallet address.' })
      return
    }
    if (num > realBalance) {
      setMsg({ type: 'error', text: 'Insufficient real balance.' })
      return
    }

    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/withdrawal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, method, address: address.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setStep(2)
        loadWithdrawals()
        loadBalance()
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to submit request.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)

  const statusColor = (s) => {
    if (s === 'COMPLETED') return 'text-emerald-400 bg-emerald-500/10'
    if (s === 'REJECTED') return 'text-red-400 bg-red-500/10'
    return 'text-amber-400 bg-amber-500/10'
  }

  const statusIcon = (s) => {
    if (s === 'COMPLETED') return <CheckCircle className="h-4 w-4 text-emerald-400" />
    if (s === 'REJECTED') return <XCircle className="h-4 w-4 text-red-400" />
    return <Clock className="h-4 w-4 text-amber-400" />
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-foreground text-sm">Withdraw</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
          <Link href="/wallet" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>

          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Withdraw Funds</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Request a withdrawal to your crypto wallet. Available real balance: <strong className="text-emerald-400">{formatCurrency(realBalance)}</strong>
          </p>

          {step === 1 && (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-emerald-400" />
                  Withdrawal Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Amount */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Amount (USD)</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['100', '250', '500', '1000'].map(a => (
                      <button key={a} onClick={() => setAmount(a)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                          amount === a
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-muted text-muted-foreground border-border hover:border-ring'
                        }`}>
                        ${parseInt(a).toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    type="number"
                    min="10"
                    step="1"
                    placeholder="Custom amount"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Method */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Withdrawal Method</label>
                  <div className="grid grid-cols-3 gap-3">
                    {WITHDRAWAL_METHODS.map(m => (
                      <button key={m.id} onClick={() => setMethod(m.id)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          method === m.id
                            ? 'bg-emerald-500/10 border-emerald-500'
                            : 'bg-muted border-border hover:border-ring'
                        }`}>
                        <div className="text-foreground font-semibold text-sm">{m.label}</div>
                        <div className="text-muted-foreground text-xs">{m.network}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Destination Address</label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={`Enter your ${method} wallet address`}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-muted-foreground text-xs mt-1">Double-check your address. Withdrawals to incorrect addresses cannot be recovered.</p>
                </div>

                {msg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {msg.text}
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Withdrawal Request
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="bg-card border-emerald-500/20 mb-6">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Request Submitted!</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your withdrawal request for <strong className="text-foreground">{formatCurrency(parseFloat(amount))}</strong> via <strong className="text-foreground">{method}</strong> has been received.
                </p>
                <p className="text-muted-foreground text-sm mb-6">
                  Our team will review and process it within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => { setStep(1); setAmount(''); setAddress('') }}
                    variant="ghost" className="text-muted-foreground hover:text-foreground border border-border">
                    Make Another Withdrawal
                  </Button>
                  <Link href="/wallet">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
                      Back to Wallet
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past withdrawals */}
          {pastWithdrawals.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {pastWithdrawals.map(wd => (
                    <div key={wd.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {statusIcon(wd.status)}
                        <div>
                          <div className="text-foreground text-sm font-medium">{formatCurrency(wd.amount)}</div>
                          <div className="text-muted-foreground text-xs">{wd.method} · {new Date(wd.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(wd.status)}`}>
                        {wd.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
