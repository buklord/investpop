'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MarketSparkline from '@/components/trading/Sparkline'
import {
  Menu, X, ArrowRight, MessageCircle, Shield, Zap, LineChart,
  CheckCircle, Lock, Globe2, Gamepad2, DollarSign, Activity,
  Users, BarChart3, Copy
} from 'lucide-react'

// ─── Animated equity curve ────────────────────────────────────────────────
function generateEquityCurve(points = 80) {
  const values = []
  let v = 100000
  for (let i = 0; i < points; i++) {
    const noise = (Math.sin(i * 0.7) * 400 + Math.sin(i * 0.2) * 800 + Math.random() * 300 - 100)
    v = v + 120 + noise
    values.push(Math.max(95000, v))
  }
  return values
}

function EquityCurve({ animate = true }) {
  const [points, setPoints] = useState(() => generateEquityCurve(80))
  const frameRef = useRef(null)

  useEffect(() => {
    if (!animate) return
    let running = true
    const tick = () => {
      if (!running) return
      setPoints(prev => {
        const next = [...prev.slice(1)]
        const last = next[next.length - 1]
        const noise = (Math.sin(Date.now() * 0.001) * 400 + Math.random() * 600 - 200)
        next.push(Math.max(95000, last + 80 + noise))
        return next
      })
      frameRef.current = setTimeout(tick, 150)
    }
    frameRef.current = setTimeout(tick, 150)
    return () => { running = false; clearTimeout(frameRef.current) }
  }, [animate])

  const w = 600, h = 180
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1

  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - ((v - min) / span) * (h - 10) - 5,
  }))

  const linePath = coords.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = linePath + ` L${w},${h} L0,${h} Z`
  const latest = points[points.length - 1]
  const pct = (((latest - points[0]) / points[0]) * 100).toFixed(1)

  return (
    <div className="relative">
      <div className="flex items-end justify-between mb-2 px-1">
        <div>
          <div className="text-xs text-white/40 font-medium mb-0.5">Portfolio Value</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            ${Math.round(latest).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-emerald-400 font-bold">+{pct}%</div>
          <div className="text-xs text-white/30">this session</div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[100px]">
        <defs>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#curveGrad)" />
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.length > 0 && (
          <g>
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="5" fill="#10b981" opacity="0.3" />
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill="#10b981" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────
function AnimatedCounter({ target, prefix = '', suffix = '', duration = 1800, decimals = 0 }) {
  const [val, setVal] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || target === 0) return
    started.current = true
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(eased * target)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()
  return <span>{prefix}{formatted}{suffix}</span>
}

// ─── Static ticker fallback ───────────────────────────────────────────────
const STATIC_TICKER = [
  { symbol: 'BTC/USD', price: '67,842.50', change: '+2.14%', up: true },
  { symbol: 'ETH/USD', price: '3,541.20',  change: '+1.87%', up: true },
  { symbol: 'XAU/USD', price: '2,318.40',  change: '-0.32%', up: false },
  { symbol: 'EUR/USD', price: '1.0872',    change: '+0.08%', up: true },
  { symbol: 'US100',   price: '18,204.00', change: '+0.64%', up: true },
  { symbol: 'US30',    price: '38,971.50', change: '-0.12%', up: false },
  { symbol: 'OIL/USD', price: '83.21',     change: '+0.95%', up: true },
  { symbol: 'GBP/USD', price: '1.2691',    change: '-0.04%', up: false },
  { symbol: 'SPX500',  price: '5,218.70',  change: '+0.41%', up: true },
  { symbol: 'TSLA',    price: '178.50',    change: '+3.21%', up: true },
]

const DISPLAY_SYMBOLS = ['BTCUSD','ETHUSD','XAUUSD','EURUSD','US100','US30','USOIL','GBPUSD','SPX500','AAPL']

function formatTickerPrice(val, symbol) {
  if (!val) return '--'
  const n = Number(val)
  if (!Number.isFinite(n)) return '--'
  if (n > 10000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n > 100)   return n.toFixed(2)
  return n.toFixed(4)
}

const SYMBOL_DISPLAY = {
  BTCUSD: 'BTC/USD', ETHUSD: 'ETH/USD', XAUUSD: 'XAU/USD',
  EURUSD: 'EUR/USD', USOIL: 'OIL/USD', GBPUSD: 'GBP/USD',
}

const MOCK_POSITIONS = [
  { symbol: 'XAUUSD', side: 'BUY',  lots: 1.00, entry: 2315.20 },
  { symbol: 'BTCUSD', side: 'BUY',  lots: 0.10, entry: 66100   },
  { symbol: 'EURUSD', side: 'SELL', lots: 2.00, entry: 1.0890  },
]

export default function HomePage() {
  const router = useRouter()

  const [user, setUser]                     = useState(null)
  const [authLoading, setAuthLoading]       = useState(true)
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [firstName, setFirstName]           = useState('')
  const [step, setStep]                     = useState(1)
  const [error, setError]                   = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [showLogin, setShowLogin]           = useState(false)
  const [loginEmail, setLoginEmail]         = useState('')
  const [loginPassword, setLoginPassword]   = useState('')
  const [loginError, setLoginError]         = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [prices, setPrices]                 = useState({})
  const [stats, setStats]                   = useState({ accounts: 0, totalVolume: 0, trades: 0, uptime: 99 })
  const [mobileMenu, setMobileMenu]         = useState(false)
  const [formHighlight, setFormHighlight]   = useState(false)
  const emailRef = useRef(null)

  const livePositions = useMemo(() => MOCK_POSITIONS.map(pos => {
    const q = prices[pos.symbol]
    const mid = q ? Number(q.mid) : null
    let pnl = null
    if (mid) {
      const diff = pos.side === 'BUY' ? mid - pos.entry : pos.entry - mid
      const mult = pos.symbol === 'XAUUSD' ? 100 : pos.symbol === 'BTCUSD' ? 1 : 100000
      pnl = diff * pos.lots * mult
    }
    return { ...pos, pnl }
  }), [prices])

  const tickerItems = useMemo(() => {
    const live = DISPLAY_SYMBOLS.map(sym => {
      const q = prices[sym]
      if (!q) return null
      const mid  = Number(q.mid)
      const high = Number(q.high)
      const change = high > 0 ? ((mid - high) / high * 100) : 0
      return {
        symbol: SYMBOL_DISPLAY[sym] || sym,
        price: formatTickerPrice(mid, sym),
        change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
        up: change >= 0,
      }
    }).filter(Boolean)
    return live.length >= 5 ? live : STATIC_TICKER
  }, [prices])

  // ── Effects ──
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    fetch('/api/auth/me', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setUser(d.user) })
      .catch(() => {})
      .finally(() => { clearTimeout(t); setAuthLoading(false) })
    return () => { clearTimeout(t); ctrl.abort() }
  }, [])

  useEffect(() => { if (user) router.push('/dashboard') }, [user, router])

  useEffect(() => {
    let cancelled = false
    fetch('/api/market/prices', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.prices) setPrices(d.prices) })
      .catch(() => {})
    const id = setInterval(() => {
      fetch('/api/market/tick', { method: 'POST' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled && d?.prices) setPrices(d.prices) })
        .catch(() => {})
    }, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    fetch('/api/stats', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])

  // ── Focus/highlight the sign-up form ──
  const focusEmailForm = (e) => {
    e?.preventDefault()
    // Scroll so the form is comfortably visible near the top (with nav offset accounted for)
    const el = document.getElementById('hero-form')
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
    setFormHighlight(true)
    setTimeout(() => {
      emailRef.current?.focus()
      setTimeout(() => setFormHighlight(false), 1200)
    }, 350)
  }

  // ── Auth handlers ──
  const handleRegisterStep1 = (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Enter a valid email address.'); return }
    setError(''); setStep(2)
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError(''); setSubmitting(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 90000)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Registration failed.'); return }
      setUser(data.user)
      router.push('/markets')
    } catch (err) {
      clearTimeout(t)
      setError(err?.name === 'AbortError' ? 'Server is waking up — please try again in a moment.' : 'Network error. Check your connection.')
    } finally { setSubmitting(false) }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError(''); setLoginSubmitting(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 90000)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setLoginError(data.error || 'Login failed.'); return }
      setUser(data.user)
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(t)
      setLoginError(err?.name === 'AbortError' ? 'Server timeout — try again.' : 'Network error.')
    } finally { setLoginSubmitting(false) }
  }

  const openTawk = () => {
    if (typeof window === 'undefined') return
    let attempts = 0
    const tryOpen = () => {
      if (window.Tawk_API?.maximize) { window.Tawk_API.maximize() }
      else if (attempts < 10) { attempts++; setTimeout(tryOpen, 400) }
    }
    tryOpen()
  }

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground/40 text-sm">Loading…</div>
    </div>
  )

  if (user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground/40 text-sm">Redirecting…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Live ticker ── */}
      <div className="bg-background/90 border-b border-border/50 h-9 flex items-center overflow-hidden relative">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 border-r border-border/50 h-full bg-background z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 text-[11px] font-semibold whitespace-nowrap">Live</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex w-max" style={{ animation: 'ticker 40s linear infinite' }}>
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="flex items-center gap-2 text-xs whitespace-nowrap px-4">
                <span className="text-white/40 font-medium">{item.symbol}</span>
                <span className="text-white/80 font-mono tabular-nums">{item.price}</span>
                <span className={`font-semibold ${item.up ? 'text-emerald-400' : 'text-red-400'}`}>{item.change}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                <span className="text-white font-black text-lg leading-none">K</span>
              </div>
              <span className="text-lg font-bold">Kartomtrades</span>
            </div>
            <div className="hidden lg:flex items-center gap-8">
              <Link href="/markets" className="text-white/50 hover:text-white transition-colors text-sm">Markets</Link>
              <a href="#features"  className="text-white/50 hover:text-white transition-colors text-sm">Features</a>
              <a href="#accounts"  className="text-white/50 hover:text-white transition-colors text-sm">Accounts</a>
              <a href="#cta"       className="text-white/50 hover:text-white transition-colors text-sm">About</a>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <button onClick={() => setShowLogin(true)} className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-2">Log In</button>
              <button onClick={focusEmailForm} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                Start Free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button className="lg:hidden text-white/60" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="lg:hidden bg-background border-t border-border/50 px-4 py-4 space-y-3">
            <Link href="/markets" className="block text-white/60 hover:text-white text-sm py-1">Markets</Link>
            <a href="#features" className="block text-white/60 hover:text-white text-sm py-1">Features</a>
            <a href="#accounts" className="block text-white/60 hover:text-white text-sm py-1">Accounts</a>
            <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
              <button onClick={() => { setShowLogin(true); setMobileMenu(false) }} className="w-full text-center text-white/60 hover:text-white text-sm py-2 border border-border/50 rounded-lg">Log In</button>
              <button onClick={(e) => { setMobileMenu(false); setTimeout(() => focusEmailForm(e), 300) }} className="w-full text-center block bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2 rounded-lg">Start Free</button>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-20 lg:pb-28">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
            <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[80px]" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Platform Online · {stats.uptime ?? 99}% uptime
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06]">
                  Trade smarter.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400">
                    Risk nothing.
                  </span>
                </h1>
                <p className="mt-5 text-base md:text-lg text-white/50 max-w-lg leading-relaxed">
                  Institutional-grade terminal for Forex, Crypto, Stocks, Indices &amp; Commodities.
                  Start with <span className="text-white font-semibold">$100,000 demo funds</span> — no card, no deposit.
                </p>

                {/* Social proof */}
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    { icon: <Users className="w-3.5 h-3.5 text-emerald-400" />, value: stats.accounts || 0, prefix: '', suffix: ' accounts' },
                    { icon: <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />, value: (stats.totalVolume || 0) / 1_000_000, prefix: '$', suffix: 'M traded', decimals: 1 },
                    { icon: <Copy className="w-3.5 h-3.5 text-purple-400" />, value: stats.trades || 0, prefix: '', suffix: ' trades' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm text-white/40">
                      {s.icon}
                      <span className="text-white font-semibold tabular-nums">
                        <AnimatedCounter target={s.value} prefix={s.prefix} decimals={s.decimals || 0} />
                      </span>
                      <span>{s.suffix}</span>
                    </div>
                  ))}
                </div>

                {/* Inline register form */}
                <div id="hero-form" className={`mt-10 max-w-sm transition-all duration-300 ${formHighlight ? 'ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-background rounded-xl p-3 -mx-3' : ''}`}>
                  {step === 1 ? (
                    <form onSubmit={handleRegisterStep1} className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          ref={emailRef}
                          type="email" required placeholder="your@email.com"
                          value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                          className="flex-1 h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                        />
                        <button type="submit" className="flex-shrink-0 h-11 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-1.5">
                          Start <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                      {error && <p className="text-red-400 text-xs">{error}</p>}
                      <p className="text-white/25 text-xs">Free forever. No credit card. $100k demo instant.</p>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
                      <div className="text-xs text-white/40 flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">✓</span>
                        {email}
                        <button type="button" onClick={() => setStep(1)} className="text-white/30 hover:text-white/60 ml-auto text-xs underline">change</button>
                      </div>
                      <input
                        type="text" placeholder="First name (optional)"
                        value={firstName} onChange={e => setFirstName(e.target.value)}
                        className="h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                      />
                      <input
                        type="password" required minLength={8} placeholder="Password (min 8 characters)"
                        value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                        className="h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                      />
                      {error && <p className="text-red-400 text-xs">{error}</p>}
                      <button type="submit" disabled={submitting}
                        className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating account…</>
                        ) : <>Create Account &amp; Trade Now <ArrowRight className="w-4 h-4" /></>}
                      </button>
                      <p className="text-white/20 text-xs text-center">By signing up you agree to our terms &amp; risk disclosure.</p>
                    </form>
                  )}
                  <p className="mt-3 text-xs text-white/25">
                    Already have an account?{' '}
                    <button onClick={() => setShowLogin(true)} className="text-emerald-400 hover:text-emerald-300 underline">Log in</button>
                  </p>
                </div>
              </div>

              {/* Right: live terminal card */}
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 blur-2xl" />
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d1117]/80 backdrop-blur overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                      </div>
                      <span className="text-xs text-white/30 ml-1">Portfolio · Demo Account</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                      <Activity className="w-3 h-3" /> Live
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <EquityCurve animate />
                  </div>
                  <div className="px-4 pb-4">
                    <div className="text-[10px] text-white/25 font-semibold uppercase tracking-wider mb-2">Open Positions</div>
                    <div className="space-y-1.5">
                      {livePositions.map((pos) => {
                        const hasPnl = pos.pnl !== null
                        const up = pos.pnl >= 0
                        return (
                          <div key={pos.symbol} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${pos.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                {pos.side}
                              </span>
                              <div>
                                <div className="text-xs font-semibold text-white">{pos.symbol}</div>
                                <div className="text-[10px] text-white/30">{pos.lots} lots</div>
                              </div>
                            </div>
                            <div className={`text-xs font-bold tabular-nums ${hasPnl ? (up ? 'text-emerald-400' : 'text-red-400') : 'text-white/20'}`}>
                              {hasPnl ? `${up ? '+' : ''}$${Math.abs(pos.pnl).toFixed(2)}` : '--'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    <button onClick={focusEmailForm}
                      className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
                      ▲ Buy
                    </button>
                    <button onClick={focusEmailForm}
                      className="h-9 rounded-xl border border-red-500/20 bg-red-500/8 text-red-300 text-xs font-semibold hover:bg-red-500/15 transition-colors">
                      ▼ Sell
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Markets strip ── */}
        <section className="py-16 border-t border-border/50 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">Live Markets</div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">One platform. Every market.</h2>
              </div>
              <Link href="/markets" className="hidden sm:flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { symbol: 'XAUUSD', name: 'Gold',       icon: '🥇' },
                { symbol: 'BTCUSD', name: 'Bitcoin',    icon: '₿'  },
                { symbol: 'US100',  name: 'Nasdaq 100', icon: '📈' },
                { symbol: 'EURUSD', name: 'EUR/USD',    icon: '💱' },
              ].map(({ symbol, name, icon }) => {
                const q   = prices[symbol]
                const mid  = q ? Number(q.mid)  : null
                const high = q ? Number(q.high) : null
                const pct  = (mid && high && high > 0) ? ((mid - high) / high * 100) : null
                const up   = pct == null || pct >= 0
                return (
                  <button key={symbol}
                    onClick={focusEmailForm}
                    className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] p-4 text-left transition-all hover:border-emerald-500/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{icon}</span>
                      {pct != null && (
                        <span className={`text-[11px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 mb-0.5">{symbol}</div>
                    <div className="text-white font-bold text-sm">{name}</div>
                    <div className="text-white/60 text-sm font-mono tabular-nums mt-1">
                      {mid ? formatTickerPrice(mid, symbol) : '--'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Why Kartomtrades</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for calm, confident execution</h2>
              <p className="mt-3 text-white/40 text-base">Everything a serious trader needs. Nothing you don't.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { Icon: Zap,       title: 'Real-Time Prices',    desc: 'Bid/ask quotes update every 2 seconds across all instruments.', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
                { Icon: LineChart, title: 'TradingView Charts',  desc: 'Full-featured interactive charts with all timeframes and drawing tools.', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                { Icon: Copy,      title: 'Copy Trading',        desc: 'Follow expert traders and automatically mirror their positions.', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
                { Icon: Lock,      title: 'TP / SL Controls',   desc: 'Take profit and stop loss on every position. Protect your capital.', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { Icon: Globe2,    title: '40+ Instruments',     desc: 'Forex, Crypto, Stocks, Indices, and Commodities under one roof.', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
                { Icon: Activity,  title: 'AI Trade Coach',      desc: 'Get a grade and feedback on every closed trade to sharpen your edge.', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              ].map(({ Icon, title, desc, color }) => (
                <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-colors">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-white font-semibold mb-1.5">{title}</div>
                  <div className="text-white/40 text-sm leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Accounts ── */}
        <section id="accounts" className="py-20 border-t border-border/50 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Dual Account System</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Practice first. Go live when ready.</h2>
              <p className="mt-3 text-white/40 text-base">Two wallets, same terminal. Demo for skill-building. Real account for live P&amp;L.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Demo Account</div>
                    <div className="text-white/30 text-xs">Practice with virtual funds</div>
                  </div>
                </div>
                <div className="text-4xl font-extrabold text-white mb-1 tabular-nums">$100,000</div>
                <div className="text-white/30 text-sm mb-5">Instant. No deposit. Free forever.</div>
                <ul className="space-y-2.5 text-sm">
                  {['Realistic market simulation', 'Reset funds anytime', 'Full access to all tools'].map(t => (
                    <li key={t} className="flex items-center gap-2 text-white/50">
                      <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Real Account</div>
                    <div className="text-white/30 text-xs">Live trading after KYC</div>
                  </div>
                </div>
                <div className="text-4xl font-extrabold text-white mb-1">Your Funds</div>
                <div className="text-white/30 text-sm mb-5">Deposit after verification. Same terminal.</div>
                <ul className="space-y-2.5 text-sm">
                  {['Fast crypto deposits (BTC/USDT)', 'Admin review workflow', 'Real P&L, real withdrawals'].map(t => (
                    <li key={t} className="flex items-center gap-2 text-white/50">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="cta" className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-10 md:p-16">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">Ready to start trading?</h2>
              <p className="text-white/40 text-base md:text-lg mb-10 max-w-xl mx-auto">
                Create your free account in 30 seconds. $100,000 demo balance, no credit card, no commitment.
              </p>
              <form onSubmit={step === 1 ? handleRegisterStep1 : handleRegisterSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                <input type="email" required placeholder="your@email.com"
                  value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                  className="flex-1 h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60"
                />
                <button type="submit"
                  className="h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors shadow-[0_0_24px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 flex-shrink-0">
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>
              </form>
              <p className="text-white/20 text-xs mt-4">No spam. Unsubscribe any time.</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg leading-none">K</span>
                </div>
                <span className="text-lg font-bold">Kartomtrades</span>
              </div>
              <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                Professional-grade simulated trading platform for education and practice. Not a licensed financial advisor.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-3">Platform</div>
                <div className="space-y-2">
                  <Link href="/markets"                className="block text-white/40 hover:text-white text-xs transition-colors">Markets</Link>
                  <button onClick={() => setShowLogin(true)} className="block text-white/40 hover:text-white text-xs transition-colors">Log In</button>
                  <button onClick={focusEmailForm} className="block text-white/40 hover:text-white text-xs transition-colors">Register</button>
                </div>
              </div>
              <div>
                <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-3">Legal</div>
                <div className="space-y-2 text-white/25 text-xs">
                  <div>Risk Disclosure</div>
                  <div>Privacy Policy</div>
                  <div>Terms of Service</div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6">
            <p className="text-white/20 text-xs leading-relaxed max-w-4xl">
              <span className="text-white/40 font-semibold">Risk Warning:</span> 76% of retail investor accounts lose money when trading CFDs.
              You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.
              This platform is for educational and simulation purposes only. Past performance is not a reliable indicator of future results.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Floating support ── */}
      <button onClick={openTawk}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full px-4 py-3 shadow-[0_4px_24px_rgba(16,185,129,0.4)] transition-colors">
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Live Support</span>
      </button>

      {/* ── Login modal ── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-2xl">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-white/30 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm leading-none">K</span>
              </div>
              <span className="text-white font-bold">Welcome back</span>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/30 block mb-1.5">Email</label>
                <input type="email" required placeholder="you@example.com"
                  value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError('') }}
                  className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1.5">Password</label>
                <input type="password" required placeholder="••••••••"
                  value={loginPassword} onChange={e => { setLoginPassword(e.target.value); setLoginError('') }}
                  className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              {loginError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loginError}</p>}
              <button type="submit" disabled={loginSubmitting}
                className="h-11 mt-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                {loginSubmitting
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Signing in…</>
                  : 'Sign In'
                }
              </button>
            </form>
            <p className="text-center text-xs text-white/25 mt-4">
              No account?{' '}
              <button onClick={(e) => { setShowLogin(false); setTimeout(() => focusEmailForm(e), 200) }}
                className="text-emerald-400 hover:text-emerald-300 underline">Create one free</button>
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
