'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Menu, X, ArrowRight, MessageCircle, Shield, Zap, LineChart,
  CheckCircle, Lock, Globe2, Gamepad2, DollarSign, Activity,
  Copy, ChevronRight, BookOpen, UserCheck, TrendingUp,
  RefreshCw, Star, Wallet, Coins, ArrowDownUp, Send, ArrowDownToLine, History,
  Bot, Gift, Bell, Sparkles, PiggyBank, CreditCard, ArrowUpFromLine, Users, Layers, Trophy
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
            <stop offset="0%" stopColor="#F0B90B" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F0B90B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#curveGrad)" />
        <path d={linePath} fill="none" stroke="#F0B90B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.length > 0 && (
          <g>
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="5" fill="#F0B90B" opacity="0.3" />
            <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill="#F0B90B" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ─── FAQ content ─────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Is the account free?',
    a: 'Yes. Your account is completely free with a multi-asset crypto wallet. You also get $100,000 in virtual funds for optional trading practice. No payment, no card, no time limit.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. You can create an account and start using your wallet immediately with no card required. A deposit is only needed if you choose to fund your wallet with real crypto or open a live trading account.',
  },
  {
    q: 'How does the live account work?',
    a: 'To open a live account for trading, you need to complete identity verification (KYC) and make a deposit. Live accounts use real funds, with real profit and loss. Withdrawals go through an admin review workflow.',
  },
  {
    q: 'What markets can I trade?',
    a: 'Vaultquokka gives you optional access to Forex pairs, cryptocurrencies, equities, stock indices, and commodities — all from a single account.',
  },
  {
    q: 'How does the crypto wallet work?',
    a: 'Your spot wallet holds real per-coin balances (BTC, ETH, USDT, BNB, SOL, XRP and more), each valued live in USD. You can Convert between coins at market rates, Send funds to other users by email, Receive on the correct network, and review everything in a unified transaction history.',
  },
  {
    q: 'How does copy trading work?',
    a: 'Copy trading lets you follow other traders on the platform and automatically mirror their positions in your account. You control the allocation and can stop copying at any time.',
  },
  {
    q: 'What is AI Trade Coach?',
    a: 'After each closed trade, the AI Trade Coach reviews your entry, exit, and risk management decisions, then gives you a score and specific feedback to help you improve over time.',
  },
  {
    q: 'Do I need verification before trading live?',
    a: 'Yes. Identity verification (KYC) is required before you can fund your wallet with real crypto or trade a live account. This is a mandatory step to protect all users on the platform. The wallet and demo trading do not require any verification.',
  },
  {
    q: 'Is this platform suitable for beginners?',
    a: 'Yes. The account is designed for users who want to build confidence with both wallet management and trading. You can use your wallet and trade in live market conditions without financial risk using virtual funds.',
  },
]

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

  const [user, setUser]                       = useState(null)
  const [authLoading, setAuthLoading]         = useState(true)
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [firstName, setFirstName]             = useState('')
  const [step, setStep]                       = useState(1)
  const [error, setError]                     = useState('')
  const [submitting, setSubmitting]           = useState(false)
  const [prices, setPrices]                   = useState({})
  const [mobileMenu, setMobileMenu]           = useState(false)
  const [formHighlight, setFormHighlight]     = useState(false)
  const [registered, setRegistered]           = useState(false)
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

  // ── Focus/highlight the sign-up form ──
  const focusEmailForm = (e) => {
    e?.preventDefault()
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
      setRegistered(true)
    } catch (err) {
      clearTimeout(t)
      setError(err?.name === 'AbortError' ? 'Server is waking up — please try again in a moment.' : 'Network error. Check your connection.')
    } finally { setSubmitting(false) }
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
          <span className="relative flex h-2 w-2" aria-hidden="true">
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
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg leading-none">V</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Vaultquokka</span>
            </div>
            <div className="hidden lg:flex items-center gap-7">
              <a href="#overview"     className="text-white/50 hover:text-white transition-colors text-sm">Overview</a>
              <a href="#wallet"       className="text-white/50 hover:text-white transition-colors text-sm">Wallet</a>
              <a href="#trade"        className="text-white/50 hover:text-white transition-colors text-sm">Trade</a>
              <a href="#earn"         className="text-white/50 hover:text-white transition-colors text-sm">Earn</a>
              <Link href="/markets"   className="text-white/50 hover:text-white transition-colors text-sm">Markets</Link>
              <a href="#faq"          className="text-white/50 hover:text-white transition-colors text-sm">FAQ</a>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/login"
                className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-2"
              >Log in</Link>
              <button
                onClick={focusEmailForm}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >Start <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            <button
              className="lg:hidden text-white/60"
              aria-label={mobileMenu ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="lg:hidden bg-background border-t border-border/50 px-4 py-4 space-y-2">
            <a href="#overview"     className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Overview</a>
            <a href="#wallet"       className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Wallet</a>
            <a href="#trade"        className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Trade</a>
            <a href="#earn"         className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Earn</a>
            <Link href="/markets"   className="block text-white/60 hover:text-white text-sm py-1.5">Markets</Link>
            <a href="#faq"          className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>FAQ</a>
            <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full text-center block text-white/60 hover:text-white text-sm py-2 border border-border/50 rounded-lg"
              >Log in</Link>
              <Link
                href="/register"
                className="w-full text-center block bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                onClick={() => setMobileMenu(false)}
              >Start</Link>
            </div>
          </div>
        )}
      </nav>

      <main>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-emerald-500/[0.06] rounded-full blur-[130px]" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: copy + form */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold bg-white/[0.05] text-white/55 border border-white/[0.09] rounded-full px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                    Vaultquokka
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/[0.05] text-white/40 border border-white/[0.09] rounded-full px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" aria-hidden="true" />
                    No card required
                  </div>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.08]">
                  Your multi-asset{' '}
                  <br className="hidden sm:block" />
                  <span className="text-emerald-400">crypto wallet</span>
                </h1>
                <p className="mt-5 text-base md:text-lg text-white/50 max-w-lg leading-relaxed">
                  Hold, <span className="text-white font-semibold">Convert, Send &amp; Receive</span> crypto &mdash;
                  with optional trading access to Forex, Crypto, Stocks, Indices, and Commodities in live market conditions.
                  One account for everything.
                </p>

                {/* Primary + secondary CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={focusEmailForm}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors shadow-[0_2px_16px_rgba(16,185,129,0.22)]"
                  >
                    Start <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <a
                    href="#how-it-works"
                    className="flex items-center gap-1.5 text-white/55 hover:text-white text-sm font-medium transition-colors"
                  >
                    See how it works <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                </div>

                {/* Trust microcopy */}
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {['Multi-asset wallet', 'Convert · Send · Receive', 'Live market trading'].map((item) => (
                    <span key={item} className="flex items-center gap-1.5 text-[12px] text-white/35">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500/60 flex-shrink-0" aria-hidden="true" />
                      {item}
                    </span>
                  ))}
                </div>

                {/* Sign-up form */}
                <div
                  id="hero-form"
                  className={`mt-10 max-w-sm transition-all duration-300 ${formHighlight ? 'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background rounded-xl p-3 -mx-3' : ''}`}
                >
                  {registered ? (
                    /* Success state */
                    <div className="text-center py-6">
                      <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-500/10">
                        <CheckCircle className="h-10 w-10 text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-extrabold text-white mb-2">Account Created!</h2>
                      <p className="text-emerald-400 font-semibold text-xs mb-5 uppercase tracking-wide">
                        One last step
                      </p>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5 mb-5 text-left">
                        <p className="text-white/70 text-sm mb-4 text-center">
                          We sent a verification link to<br />
                          <span className="text-white font-bold text-base">{email}</span>
                        </p>
                        <div className="border-t border-white/[0.08] pt-4">
                          <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3 text-center">What to do next</h3>
                          <ol className="text-white/50 text-sm space-y-3 list-decimal list-inside">
                            <li>Open your email inbox</li>
                            <li>Find the email from <strong className="text-emerald-400">Vaultquokka</strong></li>
                            <li>Click the <strong className="text-emerald-400">Verify Email</strong> button</li>
                            <li>Return here and log in</li>
                          </ol>
                        </div>
                      </div>
                      <p className="text-white/30 text-xs mb-4">
                        Did not receive it? Check spam or{' '}
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/auth/resend-verification', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email })
                              })
                              alert('Verification email resent!')
                            } catch {
                              alert('Failed to resend. Please try again.')
                            }
                          }}
                          className="text-emerald-400 hover:text-emerald-300 underline"
                        >
                          resend it
                        </button>
                      </p>
                      <Link href="/login">
                        <button className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors">
                          Go to Login
                        </button>
                      </Link>
                    </div>
                  ) : step === 1 ? (
                    <form onSubmit={handleRegisterStep1} className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          ref={emailRef}
                          type="email"
                          required
                          placeholder="your@email.com"
                          autoComplete="email"
                          value={email}
                          onChange={e => { setEmail(e.target.value); setError('') }}
                          className="flex-1 h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                        />
                        <button
                          type="submit"
                          className="flex-shrink-0 h-11 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors flex items-center gap-1.5"
                        >
                          Start <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      {error && <p className="text-red-400 text-xs">{error}</p>}
                      <p className="text-white/25 text-xs">Free account with wallet. No card. $100,000 virtual balance for optional trading.</p>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
                      <div className="text-xs text-white/40 flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]" aria-hidden="true">&#10003;</span>
                        {email}
                        <button type="button" onClick={() => setStep(1)} className="text-white/30 hover:text-white/60 ml-auto text-xs underline">change</button>
                      </div>
                      <input
                        type="text"
                        placeholder="First name (optional)"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        className="h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                      />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Password (min 8 characters)"
                        autoComplete="new-password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        className="h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                      />
                      {error && <p className="text-red-400 text-xs">{error}</p>}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" /> Creating your account&hellip;</>
                        ) : <>Create account <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                      </button>
                      <p className="text-white/20 text-xs text-center">By registering you agree to our{' '}<Link href="/terms" className="underline hover:text-white/40">Terms of Service</Link>{' '}and{' '}<Link href="/risk-disclosure" className="underline hover:text-white/40">Risk Disclosure</Link>.</p>
                    </form>
                  )}
                  {!registered && (
                    <p className="mt-3 text-xs text-white/25">
                      Already have an account?{' '}
                      <Link href="/login" className="text-emerald-400 hover:text-emerald-300 underline">Log in</Link>
                    </p>
                  )}
                </div>
              </div>

              {/* Right: live portfolio terminal */}
              <div className="relative">
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d1117]/80 backdrop-blur overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5" aria-hidden="true">
                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                      </div>
                      <span className="text-xs text-white/30 ml-1">Portfolio &middot; Virtual Account</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                      <Activity className="w-3 h-3" aria-hidden="true" /> Live
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
                    <button onClick={focusEmailForm} className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
                      &#9650; Buy
                    </button>
                    <button onClick={focusEmailForm} className="h-9 rounded-xl border border-red-500/20 bg-red-500/[0.08] text-red-300 text-xs font-semibold hover:bg-red-500/15 transition-colors">
                      &#9660; Sell
                    </button>
                  </div>
                </div>
                <p className="text-center text-[11px] text-white/20 mt-3">Virtual account &mdash; no real funds at risk</p>
              </div>

            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ── */}
        <section className="border-y border-border/40 bg-white/[0.015] py-5" aria-label="Platform trust signals">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 items-center">
              {[
                { icon: <Wallet      className="w-4 h-4" aria-hidden="true" />,  label: 'Multi-asset spot wallet' },
                { icon: <ArrowDownUp className="w-4 h-4" aria-hidden="true" />,  label: 'Instant Convert' },
                { icon: <Send        className="w-4 h-4" aria-hidden="true" />,  label: 'Send & Receive crypto' },
                { icon: <Activity    className="w-4 h-4" aria-hidden="true" />,  label: 'Live market trading' },
                { icon: <LineChart   className="w-4 h-4" aria-hidden="true" />,  label: 'TradingView charts' },
                { icon: <Shield      className="w-4 h-4" aria-hidden="true" />,  label: 'Crypto deposits supported' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-white/40 text-sm">
                  <span className="text-emerald-500/60">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PILLARS ── */}
        <section className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">One hybrid platform</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Hold. Trade. Grow. <span className="text-emerald-400">All in one account.</span></h2>
              <p className="mt-3 text-white/40 text-base">A full multi-asset crypto wallet fused with a complete trading desk &mdash; your funds and your strategies live side by side.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { n: '01', Icon: Wallet,   tag: 'Wallet', title: 'Hold & move crypto',  desc: 'Real multi-asset balances. Convert, send and receive coins instantly with a unified history.', href: '#wallet' },
                { n: '02', Icon: Activity, tag: 'Trade',  title: 'Trade live markets',  desc: 'Trade Forex, crypto, stocks, indices and commodities at live prices with charts, SL/TP and leverage.', href: '#trade' },
                { n: '03', Icon: Zap,      tag: 'Earn',   title: 'Automate & grow',     desc: 'Copy top traders, deploy AI bots, and get AI coaching — put your wallet to work 24/7.', href: '#earn' },
              ].map(({ n, Icon, tag, title, desc, href }) => (
                <a key={n} href={href} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span className="text-2xl font-extrabold text-white/10 group-hover:text-emerald-500/30 transition-colors">{n}</span>
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80 mb-1">{tag}</div>
                  <div className="text-white font-semibold text-lg mb-1.5">{title}</div>
                  <p className="text-white/40 text-sm leading-relaxed mb-3">{desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-white/50 group-hover:text-emerald-300 transition-colors">Explore <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── EVERYTHING IN ONE PLATFORM (full offer overview) ── */}
        <section id="overview" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Everything in one place</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">All your offers, on one screen</h2>
              <p className="mt-3 text-white/40 text-base">From holding crypto to trading live markets and growing your balance &mdash; here&rsquo;s everything the platform does today, plus what&rsquo;s landing next.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  tag: 'Wallet', Icon: Wallet,
                  items: [
                    { Icon: Coins,           label: 'Multi-asset balances' },
                    { Icon: CreditCard,      label: 'Deposit crypto' },
                    { Icon: ArrowUpFromLine, label: 'Withdraw' },
                    { Icon: ArrowDownUp,     label: 'Instant Convert' },
                    { Icon: Send,            label: 'Send to anyone' },
                    { Icon: ArrowDownToLine, label: 'Receive on-chain' },
                    { Icon: History,         label: 'Unified history' },
                  ],
                },
                {
                  tag: 'Trade', Icon: Activity,
                  items: [
                    { Icon: LineChart,  label: 'Live markets & charts' },
                    { Icon: Globe2,     label: 'Forex · Crypto · Stocks' },
                    { Icon: TrendingUp, label: 'Leverage with SL/TP' },
                    { Icon: Gamepad2,   label: 'Virtual & Real accounts' },
                    { Icon: BookOpen,   label: 'Trading journal' },
                    { Icon: Activity,   label: 'Performance analytics' },
                  ],
                },
                {
                  tag: 'Earn', Icon: Sparkles,
                  items: [
                    { Icon: Bot,       label: 'AI trading bots' },
                    { Icon: Users,     label: 'Copy trading' },
                    { Icon: PiggyBank, label: 'Simple Earn', soon: true },
                    { Icon: Lock,      label: 'Staking', soon: true },
                    { Icon: Layers,    label: 'Savings vaults', soon: true },
                    { Icon: Zap,       label: 'Launchpad', soon: true },
                  ],
                },
                {
                  tag: 'Rewards & more', Icon: Gift,
                  items: [
                    { Icon: Trophy,    label: 'Leaderboard' },
                    { Icon: Gift,      label: 'Referral program' },
                    { Icon: Bell,      label: 'Price alerts' },
                    { Icon: Shield,    label: 'KYC & security' },
                    { Icon: MessageCircle, label: '24/7 support' },
                  ],
                },
              ].map(({ tag, Icon, items }) => (
                <div key={tag} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <span className="text-white font-semibold">{tag}</span>
                  </div>
                  <ul className="space-y-2.5">
                    {items.map(({ Icon: ItemIcon, label, soon }) => (
                      <li key={label} className="flex items-center gap-2.5 text-sm text-white/60">
                        <ItemIcon className="w-4 h-4 text-emerald-400/70 flex-shrink-0" aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                        {soon && (
                          <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">Soon</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WALLET (HYBRID) ── */}
        <section id="wallet" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: copy + features */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">01 · Wallet</div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  A real crypto wallet,{' '}
                  <span className="text-emerald-400">built in.</span>
                </h2>
                <p className="mt-4 text-white/45 text-base leading-relaxed max-w-lg">
                  Hold actual balances in BTC, ETH, USDT, BNB, SOL, XRP and more &mdash; not just a single cash
                  balance. Convert between coins at live prices, send to other users instantly, and receive on
                  the right network.
                </p>
                <div className="mt-7 space-y-3 max-w-lg">
                  {[
                    { Icon: Coins,       title: 'Multi-asset balances', desc: 'Real per-coin holdings with live USD valuation and a running portfolio total.' },
                    { Icon: ArrowDownUp, title: 'Instant Convert',      desc: 'Swap any coin to another at live market rates — no order book needed.' },
                    { Icon: Send,        title: 'Send & Receive',       desc: 'Transfer crypto to other users by email, or receive on the correct network.' },
                    { Icon: History,     title: 'Unified history',      desc: 'Deposits, withdrawals, converts and transfers in one activity feed.' },
                  ].map(({ Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="w-9 h-9 flex-shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">{title}</div>
                        <div className="text-white/40 text-sm leading-relaxed">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={focusEmailForm}
                  className="mt-8 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors shadow-[0_2px_16px_rgba(16,185,129,0.22)]"
                >
                  Open your wallet <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Right: wallet card */}
              <div className="relative">
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d1117]/80 backdrop-blur overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                    <span className="text-xs text-white/40 font-semibold">Wallet &middot; Spot</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                      <Activity className="w-3 h-3" aria-hidden="true" /> Live
                    </span>
                  </div>
                  <div className="px-5 py-5">
                    <div className="text-[11px] text-white/40 font-medium mb-1">Estimated Balance</div>
                    <div className="flex items-end gap-2">
                      <div className="text-3xl font-extrabold text-white tabular-nums">$128,640.00</div>
                      <div className="text-xs text-emerald-400 font-bold mb-1">+2.4%</div>
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">&asymp; 1.9210 BTC</div>

                    <div className="mt-5 space-y-2">
                      {[
                        { sym: 'USDT', name: 'TetherUS', amt: '64,320.00',  usd: '$64,320.00', color: 'bg-emerald-500/15 text-emerald-400' },
                        { sym: 'BTC',  name: 'Bitcoin',  amt: '0.78420000', usd: '$52,180.40', color: 'bg-amber-500/15 text-amber-400' },
                        { sym: 'ETH',  name: 'Ethereum', amt: '3.4100',     usd: '$11,705.60', color: 'bg-cyan-500/15 text-cyan-400' },
                      ].map((a) => (
                        <div key={a.sym} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${a.color}`}>{a.sym}</span>
                            <div>
                              <div className="text-xs font-semibold text-white">{a.sym} <span className="text-white/30 font-normal">{a.name}</span></div>
                              <div className="text-[10px] text-white/30 tabular-nums">{a.amt}</div>
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-white tabular-nums">{a.usd}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { Icon: ArrowDownUp,     label: 'Convert' },
                        { Icon: Send,            label: 'Send' },
                        { Icon: ArrowDownToLine, label: 'Receive' },
                      ].map(({ Icon, label }) => (
                        <button key={label} onClick={focusEmailForm} className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] py-2.5 text-[11px] font-semibold text-white/70 transition-colors">
                          <Icon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-center text-[11px] text-white/20 mt-3">Virtual wallet &mdash; seeded with virtual funds</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS SECTION ── */}
        <section className="py-16 border-b border-border/40 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-3 gap-6 md:gap-12 text-center">
              {[
                { value: '7+',     label: 'Coins supported in your spot wallet — BTC, ETH, USDT, BNB, SOL, XRP & more.' },
                { value: '$5.28M', label: '$5.28M currently managed by AI-powered trading bots.' },
                { value: '5,000+', label: '5,000+ users managing their wallet and trades in one place.' },
              ].map(({ value, label }) => (
                <div key={value}>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2 tabular-nums">{value}</div>
                  <p className="text-white/35 text-xs sm:text-sm leading-relaxed max-w-[14rem] mx-auto">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ECOSYSTEM INTEGRATIONS ── */}
        <section className="py-10 border-b border-border/40 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-5 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Ecosystem &amp; Integrations</div>
          </div>
          <div className="relative">
            <div className="flex w-max" style={{ animation: 'ticker 30s linear infinite' }}>
              {[...Array(2)].map((_, r) => (
                ['TradingView', 'OpenAI', 'Bloomberg', 'Coinbase', 'Polygon', 'Kraken', 'CoinGecko', 'MetaMask'].map((name, i) => (
                  <div key={`${r}-${i}`} className="mx-8 flex items-center gap-2 text-white/25 font-semibold text-sm whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-white/15" aria-hidden="true" />
                    {name}
                  </div>
                ))
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-14">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">How it works</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From wallet to trade in three steps</h2>
              <p className="mt-3 text-white/40 text-base">Open an account, fund your wallet, and put your balance to work.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-9 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" aria-hidden="true" />
              {[
                {
                  step: '01',
                  title: 'Create your free account',
                  body: 'Sign up with just an email — no card, no deposit. Your wallet and trading account are ready in seconds with $100,000 in virtual funds.',
                  Icon: UserCheck,
                },
                {
                  step: '02',
                  title: 'Fund your wallet & hold crypto',
                  body: 'Hold real balances across BTC, ETH, USDT and more. Convert between coins at live rates, or send and receive with other users instantly.',
                  Icon: Wallet,
                },
                {
                  step: '03',
                  title: 'Trade markets & put funds to work',
                  body: 'Trade live Forex, crypto, stocks and indices, copy top traders, or deploy AI bots — then go live after verification on the same interface.',
                  Icon: TrendingUp,
                },
              ].map(({ step, title, body, Icon }) => (
                <div key={step} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <span className="text-[11px] font-bold text-white/20 tracking-widest uppercase">Step {step}</span>
                  </div>
                  <h3 className="text-white font-semibold text-base mb-2 leading-snug">{title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRADE PILLAR (MARKETS) ── */}
        <section id="trade" className="py-14 border-b border-border/40 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">02 · Trade</div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Trade every market, straight from your wallet</h2>
                <p className="mt-2 text-white/40 text-sm max-w-lg">Move funds from your spot wallet into live Forex, crypto, stocks, indices and commodities &mdash; one account, one balance.</p>
              </div>
              <Link href="/markets" className="hidden sm:flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
                View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { symbol: 'XAUUSD', name: 'Gold',       cat: 'Commodity' },
                { symbol: 'BTCUSD', name: 'Bitcoin',    cat: 'Crypto'    },
                { symbol: 'US100',  name: 'Nasdaq 100', cat: 'Index'     },
                { symbol: 'EURUSD', name: 'EUR/USD',    cat: 'Forex'     },
              ].map(({ symbol, name, cat }) => {
                const q    = prices[symbol]
                const mid  = q ? Number(q.mid)  : null
                const high = q ? Number(q.high) : null
                const pct  = (mid && high && high > 0) ? ((mid - high) / high * 100) : null
                const up   = pct == null || pct >= 0
                return (
                  <button
                    key={symbol}
                    onClick={focusEmailForm}
                    className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] p-5 text-left transition-all hover:border-white/[0.12]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">{cat}</span>
                      {pct != null && (
                        <span className={`text-[11px] font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="text-white font-bold text-sm mb-0.5">{name}</div>
                    <div className="text-white/40 text-[11px] mb-2">{symbol}</div>
                    <div className="text-white font-mono text-base font-semibold tabular-nums">
                      {mid ? formatTickerPrice(mid, symbol) : '--'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── EARN PILLAR (BOTS) ── */}
        <section id="earn" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-12">
              {/* Left: copy */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  03 · Earn & automate
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Put your wallet to work <br className="hidden sm:block" />
                  <span className="text-emerald-400">24 hours a day, 7 days a week</span>
                </h2>
                <p className="text-white/45 text-base leading-relaxed mb-6 max-w-lg">
                  Grow your balance hands-free: copy top-performing traders, or deploy exclusive AI bots built around
                  a specific pair and risk profile. Set your allocation, activate, and let them run.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-7 max-w-sm">
                  {[
                    { label: 'Select your bot',    sub: 'Pick the risk & pair that suits you' },
                    { label: 'Configure strategy', sub: 'Spot or Futures, conservative to aggressive' },
                    { label: 'Fund your balance',  sub: 'Activate with the minimum deposit' },
                    { label: 'Automated execution', sub: 'Orders fire 24/7 while you sleep' },
                  ].map(({ label, sub }, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-white text-xs font-semibold">{label}</span>
                      </div>
                      <p className="text-white/30 text-[11px] leading-snug">{sub}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors shadow-[0_2px_16px_rgba(16,185,129,0.25)]"
                >
                  Explore AI Bots <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
              {/* Right: top bots preview */}
              <div className="w-full lg:w-[380px] flex-shrink-0 space-y-3">
                {[
                  { emoji: '⚡', name: 'EthBlitz USDT',  risk: 'Low',  pnl: '+273.75', pct: '+23.9%', traders: '2,349+', minDep: '$51',   sparkPositive: true  },
                  { emoji: '🚀', name: 'BnbRocket USDT', risk: 'Mid',  pnl: '+748.57', pct: '+57.1%', traders: '1,733+', minDep: '$1,941', sparkPositive: true  },
                  { emoji: '🛡️', name: 'EthShield DAI',  risk: 'Low',  pnl: '+420.02', pct: '+31.8%', traders: '1,821+', minDep: '$297',  sparkPositive: true  },
                ].map(({ emoji, name, risk, pnl, pct, traders, minDep, sparkPositive }) => {
                  const riskCls = risk === 'Low' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                  return (
                    <div key={name} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 flex items-center gap-3 hover:border-emerald-500/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center text-xl flex-shrink-0">{emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white font-semibold text-sm">{name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${riskCls}`}>{risk}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-emerald-400 font-bold">{pnl}</span>
                          <span className="text-white/30">·</span>
                          <span className="text-emerald-400/80">{pct} / 30d</span>
                          <span className="text-white/25 ml-auto">👥 {traders}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-1.5 w-full h-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                >
                  View all bots <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Platform features</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything from your wallet to the trading desk</h2>
              <p className="mt-3 text-white/40 text-base">Manage real balances and trade live markets — all from one account.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  Icon: Wallet,
                  title: 'Multi-asset spot wallet',
                  desc: 'Hold real balances in BTC, ETH, USDT, BNB, SOL, XRP and more, each valued live in USD with a running portfolio total.',
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                },
                {
                  Icon: ArrowDownUp,
                  title: 'Instant Convert',
                  desc: 'Swap any coin into another at live market rates in one tap — no order book, no spreads to chase.',
                  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                },
                {
                  Icon: Send,
                  title: 'Send & Receive crypto',
                  desc: 'Send funds to another user instantly by email, or receive on the correct network with a per-asset deposit address.',
                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                },
                {
                  Icon: Globe2,
                  title: 'Multi-asset market access',
                  desc: 'Trade Forex pairs, cryptocurrencies, equities, stock indices, and commodities from a single account. Over 40 instruments available across all major sessions.',
                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                },
                {
                  Icon: LineChart,
                  title: 'TradingView charts',
                  desc: 'Full-featured interactive charts with all major timeframes, a complete library of drawing tools, and a broad range of technical indicators.',
                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                },
                {
                  Icon: Lock,
                  title: 'Stop loss and take profit',
                  desc: 'Set a stop loss and take profit level on every position before opening it. Define your maximum loss per trade without relying on manual monitoring.',
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                },
                {
                  Icon: RefreshCw,
                  title: 'Virtual and live account switching',
                  desc: 'Switch between your virtual and live accounts in one click from the same terminal. No separate logins, no separate interfaces to learn.',
                  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                },
                {
                  Icon: Star,
                  title: 'AI trade coach',
                  desc: 'Every closed trade is reviewed automatically. You receive a score and plain-language feedback on your entry, exit, and risk decisions to help you improve.',
                  color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                },
                {
                  Icon: Copy,
                  title: 'Copy trading',
                  desc: 'Follow experienced traders on the platform and automatically mirror their positions. You set the allocation size and can stop copying at any time.',
                  color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                },
                {
                  Icon: Zap,
                  title: 'AI trading bots',
                  desc: 'Deploy exclusive algorithmic bots that trade 24/7 on your behalf. Choose your risk level and trading pair, fund your balance, and let the bot execute automatically.',
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                },
              ].map(({ Icon, title, desc, color }) => (
                <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-white/[0.11] transition-colors">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="text-white font-semibold mb-2">{title}</div>
                  <div className="text-white/40 text-sm leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRODUCT VISUALS ── */}
        <section className="py-20 border-b border-border/40 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Inside the platform</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Your wallet and trading desk, in one app</h2>
              <p className="mt-3 text-white/40 text-base">Manage balances and fire trades from the same place — no configuration needed.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">

              {/* Order ticket mockup */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]/60 overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-white/[0.06]">
                  <span className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">Order Entry</span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Instrument</div>
                    <div className="h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center px-3 gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                      <span className="text-white text-sm font-semibold">XAUUSD</span>
                      <span className="text-white/30 text-xs ml-auto">Gold &middot; Commodity</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Lot size</div>
                      <div className="h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center px-3 text-white text-sm">1.00</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Leverage</div>
                      <div className="h-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center px-3 text-white text-sm">1:100</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Stop loss</div>
                      <div className="h-10 rounded-lg bg-red-500/[0.07] border border-red-500/20 flex items-center px-3 text-red-300 text-sm">2 290.00</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Take profit</div>
                      <div className="h-10 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/20 flex items-center px-3 text-emerald-300 text-sm">2 360.00</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={focusEmailForm} className="h-11 rounded-xl bg-emerald-500 text-white text-sm font-semibold">&#9650; Buy 2 318.40</button>
                    <button onClick={focusEmailForm} className="h-11 rounded-xl bg-red-500/80 text-white text-sm font-semibold">&#9660; Sell 2 317.80</button>
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <p className="text-white/25 text-xs">Virtual account &mdash; virtual funds only</p>
                </div>
              </div>

              {/* AI Trade Coach mockup */}
              <div className="flex flex-col gap-5">
                <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]/60 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">AI Trade Coach</span>
                    <span className="text-[10px] text-white/20">Trade closed</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 font-extrabold text-xl">B+</span>
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">EURUSD &middot; Sell &middot; 2 lots</div>
                      <div className="text-emerald-400 text-sm font-semibold">+$284.00</div>
                      <div className="text-white/30 text-xs">Closed at 1.0847</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Entry timing', score: 82, color: 'bg-emerald-500' },
                      { label: 'Risk management', score: 75, color: 'bg-amber-400' },
                      { label: 'Exit discipline', score: 68, color: 'bg-amber-400' },
                    ].map(({ label, score, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-white/35 text-xs w-32 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className="text-white/40 text-xs w-7 text-right">{score}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/30 text-xs mt-4 leading-relaxed">
                    Good entry on the downtrend. Consider tightening the stop loss to reduce drawdown on future similar setups.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]/60 p-5">
                  <div className="text-[10px] text-white/25 font-semibold uppercase tracking-widest mb-3">Account Overview</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Balance',  value: '$100,284.00', color: 'text-white' },
                      { label: 'Equity',   value: '$100,411.50', color: 'text-emerald-400' },
                      { label: 'Open P&L', value: '+$127.50',    color: 'text-emerald-400' },
                      { label: 'Account',  value: 'Virtual',     color: 'text-amber-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
                        <div className="text-[10px] text-white/25 mb-1">{label}</div>
                        <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── ACCOUNTS COMPARISON ── */}
        <section id="accounts" className="py-20 border-b border-border/40 bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">

            {/* Bonus promo banner */}
            <div className="mb-10 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.10] to-emerald-600/[0.04] px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-300 font-extrabold text-xl leading-none">2×</span>
                </div>
                <div>
                  <div className="text-white font-bold text-lg leading-snug">100% bonus on your first deposit</div>
                  <div className="text-white/45 text-sm mt-0.5">Deposit any amount &mdash; we match it. Deposit $500, fund your wallet with $1,000.</div>
                </div>
              </div>
              <button
                onClick={focusEmailForm}
                className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >Claim bonus <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Account types</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Start on virtual. Go live when you are ready.</h2>
              <p className="mt-3 text-white/40 text-base">
                Virtual and live accounts share the same wallet + trading interface. The difference is what is at stake.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-2xl">

              {/* Virtual account */}
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-amber-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Virtual account</div>
                    <div className="text-white/30 text-xs">Start immediately &mdash; no deposit</div>
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white mb-1 tabular-nums">$100,000</div>
                <div className="text-white/30 text-sm mb-6">Virtual funds, loaded instantly</div>
                <ul className="space-y-3">
                  {[
                    'No credit card or deposit required',
                    'Hold, convert, send & receive crypto',
                    'Trade at real live market prices',
                    'Full access to wallet + trading tools',
                    'Switch to a live account when ready',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-white/55">
                      <CheckCircle className="w-4 h-4 text-amber-400/80 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={focusEmailForm}
                  className="mt-7 w-full h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm font-semibold hover:bg-amber-500/25 transition-colors"
                >
                  Open virtual account
                </button>
              </div>

              {/* Live account */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Live account</div>
                    <div className="text-white/30 text-xs">Available after identity verification</div>
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white mb-1">Real funds</div>
                <div className="text-white/30 text-sm mb-3">Deposit after KYC approval</div>
                <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5">
                  <span className="text-emerald-400 text-lg font-black leading-none">2×</span>
                  <div>
                    <div className="text-emerald-300 text-sm font-semibold">100% first deposit bonus</div>
                    <div className="text-white/30 text-xs">Deposit $500, trade with $1,000</div>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'Identity verification (KYC) required',
                    'Deposit via crypto (BTC / USDT)',
                    'Real profit and loss on every trade',
                    'Withdrawal subject to admin review',
                    'Same terminal as your virtual account',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-white/55">
                      <CheckCircle className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={focusEmailForm}
                  className="mt-7 w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
                >
                  Start with a virtual account first
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* ── CREDIBILITY / TRANSPARENCY ── */}
        <section className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">About the platform</div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                  A wallet and a trading desk, working together
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-5">
                  Vaultquokka pairs a powerful multi-asset crypto wallet &mdash; hold, convert, send and receive
                  crypto &mdash; with a full trading platform connected to live market data, in a single account.
                </p>
                <p className="text-white/40 text-sm leading-relaxed mb-5">
                  The platform is designed for users who want to build genuine skills with wallet management and trading before committing real capital.
                  Whether you are completely new to crypto or returning after a break, the virtual environment gives you a realistic
                  space to practice without financial pressure.
                </p>
                <p className="text-white/40 text-sm leading-relaxed">
                  Live trading is available after completing identity verification. This step exists to protect all users.
                  Deposits and withdrawals are processed in cryptocurrency.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    title: 'What is Vaultquokka?',
                    body: 'A multi-asset crypto wallet with optional trading access. You can hold, convert, send and receive crypto, and optionally trade across multiple asset classes in a realistic environment before deciding whether to open a live account.',
                  },
                  {
                    title: 'Who is it for?',
                    body: 'Beginner and intermediate users who want to build confidence with wallet management and trading before risking real money. Also suitable for experienced users who want to test new strategies without financial risk.',
                  },
                  {
                    title: 'What does "virtual-first" mean?',
                    body: 'Every account starts as a virtual account with $100,000 in virtual funds. You are never required to deposit. Moving to a live account is a separate, voluntary step.',
                  },
                  {
                    title: 'What requires verification?',
                    body: 'Identity verification (KYC) is required only before opening a live account or making a deposit. The virtual account can be used indefinitely without any verification.',
                  },
                ].map(({ title, body }) => (
                  <div key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                    <div className="text-white font-medium text-sm mb-1.5">{title}</div>
                    <div className="text-white/40 text-sm leading-relaxed">{body}</div>
                  </div>
                ))}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-400/60 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-white/50 text-sm">Questions? Our support team is here.</div>
                    <button onClick={openTawk} className="text-emerald-400 text-xs hover:text-emerald-300 underline transition-colors">Open live chat</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-20 border-b border-border/40 bg-white/[0.015]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">FAQ</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Common questions</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 data-[state=open]:border-white/[0.11] transition-colors"
                >
                  <AccordionTrigger className="text-white/80 hover:text-white hover:no-underline text-sm font-medium py-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/45 text-sm leading-relaxed pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section id="cta" className="py-24">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-10 md:p-14">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
                Your wallet and trading, in one account
              </h2>
              <p className="text-white/45 text-base mb-2">
                $100,000 in virtual funds. No card required. Instant access.
              </p>
              <p className="text-white/25 text-sm mb-8">
                Hold crypto, convert, send &amp; receive, and trade live markets &mdash; all in one place.
              </p>
              <form
                onSubmit={step === 1 ? handleRegisterStep1 : handleRegisterSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto"
              >
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  className="flex-1 h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60"
                />
                <button
                  type="submit"
                  className="h-12 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 flex-shrink-0"
                >
                  Get started <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
              {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
              <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
                {['No card required', 'Instant virtual account', 'Live market environment'].map(item => (
                  <span key={item} className="flex items-center gap-1.5 text-[12px] text-white/30">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/50 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg leading-none">V</span>
                </div>
                <span className="text-lg font-bold">Vaultquokka</span>
              </div>
              <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                A hybrid crypto wallet and trading platform. Hold, convert, send and receive crypto, and trade live
                markets &mdash; using virtual funds unless you open a live account after completing identity verification.
              </p>
            </div>
            <div>
              <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-4">Platform</div>
              <div className="space-y-2.5">
                <a href="#wallet"                          className="block text-white/40 hover:text-white text-xs transition-colors">Wallet</a>
                <a href="#trade"                           className="block text-white/40 hover:text-white text-xs transition-colors">Trade</a>
                <a href="#earn"                            className="block text-white/40 hover:text-white text-xs transition-colors">Earn</a>
                <Link href="/markets"                      className="block text-white/40 hover:text-white text-xs transition-colors">Markets</Link>
                <a href="#faq"                             className="block text-white/40 hover:text-white text-xs transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-4">Legal</div>
              <div className="space-y-2.5">
                <Link href="/risk-disclosure"  className="block text-white/40 hover:text-white text-xs transition-colors">Risk Disclosure</Link>
                <Link href="/privacy-policy"   className="block text-white/40 hover:text-white text-xs transition-colors">Privacy Policy</Link>
                <Link href="/terms"            className="block text-white/40 hover:text-white text-xs transition-colors">Terms of Service</Link>
                <button onClick={openTawk} className="block text-white/40 hover:text-white text-xs transition-colors text-left">Support / Contact</button>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 space-y-3">
            <p className="text-white/20 text-xs leading-relaxed max-w-4xl">
              <span className="text-white/35 font-semibold">Risk Warning:</span>{' '}
              Trading financial instruments involves significant risk and may not be suitable for all investors.
              A large proportion of retail investor accounts lose money when trading leveraged products.
              You should carefully consider whether trading is appropriate for you in light of your financial situation, experience, and risk tolerance.
            </p>
            <p className="text-white/15 text-xs leading-relaxed max-w-4xl">
              Vaultquokka is a simulation platform intended for educational and simulated trading purposes.
              Virtual trading does not guarantee equivalent results in live markets.
              Past performance of any trading strategy or instrument is not a reliable indicator of future results.
              This platform does not provide financial advice.
            </p>
            <p className="text-white/15 text-xs">&copy; {new Date().getFullYear()} Vaultquokka. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Floating support button ── */}
      <button
        onClick={openTawk}
        aria-label="Open live support chat"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full px-4 py-3 shadow-[0_4px_20px_rgba(16,185,129,0.28)] transition-colors"
      >
        <MessageCircle className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm font-semibold hidden sm:inline">Support</span>
      </button>


      <style jsx global>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
