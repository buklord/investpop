'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MarketSparkline from '@/components/trading/Sparkline'
import { 
  Menu,
  X,
  ArrowRight,
  MessageCircle,
  Shield,
  Zap,
  LineChart,
  CheckCircle,
  Lock,
  Globe2,
  Gamepad2,
  DollarSign,
  Activity
} from 'lucide-react'

// ─── Deterministic sparkline series helper ─────────────────────────────────
function generateSeries(seed, points = 28, trend = 0) {
  let v = seed
  const data = []
  for (let i = 0; i < points; i++) {
    v = ((v * 1664525 + 1013904223) & 0xffffffff) >>> 0
    const noise = ((v % 200) - 100) / 100
    data.push(noise + trend * (i / points))
  }
  return data
}

// ─── Ticker data (simulated, realistic) ─────────────────────────────────────
const TICKER_ASSETS = [
  { symbol: 'BTC/USD', price: '67,842.50', change: '+2.14%', up: true },
  { symbol: 'ETH/USD', price: '3,541.20', change: '+1.87%', up: true },
  { symbol: 'XAU/USD', price: '2,318.40', change: '-0.32%', up: false },
  { symbol: 'EUR/USD', price: '1.0872', change: '+0.08%', up: true },
  { symbol: 'US100', price: '18,204.00', change: '+0.64%', up: true },
  { symbol: 'US30', price: '38,971.50', change: '-0.12%', up: false },
  { symbol: 'OIL/USD', price: '83.21', change: '+0.95%', up: true },
  { symbol: 'GBP/USD', price: '1.2691', change: '-0.04%', up: false },
  { symbol: 'SPX500', price: '5,218.70', change: '+0.41%', up: true },
  { symbol: 'TSLA', price: '178.50', change: '+3.21%', up: true },
]

// ─── Market cards ─────────────────────────────────────────────────────────────
const MARKET_CARDS = [
  { symbol: 'XAU/USD', name: 'Gold', price: '2,318.40', change: '-0.32%', up: false, buyers: 58, seed: 11 },
  { symbol: 'US100', name: 'Nasdaq 100', price: '18,204.00', change: '+0.64%', up: true, buyers: 72, seed: 22 },
  { symbol: 'OIL/USD', name: 'Crude Oil', price: '83.21', change: '+0.95%', up: true, buyers: 64, seed: 33 },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: '67,842.50', change: '+2.14%', up: true, buyers: 77, seed: 44 },
]

