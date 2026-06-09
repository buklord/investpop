'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Menu, Loader2, RefreshCw, History, ArrowDownUp, Send, ArrowDownToLine, Gift } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const TYPE_META = {
  CONVERT: { label: 'Convert', icon: ArrowDownUp, color: 'text-blue-400' },
  SEND: { label: 'Sent', icon: Send, color: 'text-red-400' },
  RECEIVE: { label: 'Received', icon: ArrowDownToLine, color: 'text-emerald-400' },
  DEPOSIT: { label: 'Deposit', icon: ArrowDownToLine, color: 'text-emerald-400' },
  WITHDRAWAL: { label: 'Withdrawal', icon: Send, color: 'text-red-400' },
  SEED: { label: 'Welcome Bonus', icon: Gift, color: 'text-amber-400' },
}

export default function WalletHistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [txns, setTxns] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      setUser((await res.json()).user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadData = async () => {
    try {
      const res = await fetch('/api/wallet/transactions')
      if (res.ok) setTxns((await res.json()).transactions || [])
    } catch (_) {}
  }

  const refresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const fmt = (n, d = 8) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d })
  const fmtDate = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/history" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0">
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1"><Menu className="h-6 w-6" /></button>
          <span className="font-bold text-foreground text-sm">Wallet History</span>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} className="text-muted-foreground p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Wallet History</h1>
              <p className="text-muted-foreground text-sm">Converts, transfers, and deposits.</p>
            </div>
            <Button variant="ghost" onClick={refresh} disabled={refreshing} className="hidden lg:flex text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><History className="h-4 w-4 text-emerald-400" /> Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txns.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No wallet activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {txns.map(tx => {
                    const meta = TYPE_META[tx.type] || { label: tx.type, icon: History, color: 'text-muted-foreground' }
                    const Icon = meta.icon
                    return (
                      <div key={tx.id} className="flex items-center gap-3 p-4">
                        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">{meta.label}</div>
                          <div className="text-muted-foreground text-xs truncate">{tx.description || '—'}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {tx.type === 'CONVERT' ? (
                            <div className="text-sm font-medium text-foreground">
                              <span className="text-red-400">-{fmt(Math.abs(tx.amount))} {tx.asset}</span>
                              <span className="mx-1 text-muted-foreground">→</span>
                              <span className="text-emerald-400">+{fmt(tx.amountTo)} {tx.assetTo}</span>
                            </div>
                          ) : (
                            <div className={`text-sm font-medium ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)} {tx.asset}
                            </div>
                          )}
                          <div className="text-muted-foreground text-xs">{fmtDate(tx.createdAt)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-4">
            <Button variant="ghost" onClick={() => router.push('/wallet')} className="text-muted-foreground">Back to Wallet</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
