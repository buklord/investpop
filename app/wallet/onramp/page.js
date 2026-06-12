'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, CreditCard, Building2, ArrowLeft, ShieldCheck,
  DollarSign, Bitcoin, ChevronRight, Globe
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

const METHODS = [
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, fee: '2.99%', min: 10, max: 10000, soon: false },
  { id: 'bank', label: 'Bank Transfer (ACH/SEPA)', icon: Building2, fee: '0.5%', min: 50, max: 50000, soon: false },
  { id: 'apple', label: 'Apple Pay', icon: CreditCard, fee: '2.99%', min: 10, max: 5000, soon: true },
  { id: 'google', label: 'Google Pay', icon: CreditCard, fee: '2.99%', min: 10, max: 5000, soon: true },
]

const ASSETS = [
  { symbol: 'USDT', name: 'TetherUS', color: '#26a17b' },
  { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  { symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775ca' },
]

export default function OnrampPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState('100')
  const [selectedMethod, setSelectedMethod] = useState('card')
  const [selectedAsset, setSelectedAsset] = useState('USDT')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  const method = METHODS.find(m => m.id === selectedMethod)
  const numAmount = parseFloat(amount) || 0
  const fee = numAmount * (parseFloat((method?.fee || '0').replace('%', '')) / 100)
  const receive = numAmount - fee

  const submit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1500))
    setSubmitting(false)
    setDone(true)
  }

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

        <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto w-full">
          <button onClick={() => router.push('/wallet')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Wallet
          </button>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Buy Crypto</h1>
            <p className="text-muted-foreground text-sm">Purchase crypto instantly with fiat. Powered by VaultQuokka partners.</p>
          </div>

          {done ? (
            <Card className="bg-card border-emerald-500/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Order Submitted!</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your {receive.toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedAsset} purchase is being processed.
                  You'll receive an email confirmation shortly.
                </p>
                <Button onClick={() => { setDone(false); setStep(1); setAmount('100') }} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                  Buy More
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-emerald-500' : 'bg-muted'}`} />
                ))}
              </div>

              {step === 1 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-400" /> Amount & Asset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-muted-foreground text-xs mb-1.5 block">You pay (USD)</label>
                      <Input
                        type="number"
                        min={method?.min || 10}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="text-lg font-semibold"
                        placeholder="100"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-muted-foreground">Min: ${method?.min || 10}</span>
                        <span className="text-xs text-muted-foreground">Max: ${(method?.max || 10000).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs mb-1.5 block">You receive</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ASSETS.map(a => (
                          <button
                            key={a.symbol}
                            onClick={() => setSelectedAsset(a.symbol)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors text-left ${
                              selectedAsset === a.symbol
                                ? 'border-emerald-500/50 bg-emerald-500/10'
                                : 'border-border bg-card hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: a.color }}>
                              {a.symbol[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{a.symbol}</div>
                              <div className="text-[10px] text-muted-foreground">{a.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={() => setStep(2)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      Continue <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <Globe className="h-4 w-4 text-emerald-400" /> Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {METHODS.map(m => (
                      <button
                        key={m.id}
                        disabled={m.soon}
                        onClick={() => !m.soon && setSelectedMethod(m.id)}
                        className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors text-left ${
                          selectedMethod === m.id && !m.soon
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-border bg-card hover:border-emerald-500/30'
                        } ${m.soon ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <m.icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{m.label}</div>
                          <div className="text-xs text-muted-foreground">Fee: {m.fee} · Min: ${m.min}</div>
                        </div>
                        {m.soon && <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-400/15 px-1.5 py-0.5 rounded">Soon</span>}
                        {selectedMethod === m.id && !m.soon && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                      </button>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-border">Back</Button>
                      <Button onClick={() => setStep(3)} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white">
                        Continue <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <Bitcoin className="h-4 w-4 text-emerald-400" /> Review Order
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">You pay</span>
                        <span className="font-medium text-foreground">${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payment method</span>
                        <span className="font-medium text-foreground">{method?.label}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fee ({method?.fee})</span>
                        <span className="font-medium text-foreground">${fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between">
                        <span className="text-sm text-muted-foreground">You receive</span>
                        <span className="font-bold text-emerald-400">{receive.toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedAsset}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Your funds are held securely. Crypto will be deposited to your spot wallet within minutes.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-border">Back</Button>
                      <Button onClick={submit} disabled={submitting} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Purchase
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