export default function HomePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  // Retry up to 10 times at 400ms intervals before giving up
  const openTawk = () => {
    if (typeof window === 'undefined') return
    let attempts = 0
    const tryOpen = () => {
      if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
        window.Tawk_API.maximize()
      } else if (attempts < 10) {
        attempts++
        setTimeout(tryOpen, 400)
      } else {
        console.warn('[Tawk] Widget not ready after 10 attempts')
      }
    }
    tryOpen()
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    // Hard 8-second timeout — if the DB is slow to respond we still show the
    // landing page rather than hanging forever on "Loading..."
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch('/api/auth/me', { signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      // AbortError = timeout — just show the page unauthenticated, not an error
      if (err?.name !== 'AbortError') {
        console.error('Auth check failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (authMode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    // 90-second timeout — accommodates up to 3 automatic DB retry attempts
    // (3s + 8s + 15s delays) that fire when the database is cold-starting.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = { email, password }
      if (authMode === 'register' && firstName) body.firstName = firstName
      if (authMode === 'register' && lastName) body.lastName = lastName
      if (authMode === 'register' && phone) body.phone = phone
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      let data
      try {
        data = await res.json()
      } catch {
        // Server returned non-JSON (HTML error page) — treat as server error
        setError('Server error. Please restart the dev server and try again.')
        return
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      setUser(data.user)
      // Identify logged-in user inside Tawk.to so admin sees their name/email
      if (typeof window !== 'undefined' && window.Tawk_API && window.Tawk_API.setAttributes) {
        window.Tawk_API.setAttributes({
          name:  data.user?.name  || data.user?.email,
          email: data.user?.email,
          id:    data.user?.id,
        }, function() {})
      }
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(timeoutId)
      if (err?.name === 'AbortError') {
        setError('The server is taking longer than expected. The database may be waking up — please wait a moment and try again.')
      } else {
        setError('Network error. Please check your connection and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground/90 text-xl">Loading...</div>
      </div>
    )
  }

  if (user) {
    router.push('/dashboard')
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-foreground/90 text-xl">Redirecting to dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top Ticker Bar ─────────────────────────────────────────────────── */}
      <div className="bg-background/80 border-b border-border/60 overflow-hidden h-9 flex items-center relative">
        {/* Platform Status badge */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 border-r border-border/60 h-full bg-background/80 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 text-xs font-medium whitespace-nowrap">Platform Online</span>
        </div>
        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-[ticker_30s_linear_infinite] gap-8 w-max px-4">
            {[...TICKER_ASSETS, ...TICKER_ASSETS].map((a, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span className="text-muted-foreground font-medium">{a.symbol}</span>
                <span className="text-foreground">{a.price}</span>
                <span className={a.up ? 'text-emerald-400' : 'text-red-400'}>{a.change}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg leading-none">K</span>
              </div>
              <span className="text-xl font-bold text-foreground">Kartomtrades</span>
            </div>

            <div className="hidden lg:flex items-center gap-8">
              <Link href="/markets" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Markets</Link>
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Features</Link>
              <Link href="#accounts" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Accounts</Link>
              <Link href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-sm">About</Link>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => { setAuthMode('login'); setShowAuthModal(true) }}
                className="text-foreground hover:bg-accent text-sm"
              >
                Log In
              </Button>
              <Button
                onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-5"
              >
                Start Trading
              </Button>
            </div>

            <button className="lg:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-background border-t border-border/60 px-4 py-4 space-y-4">
            <Link href="/markets" className="block text-muted-foreground hover:text-foreground text-sm">Markets</Link>
            <Link href="#features" className="block text-muted-foreground hover:text-foreground text-sm">Features</Link>
            <Link href="#accounts" className="block text-muted-foreground hover:text-foreground text-sm">Accounts</Link>
            <div className="pt-4 border-t border-border/60 space-y-2">
              <Button variant="ghost" onClick={() => { setAuthMode('login'); setShowAuthModal(true); setMobileMenuOpen(false) }} className="w-full text-foreground hover:bg-accent">Log In</Button>
              <Button onClick={() => { setAuthMode('register'); setShowAuthModal(true); setMobileMenuOpen(false) }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">Start Trading</Button>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-12 lg:pt-16 pb-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 left-1/2 h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute top-24 right-[-120px] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="container mx-auto px-4 relative">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Platform Online
                  </Badge>
                  <Badge variant="outline" className="border-border/60 text-muted-foreground">
                    Demo + Live accounts
                  </Badge>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
                  Trade faster.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Stay in control.</span>
                </h1>
                <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  A clean, institutional-style terminal for Forex, Crypto, Stocks, Indices, and Commodities.
                  Start with <span className="text-foreground font-semibold">$100,000 demo funds</span>, then switch to live trading after verification.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Button
                    size="lg"
                    onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8"
                  >
                    Start Trading
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                    className="border-border/60"
                  >
                    <Gamepad2 className="mr-2 h-5 w-5 text-amber-400" />
                    Try Free Demo
                  </Button>
                  <Button asChild size="lg" variant="ghost" className="justify-start sm:justify-center">
                    <Link href="/markets">Explore Markets</Link>
                  </Button>
                </div>

                <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                  {[
                    { label: 'Demo Balance', value: '$100K' },
                    { label: 'Instruments', value: '40+' },
                    { label: 'Execution', value: 'Real‑Time' },
                    { label: 'Onboarding', value: 'KYC' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-border/60 bg-card/40 backdrop-blur px-4 py-3">
                      <div className="text-foreground font-bold text-lg leading-none">{item.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terminal preview */}
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 blur-2xl" />
                <Card className="relative rounded-3xl border-border/60 bg-card/40 backdrop-blur overflow-hidden">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500/70" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                        </div>
                        <div className="text-xs text-muted-foreground">Terminal Preview · BTC/USD</div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <Activity className="h-3.5 w-3.5" />
                        Live
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">BTC/USD</div>
                            <div className="text-xs text-muted-foreground">Bitcoin · CFD</div>
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">+2.14%</Badge>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div>
                            <div className="text-2xl font-bold text-foreground leading-none">67,842.50</div>
                            <div className="text-xs text-muted-foreground mt-1">Last update: now</div>
                          </div>
                          <MarketSparkline
                            values={generateSeries(44, 34, 0.75)}
                            width={120}
                            height={36}
                            className="shrink-0"
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <Button variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15">
                            ▲ Buy
                          </Button>
                          <Button variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15">
                            ▼ Sell
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="text-xs text-muted-foreground font-medium">Open Positions</div>
                        <div className="mt-3 space-y-2">
                          {[
                            { symbol: 'BTCUSD', lots: '0.10', pnl: '+$284.50', pct: '+2.14%', up: true },
                            { symbol: 'XAUUSD', lots: '1.00', pnl: '-$74.20', pct: '-0.32%', up: false },
                            { symbol: 'AAPL', lots: '5', pnl: '+$91.00', pct: '+0.85%', up: true },
                          ].map((pos) => (
                            <div key={pos.symbol} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/30 px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-foreground">{pos.symbol}</div>
                                <div className="text-xs text-muted-foreground">{pos.lots} lots</div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-semibold ${pos.up ? 'text-emerald-400' : 'text-red-400'}`}>{pos.pnl}</div>
                                <div className={`text-xs ${pos.up ? 'text-emerald-400/90' : 'text-red-400/90'}`}>{pos.pct}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">Account</div>
                            <div className="text-xs text-muted-foreground">Available</div>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-sm font-semibold text-foreground">Demo</div>
                            <div className="text-sm font-semibold text-foreground">$100,000</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ── Markets ───────────────────────────────────────────────────── */}
        <section className="py-16 border-t border-border/60 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Live Markets</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Major markets, one clean interface</h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
                Watch price action across key instruments. Practice in demo mode or go live after verification.
              </p>
            </div>

            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {MARKET_CARDS.map((card) => {
                const values = generateSeries(card.seed, 28, card.up ? 0.7 : -0.7)
                return (
                  <Card
                    key={card.symbol}
                    className="group cursor-pointer rounded-2xl border-border/60 bg-card/40 backdrop-blur hover:bg-card/60 transition-colors"
                    onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-foreground">{card.symbol}</div>
                          <div className="text-xs text-muted-foreground">{card.name}</div>
                        </div>
                        <Badge className={card.up
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-300 border border-red-500/20'
                        }>
                          {card.change}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xl font-bold text-foreground leading-none">{card.price}</div>
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.up ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {card.buyers}% are buyers
                          </div>
                        </div>
                        <MarketSparkline values={values} width={120} height={32} className="shrink-0" />
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" className="w-full border-border/60 bg-background/40 hover:bg-accent">
                          Trade
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Accounts ─────────────────────────────────────────────────── */}
        <section id="accounts" className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Dual-Account System</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Practice first. Go live when ready.</h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
                Two wallets, same terminal. Demo for skill-building, real account for live trading after verification.
              </p>
            </div>

            <div className="mt-10 grid md:grid-cols-2 gap-5">
              <Card className="rounded-2xl border-border/60 bg-card/40 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                      <Gamepad2 className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Demo Account</CardTitle>
                      <CardDescription>Practice mode with virtual funds</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight">$100,000</div>
                  <div className="mt-2 text-sm text-muted-foreground">No deposit. Full access to markets and tools.</div>
                  <ul className="mt-5 space-y-2 text-sm">
                    {['Realistic market simulation', 'Reset demo funds anytime', 'Charts and risk controls included'].map((t) => (
                      <li key={t} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-card/40 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Real Account</CardTitle>
                      <CardDescription>Live trading after verification</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold tracking-tight">Your Funds</div>
                  <div className="mt-2 text-sm text-muted-foreground">Deposit after KYC. Same terminal, real P&L.</div>
                  <ul className="mt-5 space-y-2 text-sm">
                    {['Fast deposits (BTC/USDT)', 'Admin review workflow', 'Compliance-ready onboarding'].map((t) => (
                      <li key={t} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section id="features" className="py-16 border-t border-border/60 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Why Kartomtrades</div>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Built for calm, confident execution</h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
                The details that make a trading terminal feel fast: clarity, safety, and consistent workflows.
              </p>
            </div>

            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { Icon: Zap, title: 'Real‑Time Prices', desc: 'Responsive market snapshots across core instruments.', tone: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
                { Icon: LineChart, title: 'Advanced Charting', desc: 'Built to support indicator-driven decisions and analysis.', tone: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                { Icon: Shield, title: 'Verification Workflow', desc: 'KYC onboarding and admin approval flow baked in.', tone: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                { Icon: Lock, title: 'Spread-Based Trading', desc: 'No opening fees — simple model aligned with major brokers.', tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { Icon: Globe2, title: 'Flexible Lot Sizes', desc: 'Standard, mini, and micro lots for better risk control.', tone: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
                { Icon: Activity, title: 'Consistent Settlement', desc: 'Atomic balance updates to keep positions and P&L correct.', tone: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              ].map(({ Icon, title, desc, tone }) => (
                <Card key={title} className="rounded-2xl border-border/60 bg-card/40 backdrop-blur">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription className="mt-1">{desc}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-10 md:p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ready to step into the market?</h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                Create an account in seconds. Start with $100,000 in demo funds. No credit card required.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-10"
                >
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="border-border/60" onClick={openTawk}>
                  Talk to Support
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer id="about" className="border-t border-border/60 py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg leading-none">K</span>
                </div>
                <span className="text-xl font-bold text-foreground">Kartomtrades</span>
              </div>
              <p className="text-muted-foreground text-xs max-w-xs leading-relaxed">
                A professional-grade simulated trading platform for education and practice. Not a licensed financial advisor.
              </p>
            </div>
            <div className="flex gap-12">
              <div>
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Platform</div>
                <div className="space-y-2">
                  <Link href="/markets" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">Markets</Link>
                  <button onClick={() => { setAuthMode('login'); setShowAuthModal(true) }} className="block text-muted-foreground hover:text-foreground text-xs transition-colors text-left">Log In</button>
                  <button onClick={() => { setAuthMode('register'); setShowAuthModal(true) }} className="block text-muted-foreground hover:text-foreground text-xs transition-colors text-left">Register</button>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Legal</div>
                <div className="space-y-2">
                  <span className="block text-muted-foreground text-xs">Risk Disclosure</span>
                  <span className="block text-muted-foreground text-xs">Privacy Policy</span>
                  <span className="block text-muted-foreground text-xs">Terms of Service</span>
                </div>
              </div>
            </div>
          </div>
          {/* Risk disclaimer */}
          <div className="border-t border-border/60 pt-6">
            <p className="text-muted-foreground text-xs leading-relaxed max-w-4xl">
              <span className="text-foreground/80 font-semibold">Risk Warning:</span> 76% of retail investor accounts lose money when trading CFDs.
              You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.
              This platform is provided for educational and simulation purposes only. Past performance is not a reliable indicator of future results.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Floating Live Support ─────────────────────────────────────────── */}
      <button
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4 py-3 shadow-xl shadow-emerald-500/30 transition-colors"
        onClick={openTawk}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">Live Support</span>
      </button>

      {/* ── Auth Modal ───────────────────────────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          <Card className="relative w-full max-w-md bg-card/95 border-border/60">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-sm leading-none">K</span>
                </div>
                <span className="text-foreground font-bold">Kartomtrades</span>
              </div>
              <CardTitle className="text-foreground text-xl">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                {authMode === 'login'
                  ? 'Sign in to access your trading account'
                  : 'Start with $100,000 in virtual funds — free forever'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMode} onValueChange={setAuthMode}>
                <TabsList className="grid w-full grid-cols-2 bg-muted">
                  <TabsTrigger value="login" className="data-[state=active]:bg-emerald-600 text-sm">Login</TabsTrigger>
                  <TabsTrigger value="register" className="data-[state=active]:bg-emerald-600 text-sm">Register</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  {authMode === 'register' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">First Name</label>
                        <Input type="text" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Last Name</label>
                        <Input type="text" placeholder="Smith" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Email Address</label>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" required />
                  </div>
                  {authMode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Phone (optional)</label>
                      <Input type="tel" placeholder="+1 555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Password</label>
                    <Input type="password" placeholder={authMode === 'register' ? 'Min 8 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" required minLength={authMode === 'register' ? 8 : 1} />
                  </div>
                  {authMode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Confirm Password</label>
                      <Input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-background border-border/60 text-foreground placeholder:text-muted-foreground text-sm" required minLength={8} />
                    </div>
                  )}

                  {error && (
                    <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{error}</div>
                  )}

                  <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white" disabled={submitting}>
                    {submitting ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                  </Button>

                  {authMode === 'register' && (
                    <p className="text-xs text-muted-foreground text-center">
                      By signing up, you agree to our terms of service and risk disclosure.
                    </p>
                  )}
                </form>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
