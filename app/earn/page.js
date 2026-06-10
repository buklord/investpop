'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles, Loader2, PiggyBank, Lock, Layers, Rocket, TrendingUp,
  Bot, Users, ArrowRight, Bell, ShieldCheck
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

// Earn products. `live` ones link into existing platform features; the rest are
// upcoming and surface a "Notify me" action so users can see what's coming.
const EARN_PRODUCTS = [
  {
    id: 'bots', live: true, Icon: Bot,
    title: 'AI Trading Bots',
    apy: 'Up to 57% / 30d',
    desc: 'Deploy automated strategies that trade your balance 24/7 across spot and futures pairs.',
    href: '/bots', cta: 'Explore bots',
  },
  {
    id: 'copy', live: true, Icon: Users,
    title: 'Copy Trading',
    apy: 'Mirror top traders',
    desc: 'Automatically copy the trades of top-performing investors, scaled to your own balance.',
    href: '/copy-trading', cta: 'Browse traders',
  },
  {
    id: 'simple', live: false, Icon: PiggyBank,
    title: 'Simple Earn',
    apy: 'Flexible · est. 4–8% APR',
    desc: 'Earn daily rewards on idle USDT, BTC and ETH. Subscribe and redeem any time — no lock-up.',
  },
  {
    id: 'staking', live: false, Icon: Lock,
    title: 'Staking',
    apy: 'Locked · est. 6–18% APR',
    desc: 'Lock supported assets for a fixed term to earn boosted on-chain staking rewards.',
  },
  {
    id: 'vaults', live: false, Icon: Layers,
    title: 'Savings Vaults',
    apy: 'Auto-compounding',
    desc: 'Set-and-forget vaults that automatically allocate across strategies to grow your balance.',
  },
  {
    id: 'launchpad', live: false, Icon: Rocket,
    title: 'Launchpad',
    apy: 'Early access',
    desc: 'Commit assets to access new token launches before they hit the open market.',
  },
]

export default function EarnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notified, setNotified] = useState({})

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  const notifyMe = (id, title) => {
    setNotified(prev => ({ ...prev, [id]: true }))
    toast({ title: 'You\u2019re on the list', description: `We\u2019ll let you know the moment ${title} goes live.` })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const live = EARN_PRODUCTS.filter(p => p.live)
  const upcoming = EARN_PRODUCTS.filter(p => !p.live)

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/earn" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {/* Hero */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-transparent p-6 sm:p-8 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">Earn</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Put your wallet to work</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-xl">
              Grow your balance instead of letting it sit idle. Automate trading today, with simple savings,
              staking and vaults rolling out soon.
            </p>
          </div>

          {/* Live now */}
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <h2 className="text-foreground font-semibold">Available now</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {live.map(({ id, Icon, title, apy, desc, href, cta }) => (
              <Card key={id} className="bg-card border-border p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">{title}</div>
                    <div className="text-emerald-400 text-xs font-medium">{apy}</div>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{desc}</p>
                <Button
                  onClick={() => router.push(href)}
                  className="mt-4 w-full bg-emerald-300 hover:bg-emerald-400 text-black font-semibold"
                >
                  {cta} <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Card>
            ))}
          </div>

          {/* Coming soon */}
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-foreground font-semibold">Coming soon</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
            {upcoming.map(({ id, Icon, title, apy, desc }) => (
              <Card key={id} className="bg-card border-border p-5 flex flex-col relative overflow-hidden">
                <span className="absolute top-4 right-4 rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Soon</span>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                    <Icon className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">{title}</div>
                    <div className="text-muted-foreground text-xs font-medium">{apy}</div>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{desc}</p>
                <Button
                  variant="outline"
                  disabled={notified[id]}
                  onClick={() => notifyMe(id, title)}
                  className="mt-4 w-full border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
                >
                  {notified[id]
                    ? (<><ShieldCheck className="h-4 w-4 mr-1.5" /> You&rsquo;ll be notified</>)
                    : (<><Bell className="h-4 w-4 mr-1.5" /> Notify me</>)}
                </Button>
              </Card>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
            <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Earn products use virtual funds for simulation and education. Estimated rates are illustrative and
              not a guarantee of returns.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
