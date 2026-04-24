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
  RefreshCw, Star
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
                <span className="text-white font-black text-lg leading-none">K</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Kartomtrades</span>
            </div>
            <div className="hidden lg:flex items-center gap-7">
              <Link href="/markets"   className="text-white/50 hover:text-white transition-colors text-sm">Markets</Link>
              <a href="#features"     className="text-white/50 hover:text-white transition-colors text-sm">Features</a>
              <a href="#how-it-works" className="text-white/50 hover:text-white transition-colors text-sm">How it works</a>
              <a href="#accounts"     className="text-white/50 hover:text-white transition-colors text-sm">Accounts</a>
              <a href="#faq"          className="text-white/50 hover:text-white transition-colors text-sm">FAQ</a>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={() => setShowLogin(true)}
                className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-2"
              >Log in</button>
              <button
                onClick={focusEmailForm}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >Start free demo <ArrowRight className="w-3.5 h-3.5" /></button>
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
            <Link href="/markets"   className="block text-white/60 hover:text-white text-sm py-1.5">Markets</Link>
            <a href="#features"     className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#how-it-works" className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>How it works</a>
            <a href="#accounts"     className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>Accounts</a>
            <a href="#faq"          className="block text-white/60 hover:text-white text-sm py-1.5" onClick={() => setMobileMenu(false)}>FAQ</a>
            <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
              <button
                onClick={() => { setShowLogin(true); setMobileMenu(false) }}
                className="w-full text-center text-white/60 hover:text-white text-sm py-2 border border-border/50 rounded-lg"
              >Log in</button>
              <button
                onClick={(e) => { setMobileMenu(false); setTimeout(() => focusEmailForm(e), 300) }}
                className="w-full text-center bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2 rounded-lg"
              >Start free demo</button>
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
                <div className="inline-flex items-center gap-2 mb-6 text-[11px] font-semibold bg-white/[0.05] text-white/55 border border-white/[0.09] rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                  Demo-first trading platform
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.08]">
                  Practice trading with{' '}
                  <br className="hidden sm:block" />
                  <span className="text-emerald-400">live market conditions</span>
                </h1>
                <p className="mt-5 text-base md:text-lg text-white/50 max-w-lg leading-relaxed">
                  Start with <span className="text-white font-semibold">$100,000 in virtual funds</span> across Forex,
                  Crypto, Stocks, Indices, and Commodities. No card required.
                  Move to a live account only when you are ready.
                </p>

                {/* Primary + secondary CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={focusEmailForm}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors shadow-[0_2px_16px_rgba(16,185,129,0.22)]"
                  >
                    Start free demo <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
                  {['No card required', 'Instant demo account', 'Live market environment'].map((item) => (
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
                  {step === 1 ? (
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
                      <p className="text-white/25 text-xs">Free account. No card. $100,000 demo balance loaded instantly.</p>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
                      <div className="text-xs text-white/40 flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]" aria-hidden="true">✓</span>
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
                          <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" /> Creating your account…</>
                        ) : <>Create demo account <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                      </button>
                      <p className="text-white/20 text-xs text-center">By registering you agree to our Terms of Service and Risk Disclosure.</p>
                    </form>
                  )}
                  <p className="mt-3 text-xs text-white/25">
                    Already have an account?{' '}
                    <button onClick={() => setShowLogin(true)} className="text-emerald-400 hover:text-emerald-300 underline">Log in</button>
                  </p>
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
                      <span className="text-xs text-white/30 ml-1">Portfolio · Demo Account</span>
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
                      ▲ Buy
                    </button>
                    <button onClick={focusEmailForm} className="h-9 rounded-xl border border-red-500/20 bg-red-500/[0.08] text-red-300 text-xs font-semibold hover:bg-red-500/15 transition-colors">
                      ▼ Sell
                    </button>
                  </div>
                </div>
                <p className="text-center text-[11px] text-white/20 mt-3">Simulated demo account — no real funds at risk</p>
              </div>

            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ── */}
        <section className="border-y border-border/40 bg-white/[0.015] py-5" aria-label="Platform trust signals">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 items-center">
              {[
                { icon: <Gamepad2 className="w-4 h-4" aria-hidden="true" />,  label: 'Demo-first platform' },
                { icon: <Activity  className="w-4 h-4" aria-hidden="true" />,  label: 'Live market data' },
                { icon: <LineChart className="w-4 h-4" aria-hidden="true" />,  label: 'TradingView charts' },
                { icon: <UserCheck className="w-4 h-4" aria-hidden="true" />,  label: 'KYC before live account' },
                { icon: <Shield    className="w-4 h-4" aria-hidden="true" />,  label: 'Crypto deposits supported' },
                { icon: <BookOpen  className="w-4 h-4" aria-hidden="true" />,  label: 'Education-first approach' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-white/40 text-sm">
                  <span className="text-emerald-500/60">{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-14">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">How it works</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Three steps to your first trade</h2>
              <p className="mt-3 text-white/40 text-base">Practice first. Go live only when you are confident.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-9 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" aria-hidden="true" />
              {[
                {
                  step: '01',
                  title: 'Create your free demo account',
                  body: 'Sign up with just an email address. No card, no deposit, no wait. Your account is ready in seconds with $100,000 in virtual funds.',
                  icon: <UserCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />,
                },
                {
                  step: '02',
                  title: 'Practice with virtual funds at live prices',
                  body: 'Trade Forex, crypto, stocks, indices, and commodities at real market prices. Use stop loss, take profit, copy trading, and the AI trade coach to build real skills.',
                  icon: <TrendingUp className="w-5 h-5 text-emerald-400" aria-hidden="true" />,
                },
                {
                  step: '03',
                  title: 'Upgrade to a live account after verification',
                  body: "When you're ready, complete identity verification and make a deposit. Same terminal, same interface. No new learning curve.",
                  icon: <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />,
                },
              ].map(({ step, title, body, icon }) => (
                <div key={step} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      {icon}
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

        {/* ── MARKETS STRIP ── */}
        <section className="py-14 border-b border-border/40 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-2">Live Markets</div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">One account. Every market.</h2>
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

        {/* ── FEATURES ── */}
        <section id="features" className="py-20 border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Platform features</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for practice, analysis, and disciplined execution</h2>
              <p className="mt-3 text-white/40 text-base">Every tool is designed to help you develop real trading skills.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
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
                  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                },
                {
                  Icon: Lock,
                  title: 'Stop loss and take profit',
                  desc: 'Set a stop loss and take profit level on every position before opening it. Define your maximum loss per trade without relying on manual monitoring.',
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                },
                {
                  Icon: RefreshCw,
                  title: 'Demo and live account switching',
                  desc: 'Switch between your demo and live accounts in one click from the same terminal. No separate logins, no separate interfaces to learn.',
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
              ].map(({ Icon, title, desc, color }) => (
                <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-white/[0.11] transition-colors">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                    <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                  </div>
                  <div className="text-white font-semibold mb-2">{title}</div>
                  <div className="text-white/40 text-sm leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ACCOUNTS COMPARISON ── */}
        <section id="accounts" className="py-20 border-b border-border/40 bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-3">Account types</div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Practice first. Go live when you are ready.</h2>
              <p className="mt-3 text-white/40 text-base">
                Demo and live accounts share the same interface. The difference is what is at stake.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-2xl">

              {/* Demo account */}
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-amber-400" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Demo account</div>
                    <div className="text-white/30 text-xs">Start immediately — no deposit</div>
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white mb-1 tabular-nums">$100,000</div>
                <div className="text-white/30 text-sm mb-6">Virtual funds, loaded instantly</div>
                <ul className="space-y-3">
                  {[
                    'No credit card or deposit required',
                    'Trade at real live market prices',
                    'Reset your balance at any time',
                    'Full access to all platform tools',
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
                  Open demo account
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
                <div className="text-white/30 text-sm mb-6">Deposit after KYC approval</div>
                <ul className="space-y-3">
                  {[
                    'Identity verification (KYC) required',
                    'Deposit via crypto (BTC / USDT)',
                    'Real profit and loss on every trade',
                    'Withdrawal subject to admin review',
                    'Same terminal as your demo account',
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
                  Start with a demo first
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
                  Built for traders who want to learn properly
                </h2>
                <p className="text-white/50 text-base leading-relaxed mb-5">
                  Kartomtrades is a simulated trading platform that connects you to live market data so you can practice
                  trading in realistic conditions without putting real money at risk.
                </p>
                <p className="text-white/40 text-sm leading-relaxed mb-5">
                  The platform is designed for retail traders who want to build genuine skills before committing real capital.
                  Whether you are completely new to trading or returning after a break, the demo environment gives you a realistic
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
                    title: 'What is Kartomtrades?',
                    body: 'A simulated trading platform that uses live market data. You can practice across multiple asset classes in a realistic environment before deciding whether to open a live account.',
                  },
                  {
                    title: 'Who is it for?',
                    body: 'Beginner and intermediate retail traders who want to practice before risking real money. Also suitable for experienced traders who want to test new strategies without financial risk.',
                  },
                  {
                    title: 'What does "demo-first" mean?',
                    body: 'Every account starts as a demo account with $100,000 in virtual funds. You are never required to deposit. Moving to a live account is a separate, voluntary step.',
                  },
                  {
                    title: 'What requires verification?',
                    body: 'Identity verification (KYC) is required only before opening a live account or making a deposit. The demo account can be used indefinitely without any verification.',
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
                Start your free demo account
              </h2>
              <p className="text-white/45 text-base mb-2">
                $100,000 in virtual funds. No card required. Instant access.
              </p>
              <p className="text-white/25 text-sm mb-8">
                Practice trading in live market conditions before risking real money.
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
                {['No card required', 'Instant demo account', 'Live market environment'].map(item => (
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
                  <span className="text-white font-black text-lg leading-none">K</span>
                </div>
                <span className="text-lg font-bold">Kartomtrades</span>
              </div>
              <p className="text-white/30 text-xs max-w-xs leading-relaxed">
                A simulated trading platform for education and practice.
                All trading is conducted using virtual funds unless you open a live account after completing identity verification.
              </p>
            </div>
            <div>
              <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-4">Platform</div>
              <div className="space-y-2.5">
                <Link href="/markets"                  className="block text-white/40 hover:text-white text-xs transition-colors">Markets</Link>
                <button onClick={() => setShowLogin(true)} className="block text-white/40 hover:text-white text-xs transition-colors text-left">Log in</button>
                <button onClick={focusEmailForm}           className="block text-white/40 hover:text-white text-xs transition-colors text-left">Register</button>
                <a href="#how-it-works"                    className="block text-white/40 hover:text-white text-xs transition-colors">How it works</a>
                <a href="#faq"                             className="block text-white/40 hover:text-white text-xs transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <div className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-4">Legal</div>
              <div className="space-y-2.5">
                {/* TODO: Replace spans with <Link> once legal pages are created */}
                <span className="block text-white/25 text-xs select-none">Risk Disclosure</span>
                <span className="block text-white/25 text-xs select-none">Privacy Policy</span>
                <span className="block text-white/25 text-xs select-none">Terms of Service</span>
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
              Kartomtrades is a simulation platform intended for educational and practice purposes.
              Virtual demo trading does not guarantee equivalent results in live markets.
              Past performance of any trading strategy or instrument is not a reliable indicator of future results.
              This platform does not provide financial advice.
            </p>
            <p className="text-white/15 text-xs">© {new Date().getFullYear()} Kartomtrades. All rights reserved.</p>
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

      {/* ── Login modal ── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log in to Kartomtrades">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowLogin(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-2xl">
            <button
              onClick={() => setShowLogin(false)}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm leading-none">K</span>
              </div>
              <span className="text-white font-bold">Welcome back</span>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-white/30 block mb-1.5" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setLoginError('') }}
                  className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1.5" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => { setLoginPassword(e.target.value); setLoginError('') }}
                  className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginSubmitting}
                className="h-11 mt-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loginSubmitting
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden="true" /> Signing in…</>
                  : 'Sign in'
                }
              </button>
            </form>
            <p className="text-center text-xs text-white/25 mt-4">
              No account?{' '}
              <button
                onClick={(e) => { setShowLogin(false); setTimeout(() => focusEmailForm(e), 200) }}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >Create one free</button>
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
