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
  Copy,
  Wallet,
  Bitcoin,
  DollarSign,
  Zap,
  ExternalLink
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const PAYMENT_METHODS = [
  {
    id: 'BTC',
    label: 'Bitcoin',
    icon: '₿',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    activeBg: 'bg-orange-500/20 border-orange-500',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    network: 'Bitcoin Network'
  },
  {
    id: 'ETH',
    label: 'Ethereum',
    icon: 'Ξ',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    activeBg: 'bg-indigo-500/20 border-indigo-500',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Ethereum (ERC20)'
  },
  {
    id: 'USDT',
    label: 'Tether (USDT)',
    icon: '₮',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    activeBg: 'bg-emerald-500/20 border-emerald-500',
    address: '0xFfEDDe5a3f65685b7fbCeb24B864B23d1fDf5FB4',
    network: 'Tron (TRC20)'
  },
  {
    id: 'USDC',
    label: 'USD Coin (USDC)',
    icon: '$',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    activeBg: 'bg-blue-500/20 border-blue-500',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Ethereum (ERC20)'
  },
  {
    id: 'DAI',
    label: 'Dai (DAI)',
    icon: '◈',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    activeBg: 'bg-yellow-500/20 border-yellow-500',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Ethereum (ERC20)'
  },
  {
    id: 'BNB',
    label: 'BNB',
    icon: 'B',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    activeBg: 'bg-yellow-500/20 border-yellow-500',
    address: '0x0000000000000000000000000000000000000000',
    network: 'BNB Smart Chain'
  },
  {
    id: 'SOL',
    label: 'Solana',
    icon: 'S',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/30',
    activeBg: 'bg-violet-500/20 border-violet-500',
    address: '',
    network: 'Solana'
  },
  {
    id: 'XRP',
    label: 'XRP',
    icon: 'X',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/30',
    activeBg: 'bg-slate-500/20 border-slate-500',
    address: '',
    network: 'XRP Ledger'
  },
  {
    id: 'ADA',
    label: 'Cardano',
    icon: 'A',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    activeBg: 'bg-blue-500/20 border-blue-500',
    address: '',
    network: 'Cardano'
  },
  {
    id: 'DOGE',
    label: 'Dogecoin',
    icon: 'D',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    activeBg: 'bg-yellow-500/20 border-yellow-500',
    address: '',
    network: 'Dogecoin'
  },
  {
    id: 'LTC',
    label: 'Litecoin',
    icon: 'Ł',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/30',
    activeBg: 'bg-gray-500/20 border-gray-500',
    address: '',
    network: 'Litecoin'
  },
  {
    id: 'TRX',
    label: 'TRON',
    icon: 'T',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    activeBg: 'bg-red-500/20 border-red-500',
    address: '',
    network: 'Tron (TRC20)'
  },
]

