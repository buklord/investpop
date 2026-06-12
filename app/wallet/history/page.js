'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Menu, Loader2, RefreshCw, History, ArrowDownUp, Send, ArrowDownToLine, Gift, Search, Download, Filter, X } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

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
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showFilters, setShowFilters] = useState(false)

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

  const filteredTxns = useMemo(() => {
    return txns.filter(tx => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const text = `${tx.type} ${tx.asset || ''} ${tx.assetTo || ''} ${tx.description || ''}`.toLowerCase()
        if (!text.includes(s)) return false
      }
      return true
    })
  }, [txns, typeFilter, search])

  const exportCSV = () => {
    const rows = filteredTxns.map(tx => ({
      Type: tx.type,
      Asset: tx.asset || '',
      Amount: tx.amount || 0,
      AssetTo: tx.assetTo || '',
      AmountTo: tx.amountTo || 0,
      Description: tx.description || '',
      Date: new Date(tx.createdAt).toISOString()
    }))
    if (!rows.length) return
    const headers = Object.keys(rows[0]).join(',')
    const csv = [headers, ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vaultquokka-history-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/history" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Wallet History</h1>
              <p className="text-muted-foreground text-sm">Converts, transfers, and deposits.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={exportCSV} disabled={!filteredTxns.length} className="flex text-muted-foreground hover:text-foreground">
                <Download className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Export</span>
              </Button>
              <Button variant="ghost" onClick={refresh} disabled={refreshing} className="flex text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by type, asset, or description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-card border-border text-foreground"
                />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="border-border text-muted-foreground">
                <Filter className="h-4 w-4 mr-1.5" /> Filter
              </Button>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-card border border-border">
                {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'CONVERT', 'SEND', 'RECEIVE', 'SEED'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                      typeFilter === t
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-muted text-muted-foreground border-border hover:border-emerald-500/30'
                    }`}
                  >
                    {t === 'ALL' ? 'All Types' : (TYPE_META[t]?.label || t)}
                  </button>
                ))}
                {(search || typeFilter !== 'ALL') && (
                  <button
                    onClick={() => { setSearch(''); setTypeFilter('ALL') }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Showing {filteredTxns.length} of {txns.length} transactions
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-base flex items-center gap-2"><History className="h-4 w-4 text-emerald-400" /> Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTxns.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No wallet activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredTxns.map(tx => {
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
