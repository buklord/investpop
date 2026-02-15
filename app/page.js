'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, BarChart3, Wallet, Eye, LogIn } from 'lucide-react'

export default function HomePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (user) {
    router.push('/dashboard')
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Redirecting to dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-emerald-500" />
            <span className="text-2xl font-bold text-white">InvestDash</span>
          </div>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Info */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Track Your
              <span className="text-emerald-500"> Investments </span>
              In Real-Time
            </h1>
            <p className="text-xl text-slate-400">
              Monitor stocks and cryptocurrencies, manage your portfolio, and make informed investment decisions with our powerful dashboard.
            </p>
            
            <div className="grid grid-cols-3 gap-4 pt-8">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <TrendingUp className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-white font-semibold">Real-Time Quotes</p>
                <p className="text-slate-400 text-sm">Live market data</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <Eye className="h-8 w-8 text-blue-500 mb-2" />
                <p className="text-white font-semibold">Watchlist</p>
                <p className="text-slate-400 text-sm">Track favorites</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <Wallet className="h-8 w-8 text-purple-500 mb-2" />
                <p className="text-white font-semibold">Portfolio</p>
                <p className="text-slate-400 text-sm">Track P&L</p>
              </div>
            </div>
          </div>

          {/* Right side - Auth Form */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white text-2xl">Welcome</CardTitle>
                <CardDescription className="text-slate-400">
                  {authMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={authMode} onValueChange={setAuthMode}>
                  <TabsList className="grid w-full grid-cols-2 bg-slate-700">
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
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
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
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
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
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={submitting}
                    >
                      {submitting ? 'Please wait...' : (
                        <>
                          <LogIn className="mr-2 h-4 w-4" />
                          {authMode === 'login' ? 'Sign In' : 'Create Account'}
                        </>
                      )}
                    </Button>
                  </form>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