export default function DepositPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [amount, setAmount] = useState('500')
  const [method, setMethod] = useState('BTC')
  const [step, setStep] = useState(1)   // 1=select, 2=QR code, 3=success
  const [serverAddress, setServerAddress] = useState('')  // address returned by server
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pastDeposits, setPastDeposits] = useState([])
  const [methodConfigs, setMethodConfigs] = useState({})

  // WalletConnect one-tap deposit state
  const [wcConnected, setWcConnected] = useState(false)
  const [wcAddress, setWcAddress] = useState('')
  const [wcProvider, setWcProvider] = useState(null)
  const [wcDepositing, setWcDepositing] = useState(false)
  const [wcTxHash, setWcTxHash] = useState('')
  const [wcError, setWcError] = useState('')

  useEffect(() => { checkAuth() }, [])
  useEffect(() => {
    if (user) {
      loadDeposits()
      loadDepositConfig()
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
  const loadDeposits = async () => {
    try {
      const res = await fetch('/api/wallet/deposits')
      if (res.ok) {
        const data = await res.json()
        setPastDeposits(data.deposits || [])
      }
    } catch (_) {}
  }

  const loadDepositConfig = async () => {
    try {
      const res = await fetch('/api/wallet/deposit-config')
      if (res.ok) {
        const data = await res.json()
        setMethodConfigs(data.methods || {})
      }
    } catch (_) {}
  }

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === method)
  const serverMethodConfig = methodConfigs[method] || {}
  // Use server-returned address (step 2+) or fall back to client-side placeholder for QR preview
  const displayAddress = serverAddress || serverMethodConfig.address || selectedMethod?.address || ''
  const qrUrl = serverMethodConfig.barcodeUrl
    ? serverMethodConfig.barcodeUrl
    : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(displayAddress)}&bgcolor=ffffff&color=000000&qzone=1`

  const handleNext = () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num < 10) {
      setMsg({ type: 'error', text: 'Please enter an amount of at least $10.' })
      return
    }
    setMsg(null)
    setStep(2)
  }

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(displayAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleWcConnect = async () => {
    setWcError('')
    try {
      const { connectWallet } = await import('@/lib/walletConnect')
      const { address, provider: prov } = await connectWallet()
      setWcAddress(address)
      setWcProvider(prov)
      setWcConnected(true)
    } catch (err) {
      setWcError(err?.message || 'Could not connect wallet')
    }
  }

  const handleWcDeposit = async () => {
    setWcError('')
    const num = parseFloat(amount)
    if (!num || num < 10) { setWcError('Minimum deposit is $10'); return }
    if (num > 50000) { setWcError('Maximum deposit is $50,000 USDT'); return }
    if (!wcProvider) { setWcError('Wallet not connected'); return }

    // Use the USDT deposit address from server config
    const usdtConfig = methodConfigs['USDT'] || {}
    const toAddress = usdtConfig.address || PAYMENT_METHODS.find(m => m.id === 'USDT')?.address
    if (!toAddress || toAddress === '0x0000000000000000000000000000000000000000') {
      setWcError('USDT deposit address not configured. Please use manual deposit.')
      return
    }

    setWcDepositing(true)
    try {
      const { walletDeposit } = await import('@/lib/walletConnect')
      const result = await walletDeposit({
        provider: wcProvider,
        fromAddress: wcAddress,
        toAddress,
        usdtAmount: num,
      })
      setWcTxHash(result.txHash)
      // Auto-submit deposit request so admin can see it
      await fetch('/api/wallet/deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, method: 'USDT', txHash: result.txHash }),
      })
      setStep(3)
      loadDeposits()
    } catch (err) {
      setWcError(err?.message || 'Transaction failed')
    } finally {
      setWcDepositing(false)
    }
  }

  const handleConfirmPayment = async () => {
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/wallet/deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), method })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.address) setServerAddress(data.address)
        setStep(3)
        loadDeposits()
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
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-foreground text-sm">Deposit Funds</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
          {/* Back button */}
          <Link href="/wallet" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>

          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Deposit Funds</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Send crypto to your Vaultquokka wallet. Funds are credited after admin verification.
          </p>

          {/* Step 1: Select amount + method */}
          {step === 1 && (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  Step 1: Choose Amount &amp; Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick amounts */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Amount (USD)</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['100', '250', '500', '1000', '5000'].map(a => (
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

                {/* Payment method */}
                <div>
                  <label className="text-muted-foreground text-sm mb-2 block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-3">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.id} onClick={() => setMethod(m.id)}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          method === m.id ? m.activeBg : m.bg
                        }`}>
                        <div className={`text-2xl font-bold mb-1 ${m.color}`}>{m.icon}</div>
                        <div className="text-foreground font-semibold text-sm">{m.label}</div>
                        <div className="text-muted-foreground text-xs">{m.network}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {msg && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {msg.text}
                  </div>
                )}

                {/* ── One-tap WalletConnect Deposit ── */}
                <div className="border border-emerald-500/30 rounded-xl p-4 bg-emerald-500/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    <span className="text-foreground text-sm font-semibold">One-Tap Deposit with Trust Wallet</span>
                    <span className="text-[10px] font-bold uppercase text-emerald-300 bg-emerald-400/15 px-1.5 py-0.5 rounded ml-auto">Instant</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Send USDT directly from your connected wallet. Max <strong className="text-foreground">$50,000</strong> per transaction. Confirm in Trust Wallet — no copy-paste needed.
                  </p>

                  {!wcConnected ? (
                    <Button onClick={handleWcConnect} variant="outline" className="w-full border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                      <Wallet className="h-4 w-4 mr-2" /> Connect Trust Wallet
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-mono truncate">{wcAddress}</span>
                      </div>
                      <Button
                        onClick={handleWcDeposit}
                        disabled={wcDepositing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {wcDepositing
                          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Waiting for approval in Trust Wallet…</>
                          : <><Zap className="h-4 w-4 mr-2" /> Send {parseFloat(amount) > 0 ? `$${parseFloat(amount).toLocaleString()}` : ''} USDT Now</>
                        }
                      </Button>
                    </div>
                  )}

                  {wcError && (
                    <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {wcError}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-muted-foreground text-xs">or deposit manually</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Button onClick={handleNext} className="bg-muted hover:bg-muted/80 text-foreground border border-border w-full">
                  Manual Crypto Deposit →
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: QR Code */}
          {step === 2 && (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-400" />
                  Step 2: Send Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="text-center">
                  <div className="text-muted-foreground text-sm mb-1">Send exactly</div>
                  <div className="text-3xl font-bold text-emerald-400">{formatCurrency(parseFloat(amount))}</div>
                  <div className="text-muted-foreground text-sm mt-1">via {selectedMethod?.label} ({selectedMethod?.network})</div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-3 rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt="Payment QR Code"
                      width={180}
                      height={180}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="text-muted-foreground text-xs">Scan with your crypto wallet</div>
                </div>

                {/* Address */}
                <div>
                  <div className="text-muted-foreground text-xs mb-2">Payment Address</div>
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-3 border border-border">
                    <code className="text-emerald-400 text-xs flex-1 break-all font-mono">
                      {displayAddress}
                    </code>
                    <button onClick={handleCopyAddress}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                      title="Copy address">
                      {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-300 text-xs">
                  ⚠️ Send <strong>only {selectedMethod?.label}</strong> to this address. Sending any other asset may result in permanent loss.
                </div>

                {msg && (
                  <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {msg.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground flex-1">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  >
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    I Have Sent the Funds ✓
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <Card className="bg-card border-emerald-500/20 mb-6">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Request Submitted!</h2>
                <p className="text-muted-foreground text-sm mb-1">
                  Your deposit request for <strong className="text-foreground">{formatCurrency(parseFloat(amount))}</strong> via <strong className="text-foreground">{selectedMethod?.label}</strong> has been received.
                </p>
                <p className="text-muted-foreground text-sm mb-6">
                  Our team will verify your payment and credit your account within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => { setStep(1); setAmount('500') }}
                    variant="ghost" className="text-muted-foreground hover:text-foreground border border-border">
                    Make Another Deposit
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

          {/* Past deposits */}
          {pastDeposits.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Deposit History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {pastDeposits.map(dep => (
                    <div key={dep.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">{formatCurrency(dep.amount)}</div>
                        <div className="text-muted-foreground text-xs">{dep.method} · {new Date(dep.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(dep.status)}`}>
                        {dep.status}
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
