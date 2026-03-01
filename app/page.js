'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  LineChart,
  Shield,
  Zap,
  CheckCircle,
  Menu,
  X,
  ArrowRight,
  MessageCircle,
  Lock,
  Globe2,
  Gamepad2,
  DollarSign,
  Activity
} from 'lucide-react'

// ─── Sparkline helper ────────────────────────────────────────────────────────
function generateSparkline(seed, points = 24, trend = 0) {
  let v = seed
  const data = []
  for (let i = 0; i < points; i++) {
    v = ((v * 1664525 + 1013904223) & 0xffffffff) >>> 0
    const noise = ((v % 200) - 100) / 100
    data.push(noise + trend * (i / points))
  }
  return data
}

function Sparkline({ seed, positive, width = 80, height = 32 }) {
  const data = generateSparkline(seed, 24, positive ? 0.8 : -0.8)
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
    } catch (err) {
      console.error('Auth check failed:', err)
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

    // 60-second timeout — gives schema init time to complete on first request
    // after a server restart or Supabase restore (schema migrations run once per process)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

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
        setError('Request timed out. Your Supabase database may be paused — visit app.supabase.com, restore your project, wait 30 seconds, then try again.')
      } else {
        setError('Network error. Please check your connection and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (user) {
    router.push('/dashboard')
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Redirecting to dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">

      {/* ── Top Ticker Bar ─────────────────────────────────────────────────── */}
      <div className="bg-[#0d1421] border-b border-slate-800/60 overflow-hidden h-9 flex items-center relative">
        {/* Platform Status badge */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 border-r border-slate-700 h-full bg-[#0d1421] z-10">
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
                <span className="text-slate-400 font-medium">{a.symbol}</span>
                <span className="text-white">{a.price}</span>
                <span className={a.up ? 'text-emerald-400' : 'text-red-400'}>{a.change}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0a0e1a]/95 backdrop-blur-md border-b border-slate-800/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg leading-none">K</span>
              </div>
              <span className="text-xl font-bold text-white">Kartomtrades</span>
            </div>

            <div className="hidden lg:flex items-center gap-8">
              <Link href="/markets" className="text-slate-300 hover:text-white transition-colors text-sm">Markets</Link>
              <Link href="#features" className="text-slate-300 hover:text-white transition-colors text-sm">Features</Link>
              <Link href="#accounts" className="text-slate-300 hover:text-white transition-colors text-sm">Accounts</Link>
              <Link href="#about" className="text-slate-300 hover:text-white transition-colors text-sm">About</Link>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => { setAuthMode('login'); setShowAuthModal(true) }}
                className="text-white hover:bg-slate-800 text-sm"
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

            <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0a0e1a] border-t border-slate-800 px-4 py-4 space-y-4">
            <Link href="/markets" className="block text-slate-300 hover:text-white text-sm">Markets</Link>
            <Link href="#features" className="block text-slate-300 hover:text-white text-sm">Features</Link>
            <Link href="#accounts" className="block text-slate-300 hover:text-white text-sm">Accounts</Link>
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <Button variant="ghost" onClick={() => { setAuthMode('login'); setShowAuthModal(true); setMobileMenuOpen(false) }} className="w-full text-white hover:bg-slate-800">Log In</Button>
              <Button onClick={() => { setAuthMode('register'); setShowAuthModal(true); setMobileMenuOpen(false) }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">Start Trading</Button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-16 px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

        <div className="container mx-auto relative">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs font-semibold tracking-wide uppercase">Award-Winning Trading Platform</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
              Markets move fast.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">So can you.</span>
            </h1>

            <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Trade 40+ Global Assets with our institutional-grade simulation and real-money platform.
              Start with <span className="text-white font-semibold">$100,000 in virtual funds</span> or switch to live trading — zero barriers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-base font-semibold shadow-lg shadow-emerald-500/25"
              >
                Start Trading
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
                className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-base"
              >
                <Gamepad2 className="mr-2 h-5 w-5 text-amber-400" />
                Try Free Demo
              </Button>
            </div>
          </div>

          {/* Terminal mockup */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 blur-3xl" />
            <div className="relative bg-[#0d1421] border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between bg-[#111827]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-slate-400 text-xs ml-2">Kartomtrades Terminal — BTC/USD</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Activity className="h-3 w-3" />
                  Live
                </div>
              </div>
              <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/40">
                {/* Positions */}
                <div className="p-5">
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Open Positions</div>
                  <div className="space-y-2">
                    {[
                      { symbol: 'BTCUSD', lots: '0.10', pnl: '+$284.50', pct: '+2.14%', up: true },
                      { symbol: 'XAUUSD', lots: '1.00', pnl: '-$74.20', pct: '-0.32%', up: false },
                      { symbol: 'AAPL', lots: '5', pnl: '+$91.00', pct: '+0.85%', up: true },
                    ].map((pos, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2.5">
                        <div>
                          <div className="text-white text-sm font-medium">{pos.symbol}</div>
                          <div className="text-slate-500 text-xs">{pos.lots} lots</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${pos.up ? 'text-emerald-400' : 'text-red-400'}`}>{pos.pnl}</div>
                          <div className={`text-xs ${pos.up ? 'text-emerald-500' : 'text-red-500'}`}>{pos.pct}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Chart area */}
                <div className="p-5 lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-white text-xl font-bold">BTC/USD</div>
                      <div className="text-slate-500 text-xs">Bitcoin · CFD</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-2xl font-bold">67,842.50</div>
                      <div className="text-emerald-400 text-sm font-semibold">+2.14% ▲</div>
                    </div>
                  </div>
                  {/* Fake candle chart */}
                  <div className="h-40 bg-slate-800/30 rounded-xl flex items-end gap-0.5 px-3 pb-3 pt-6 border border-slate-700/30">
                    {Array.from({ length: 40 }, (_, i) => {
                      const seed = (i * 7 + 13) * 1664525 & 0xffffff
                      const h = 20 + (seed % 80)
                      const up = seed % 3 !== 0
                      return (
                        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: up ? '#10b98155' : '#ef444455', border: `1px solid ${up ? '#10b981' : '#ef4444'}` }} />
                      )
                    })}
                  </div>
                  {/* Trade buttons */}
                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-500/25 transition-colors">
                      ▲ BUY 0.10 Lots
                    </button>
                    <button className="flex-1 bg-red-500/15 border border-red-500/40 text-red-400 rounded-lg py-2.5 text-sm font-semibold hover:bg-red-500/25 transition-colors">
                      ▼ SELL 0.10 Lots
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-3xl mx-auto">
            {[
              { value: '$100K', label: 'Demo Balance' },
              { value: '40+', label: 'Global Assets' },
              { value: 'Real-Time', label: 'Live Prices' },
              { value: 'KYC', label: 'Regulated Grade' },
            ].map((s, i) => (
              <div key={i} className="text-center bg-slate-800/30 rounded-xl py-4 border border-slate-700/30">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Market Grid ────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-[#0d1421]">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">Live Markets</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Trade intuitively on major markets
            </h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm">
              Stocks, Forex, Crypto, Commodities, Indices — all in one institutional-grade platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MARKET_CARDS.map((card, i) => (
              <div
                key={i}
                className="bg-[#111827] border border-slate-700/40 rounded-2xl p-5 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer group"
                onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-white font-bold text-base">{card.symbol}</div>
                    <div className="text-slate-500 text-xs">{card.name}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {card.change}
                  </span>
                </div>

                {/* Sparkline */}
                <div className="mb-3">
                  <Sparkline seed={card.seed} positive={card.up} width={160} height={40} />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-white text-lg font-bold">{card.price}</div>
                    <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.up ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {card.buyers}% are buyers
                    </div>
                  </div>
                  <button
                    className="text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Trade →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dual Wallet Section ─────────────────────────────────────────────── */}
      <section id="accounts" className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">Dual-Account System</div>
            <h2 className="text-3xl font-bold text-white">Practice. Then go Real.</h2>
            <p className="text-slate-400 mt-3 text-sm max-w-lg mx-auto">
              Separate Demo and Real wallets — identical interface, different stakes. Switch any time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Demo */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Gamepad2 className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-white font-bold">Demo Account</div>
                  <div className="text-amber-400 text-xs">🎯 Practice Mode</div>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white mb-2">$100,000</div>
              <div className="text-slate-400 text-sm mb-5">Virtual funds — no deposit needed. Full access to all markets and features.</div>
              <ul className="space-y-2 text-sm text-slate-300">
                {['No risk, real market prices', 'Instant fund reset any time', 'Full charting & analytics'].map((t, i) => (
                  <li key={i} className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
            {/* Real */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-white font-bold">Real Account</div>
                  <div className="text-emerald-400 text-xs">💼 Live Trading</div>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white mb-2">Your Funds</div>
              <div className="text-slate-400 text-sm mb-5">Deposit real capital after KYC verification. Same terminal, real P&L.</div>
              <ul className="space-y-2 text-sm text-slate-300">
                {['BTC/USDT deposits via QR code', 'Admin-approved in minutes', 'KYC verified & compliant'].map((t, i) => (
                  <li key={i} className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features / Trust Signals ─────────────────────────────────────────── */}
      <section id="features" className="py-16 px-4 bg-[#0d1421]">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">Why Kartomtrades</div>
            <h2 className="text-3xl font-bold text-white">Built for serious traders</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { icon: <Zap className="h-5 w-5" />, title: 'Real-Time Prices', desc: 'Live market data across 40+ instruments including Forex, Crypto, Stocks, Indices & Commodities.', color: 'text-yellow-400 bg-yellow-500/10' },
              { icon: <LineChart className="h-5 w-5" />, title: 'TradingView Charts', desc: 'Professional-grade charting with 100+ technical indicators, multiple timeframes, and drawing tools.', color: 'text-blue-400 bg-blue-500/10' },
              { icon: <Shield className="h-5 w-5" />, title: 'Regulator-Grade KYC', desc: 'Identity verification, document upload, admin approval flow — compliance built in from day one.', color: 'text-purple-400 bg-purple-500/10' },
              { icon: <Lock className="h-5 w-5" />, title: '0% Opening Fees', desc: 'No commissions on opening or closing trades. Our model is spread-based, just like major brokers.', color: 'text-emerald-400 bg-emerald-500/10' },
              { icon: <Globe2 className="h-5 w-5" />, title: 'Institutional Lot Sizes', desc: 'Trade Forex with standard, mini, and micro lots. Full pip-distance calculator and projected P&L.', color: 'text-cyan-400 bg-cyan-500/10' },
              { icon: <Activity className="h-5 w-5" />, title: 'Instant Settlement', desc: 'Single Prisma transaction ensures position close and balance update happen at the exact same time.', color: 'text-orange-400 bg-orange-500/10' },
            ].map((f, i) => (
              <div key={i} className="bg-[#111827] border border-slate-700/40 rounded-2xl p-6 hover:border-slate-600 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to step into the market?</h2>
            <p className="text-slate-400 mb-8 text-sm max-w-md mx-auto">
              Sign up in seconds. Start with $100,000 in demo funds. No credit card required.
            </p>
            <Button
              size="lg"
              onClick={() => { setAuthMode('register'); setShowAuthModal(true) }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 shadow-lg shadow-emerald-500/25"
            >
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer id="about" className="border-t border-slate-800/60 py-10 px-4 bg-[#0a0e1a]">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg leading-none">K</span>
                </div>
                <span className="text-xl font-bold text-white">Kartomtrades</span>
              </div>
              <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                A professional-grade simulated trading platform for education and practice. Not a licensed financial advisor.
              </p>
            </div>
            <div className="flex gap-12">
              <div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Platform</div>
                <div className="space-y-2">
                  <Link href="/markets" className="block text-slate-500 hover:text-white text-xs transition-colors">Markets</Link>
                  <button onClick={() => { setAuthMode('login'); setShowAuthModal(true) }} className="block text-slate-500 hover:text-white text-xs transition-colors text-left">Log In</button>
                  <button onClick={() => { setAuthMode('register'); setShowAuthModal(true) }} className="block text-slate-500 hover:text-white text-xs transition-colors text-left">Register</button>
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Legal</div>
                <div className="space-y-2">
                  <span className="block text-slate-500 text-xs">Risk Disclosure</span>
                  <span className="block text-slate-500 text-xs">Privacy Policy</span>
                  <span className="block text-slate-500 text-xs">Terms of Service</span>
                </div>
              </div>
            </div>
          </div>
          {/* Risk disclaimer */}
          <div className="border-t border-slate-800/60 pt-6">
            <p className="text-slate-600 text-xs leading-relaxed max-w-4xl">
              <span className="text-slate-500 font-semibold">Risk Warning:</span> 76% of retail investor accounts lose money when trading CFDs.
              You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.
              This platform is provided for educational and simulation purposes only. Past performance is not a reliable indicator of future results.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Floating Live Support ─────────────────────────────────────────── */}
      <button
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4 py-3 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
        onClick={openTawk}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">Live Support</span>
      </button>

      {/* ── Auth Modal ───────────────────────────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          <Card className="relative w-full max-w-md bg-[#111827] border-slate-700">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-sm leading-none">K</span>
                </div>
                <span className="text-white font-bold">Kartomtrades</span>
              </div>
              <CardTitle className="text-white text-xl">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                {authMode === 'login'
                  ? 'Sign in to access your trading account'
                  : 'Start with $100,000 in virtual funds — free forever'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMode} onValueChange={setAuthMode}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                  <TabsTrigger value="login" className="data-[state=active]:bg-emerald-600 text-sm">Login</TabsTrigger>
                  <TabsTrigger value="register" className="data-[state=active]:bg-emerald-600 text-sm">Register</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  {authMode === 'register' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-300">First Name</label>
                        <Input type="text" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-300">Last Name</label>
                        <Input type="text" placeholder="Smith" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300">Email Address</label>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" required />
                  </div>
                  {authMode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300">Phone (optional)</label>
                      <Input type="tel" placeholder="+1 555 000 0000" value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300">Password</label>
                    <Input type="password" placeholder={authMode === 'register' ? 'Min 8 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" required minLength={authMode === 'register' ? 8 : 1} />
                  </div>
                  {authMode === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-300">Confirm Password</label>
                      <Input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm" required minLength={8} />
                    </div>
                  )}

                  {error && (
                    <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/30 p-3 rounded-lg">{error}</div>
                  )}

                  <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white" disabled={submitting}>
                    {submitting ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                  </Button>

                  {authMode === 'register' && (
                    <p className="text-xs text-slate-500 text-center">
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
