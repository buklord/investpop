'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function WalletReportPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [txns, setTxns] = useState([])
  const [categories, setCategories] = useState({})

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { if (user) loadData() }, [user])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vq_txCategories')
      if (raw) setCategories(JSON.parse(raw))
    } catch {}
  }, [])

  const loadData = async () => {
    try {
      const res = await fetch('/api/wallet/transactions')
      if (res.ok) setTxns((await res.json()).transactions || [])
    } catch {}
  }

  const monthlyData = useMemo(() => {
    const map = {}
    txns.forEach(tx => {
      const d = new Date(tx.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { inflow: 0, outflow: 0, count: 0 }
      const val = Math.abs(tx.amount) * (tx.priceUsd || (tx.asset?.startsWith('USD') ? 1 : 0) || 0)
      if (tx.amount >= 0) map[key].inflow += val
      else map[key].outflow += val
      map[key].count++
    })
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data, net: data.inflow - data.outflow }))
      .slice(-12)
  }, [txns])

  const totals = useMemo(() => {
    return monthlyData.reduce((acc, m) => ({
      inflow: acc.inflow + m.inflow,
      outflow: acc.outflow + m.outflow,
      net: acc.net + m.net,
      count: acc.count + m.count,
    }), { inflow: 0, outflow: 0, net: 0, count: 0 })
  }, [monthlyData])

  const topCategories = useMemo(() => {
    const out = {}
    txns.forEach(tx => {
      if (tx.amount >= 0) return
      const cat = categories[tx.id] || 'Uncategorized'
      const val = Math.abs(tx.amount) * (tx.priceUsd || (tx.asset?.startsWith('USD') ? 1 : 0) || 0)
      out[cat] = (out[cat] || 0) + val
    })
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [txns, categories])

  const fmt$ = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
  const fmtMonth = (m) => {
    const [y, mo] = m.split('-')
    return new Date(`${y}-${mo}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const maxBar = Math.max(...monthlyData.map(m => Math.max(m.inflow, m.outflow)), 1)

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/history" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
          <button onClick={() => router.push('/wallet/history')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </button>

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Monthly Report</h1>
            <p className="text-muted-foreground text-sm">Income, spending, and net change over time.</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-card border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Total Inflow</span>
                </div>
                <div className="text-lg font-bold text-emerald-400">{fmt$(totals.inflow)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs text-muted-foreground">Total Outflow</span>
                </div>
                <div className="text-lg font-bold text-red-400">{fmt$(totals.outflow)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-foreground" />
                  <span className="text-xs text-muted-foreground">Net Change</span>
                </div>
                <div className={`text-lg font-bold ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.net >= 0 ? '+' : ''}{fmt$(totals.net)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Bars */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-foreground text-sm">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No transaction data yet.</div>
              ) : (
                <div className="space-y-3">
                  {monthlyData.map(m => (
                    <div key={m.month}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{fmtMonth(m.month)}</span>
                        <span className={`text-xs font-bold ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.net >= 0 ? '+' : ''}{fmt$(m.net)}
                        </span>
                      </div>
                      <div className="flex gap-1 h-5">
                        <div
                          className="bg-emerald-500/60 rounded-sm transition-all"
                          style={{ width: `${(m.inflow / maxBar) * 100}%` }}
                          title={`Inflow: ${fmt$(m.inflow)}`}
                        />
                        <div
                          className="bg-red-500/60 rounded-sm transition-all"
                          style={{ width: `${(m.outflow / maxBar) * 100}%` }}
                          title={`Outflow: ${fmt$(m.outflow)}`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>{fmt$(m.inflow)} in</span>
                        <span>{m.count} txns</span>
                        <span>{fmt$(m.outflow)} out</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Spending Categories */}
          {topCategories.length > 0 && (
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-sm">Top Spending Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topCategories.map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{cat}</span>
                    <span className="text-xs font-medium text-foreground">{fmt$(val)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
