'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Menu,
  ArrowLeft,
  CheckCircle,
  Zap,
  Users,
  Clock,
  TrendingUp,
  Wallet,
  Shield,
  Sparkles,
  Bell,
  Loader2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function EarnPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState({})

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const handleNotify = (feature) => {
    setNotifications(prev => ({ ...prev, [feature]: true }))
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/earn" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Earn</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              Earn
            </h1>
            <p className="text-slate-400 text-sm mt-2">Put your wallet to work 24/7 with automated strategies and passive income products.</p>
          </div>

          {/* Available Now */}
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Available Now
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* AI Trading Bots */}
              <Card className="bg-[#161b22] border-slate-800 hover:border-emerald-500/30 transition-all">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    AI Trading Bots
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-sm mb-4">
                    Deploy AI-powered trading bots that execute strategies 24/7. Configure risk, choose markets, and let automation work for you.
                  </p>
                  <Link href="/bots">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                      Launch Bots
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Copy Trading */}
              <Card className="bg-[#161b22] border-slate-800 hover:border-emerald-500/30 transition-all">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Copy Trading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-sm mb-4">
                    Follow top-performing traders and automatically copy their positions. View leaderboards, track performance, and allocate funds.
                  </p>
                  <Link href="/copy-trading">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                      Start Copying
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Coming Soon */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Coming Soon
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Simple Earn */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-400" />
                      Simple Earn
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Soon</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-xs mb-3">
                    Earn flexible yield on your idle crypto with no lock-up period.
                  </p>
                  {notifications['simple-earn'] ? (
                    <Button disabled className="bg-slate-700 text-slate-400 text-xs w-full">
                      You'll be notified
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleNotify('simple-earn')}
                      variant="outline" 
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs w-full"
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Notify me
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Staking */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      Staking
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Soon</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-xs mb-3">
                    Lock your assets for higher APY. Support for PoS chains and DeFi protocols.
                  </p>
                  {notifications['staking'] ? (
                    <Button disabled className="bg-slate-700 text-slate-400 text-xs w-full">
                      You'll be notified
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleNotify('staking')}
                      variant="outline" 
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs w-full"
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Notify me
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Savings Vaults */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Savings Vaults
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Soon</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-xs mb-3">
                    High-yield vaults with tiered rates. The more you save, the more you earn.
                  </p>
                  {notifications['savings'] ? (
                    <Button disabled className="bg-slate-700 text-slate-400 text-xs w-full">
                      You'll be notified
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleNotify('savings')}
                      variant="outline" 
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs w-full"
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Notify me
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Launchpad */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      Launchpad
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Soon</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 text-xs mb-3">
                    Get early access to new token launches and exclusive airdrops.
                  </p>
                  {notifications['launchpad'] ? (
                    <Button disabled className="bg-slate-700 text-slate-400 text-xs w-full">
                      You'll be notified
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleNotify('launchpad')}
                      variant="outline" 
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs w-full"
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Notify me
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
