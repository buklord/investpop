'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Loader2, RefreshCw, Trophy } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LeaderboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadBoard() }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch (_) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadBoard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=50')
      if (!res.ok) return
      const data = await res.json()
      setEntries(Array.isArray(data.leaderboard) ? data.leaderboard : [])
    } catch (_) {}
  }

  const money = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/leaderboard" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-foreground text-sm">Leaderboard</span>
          <Button variant="ghost" size="sm" onClick={loadBoard} className="text-muted-foreground p-1">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" /> Simulated Leaderboard
              </h1>
              <p className="text-muted-foreground text-sm">Ranked by simulated account performance.</p>
            </div>
            <Button variant="ghost" onClick={loadBoard} className="hidden lg:inline-flex">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Top Traders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2">Rank</th>
                      <th className="text-left py-2">Trader</th>
                      <th className="text-right py-2">Balance</th>
                      <th className="text-right py-2">Return</th>
                      <th className="text-right py-2">Trades</th>
                      <th className="text-right py-2">Realized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.userId} className={`border-b border-border/60 ${e.isMe ? 'bg-emerald-500/5' : ''}`}>
                        <td className="py-2 text-sm font-semibold">#{e.rank}</td>
                        <td className="py-2 text-sm">{e.handle}{e.isMe ? ' (You)' : ''}</td>
                        <td className="py-2 text-sm text-right">{money(e.balance)}</td>
                        <td className={`py-2 text-sm text-right ${(e.returnPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(e.returnPct || 0) >= 0 ? '+' : ''}{Number(e.returnPct || 0).toFixed(2)}%
                        </td>
                        <td className="py-2 text-sm text-right">{e.trades}</td>
                        <td className={`py-2 text-sm text-right ${(e.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(e.realizedPnl || 0) >= 0 ? '+' : ''}{money(e.realizedPnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
