'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Wallet, 
  Eye, 
  LogIn,
  LineChart,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  Menu,
  X,
  ArrowRight
} from 'lucide-react'

export default function HomePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

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
    setSubmitting(true)

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      setUser(data.user)
      router.push('/dashboard')
    } catch (err) {
      setError('Network error. Please try again.')
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
    <div className="min-h-screen bg-[#0d1117]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d1117]/95 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">PaperTrade</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              <Link href="/markets" className="text-slate-300 hover:text-white transition-colors">Markets</Link>
              <Link href="#features" className="text-slate-300 hover:text-white transition-colors">Features</Link>
              <Link href="#about" className="text-slate-300 hover:text-white transition-colors">About</Link>
            </div>

            {/* Auth Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="text-white hover:bg-slate-800"
              >
                Log In
              </Button>
              <Button 
                onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Start Trading
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0d1117] border-t border-slate-800 px-4 py-4 space-y-4">
            <Link href="/markets" className="block text-slate-300 hover:text-white">Markets</Link>
            <Link href="#features" className="block text-slate-300 hover:text-white">Features</Link>
            <Link href="#about" className="block text-slate-300 hover:text-white">About</Link>
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <Button 
                variant="outline" 
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); setMobileMenuOpen(false); }}
                className="w-full border-slate-700 text-white"
              >
                Log In
              </Button>
              <Button 
                onClick={() => { setAuthMode('register'); setShowAuthModal(true); setMobileMenuOpen(false); }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Start Trading
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-emerald-400 text-sm font-medium">Paper Trading Simulation</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Trade Stocks & Crypto
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400"> Risk-Free</span>
            </h1>
            
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Practice trading with $100,000 in virtual funds. Real market data, zero risk. 
              Master the markets before investing real money.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg"
              >
                Start Paper Trading
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="border-slate-700 text-white hover:bg-slate-800 px-8 py-6 text-lg"
              >
                Log In
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-bold text-white">$100K</div>
                <div className="text-slate-500 text-sm">Starting Balance</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">15+</div>
                <div className="text-slate-500 text-sm">Assets Available</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">Real-Time</div>
                <div className="text-slate-500 text-sm">Market Data</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Preview */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0d1117] to-slate-900/50">
        <div className="container mx-auto">
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-3xl"></div>
            <div className="relative bg-slate-900/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
              {/* Mock Trading Interface */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-slate-400 text-sm">PaperTrade Dashboard</span>
                </div>
                <div className="text-emerald-500 text-sm font-medium">● Live</div>
              </div>
              <div className="grid lg:grid-cols-3 gap-0">
                {/* Left Panel - Positions */}
                <div className="border-r border-slate-700 p-6">
                  <h3 className="text-white font-semibold mb-4">Open Positions</h3>
                  <div className="space-y-3">
                    {[
                      { symbol: 'AAPL', qty: 10, pnl: '+$234.50', pnlPercent: '+2.3%', positive: true },
                      { symbol: 'BTCUSD', qty: 0.5, pnl: '-$156.20', pnlPercent: '-1.2%', positive: false },
                      { symbol: 'TSLA', qty: 5, pnl: '+$89.00', pnlPercent: '+0.8%', positive: true },
                    ].map((pos, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                        <div>
                          <div className="text-white font-medium">{pos.symbol}</div>
                          <div className="text-slate-500 text-sm">{pos.qty} units</div>
                        </div>
                        <div className="text-right">
                          <div className={pos.positive ? 'text-emerald-400' : 'text-red-400'}>{pos.pnl}</div>
                          <div className={`text-sm ${pos.positive ? 'text-emerald-400' : 'text-red-400'}`}>{pos.pnlPercent}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Center - Chart */}
                <div className="p-6 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white text-xl font-bold">AAPL</h3>
                      <div className="text-slate-400">Apple Inc.</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-2xl font-bold">$178.50</div>
                      <div className="text-emerald-400">+2.34%</div>
                    </div>
                  </div>
                  {/* Chart placeholder */}
                  <div className="h-64 bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-700">
                    <div className="text-center">
                      <LineChart className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                      <span className="text-slate-500">TradingView Charts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Learn Trading
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Our paper trading platform gives you all the tools of a real brokerage, without the risk.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: 'Real-Time Quotes',
                description: 'Live market data from Twelve Data API for accurate price simulation.'
              },
              {
                icon: <LineChart className="h-6 w-6" />,
                title: 'TradingView Charts',
                description: 'Professional-grade charting with technical indicators.'
              },
              {
                icon: <Wallet className="h-6 w-6" />,
                title: 'Portfolio Analytics',
                description: 'Track your P&L, allocation, and trading performance.'
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: 'Zero Risk',
                description: 'Practice with $100K virtual funds. Learn without losing real money.'
              },
            ].map((feature, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Start Trading?
            </h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Sign up in seconds and start trading with $100,000 in virtual funds.
              No credit card required.
            </p>
            <Button 
              size="lg"
              onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8"
            >
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">PaperTrade</span>
            </div>
            <div className="text-slate-500 text-sm">
              Paper Trading Simulation - Not Real Trading
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAuthModal(false)}
          ></div>
          <Card className="relative w-full max-w-md bg-slate-900 border-slate-700">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-white text-2xl">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {authMode === 'login' 
                  ? 'Sign in to access your paper trading account' 
                  : 'Start trading with $100,000 in virtual funds'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMode} onValueChange={setAuthMode}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                  <TabsTrigger value="login" className="data-[state=active]:bg-emerald-600">Login</TabsTrigger>
                  <TabsTrigger value="register" className="data-[state=active]:bg-emerald-600">Register</TabsTrigger>
                </TabsList>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Password</label>
                    <Input
                      type="password"
                      placeholder={authMode === 'register' ? 'Min 8 characters' : '••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                      minLength={authMode === 'register' ? 8 : 1}
                    />
                  </div>
                  
                  {error && (
                    <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
                      {error}
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    disabled={submitting}
                  >
                    {submitting ? 'Please wait...' : (
                      authMode === 'login' ? 'Sign In' : 'Create Account'
                    )}
                  </Button>

                  {authMode === 'register' && (
                    <p className="text-xs text-slate-500 text-center">
                      By signing up, you agree that this is a paper trading simulation and not real trading.
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
