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
      const res = await fetch('/api/leaderboard?limit=5')
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

        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-400" /> Top Traders
              </h1>
              <p className="text-muted-foreground text-sm">Top 5 traders by account balance.</p>
            </div>
            <Button variant="ghost" onClick={loadBoard} className="hidden lg:inline-flex text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>

          <Card className="bg-card border-border shadow-lg">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {entries.map((e, idx) => {
                  const balance = e.balance || 0
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''
                  
                  return (
                    <div 
                      key={e.userId} 
                      className={`flex items-center justify-between p-4 sm:p-5 transition-colors ${
                        e.isMe ? 'bg-emerald-500/5 border-l-4 border-emerald-500' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex-shrink-0">
                          <span className="text-base sm:text-lg font-bold text-amber-400">
                            {medal || `#${e.rank}`}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm sm:text-base font-semibold text-foreground truncate">
                            {e.handle.split('@')[0]}{e.isMe ? ' (You)' : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">Rank #{e.rank}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-base sm:text-lg font-bold text-emerald-400">
                          {money(balance)}
                        </div>
                        <div className="text-xs text-muted-foreground">Balance</div>
                      </div>
                    </div>
                  )
                })}
                
                {entries.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No trading data yet. Start trading to appear on the leaderboard!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
