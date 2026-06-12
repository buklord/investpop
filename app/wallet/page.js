'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Menu,
  RefreshCw,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Loader2,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Gamepad2,
  ArrowDownUp,
  Send,
  ArrowDownToLine,
  History as HistoryIcon,
  Coins,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  Clock
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [account, setAccount] = useState(null)
  const [spot, setSpot] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerMode, setLedgerMode] = useState('REAL')
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [hideBalances, setHideBalances] = useState(false)
  const [pendingTxs, setPendingTxs] = useState([])

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('vq_hideBalances') : null
    if (saved === '1') setHideBalances(true)
  }, [])

  const toggleHideBalances = () => {
    setHideBalances(prev => {
      const next = !prev
      if (typeof window !== 'undefined') localStorage.setItem('vq_hideBalances', next ? '1' : '0')
      return next
    })
  }

  const masked = (val) => hideBalances ? '••••••' : val

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadData = async () => {
    try {
      const [accountRes, ledgerRes, spotRes, pendingRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/ledger'),
        fetch('/api/wallet/balances'),
        fetch('/api/wallet/pending')
      ])
      const accountData = await accountRes.json()
      const ledgerData = await ledgerRes.json()
      setAccount(accountData)
      if (spotRes.ok) setSpot(await spotRes.json())
      setLedger(ledgerData.entries || [])
      setLedgerMode(ledgerData.mode || accountData?.tradingMode || 'REAL')
      if (pendingRes.ok) {
        const pd = await pendingRes.json()
        setPendingTxs(pd.pending || [])
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err)
    }
  }

  const refreshData = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const requestDemoFunds = async () => {
    setRequesting(true); setSuccessMsg('')
    try {
      const res = await fetch('/api/wallet/request-funds', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`Demo account reset to $${data.amount?.toLocaleString()}!`)
        // Add cache-busting param to force fresh data
        const [accountRes, ledgerRes] = await Promise.all([
          fetch('/api/account?_t=' + Date.now()),
          fetch('/api/ledger?_t=' + Date.now())
        ])
        const accountData = await accountRes.json()
        const ledgerData = await ledgerRes.json()
        setAccount(accountData)
        setLedger(ledgerData.entries || [])
        setLedgerMode(ledgerData.mode || accountData?.tradingMode || 'REAL')
      } else {
        setSuccessMsg(data.error || 'Failed to request funds.')
      }
    } catch { setSuccessMsg('Failed to request funds.') }
    finally { setRequesting(false); setTimeout(() => setSuccessMsg(''), 5000) }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0)

  const entryTypeColor = (type) => {
    switch (type) {
      case 'DEPOSIT': return 'text-emerald-500'
      case 'TRADE_SELL': return 'text-emerald-500'
      case 'ADMIN_ADJUSTMENT': return 'text-amber-400'
      case 'TRADE_BUY': return 'text-red-500'
      case 'FEE': return 'text-red-500'
      case 'WITHDRAWAL': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  const entryTypeLabel = (type) => {
    const labels = {
      DEPOSIT: 'Deposit',
      WITHDRAWAL: 'Withdrawal',
      TRADE_BUY: 'Position Opened',
      TRADE_SELL: 'Position Closed',
      FEE: 'Trading Fee',
      ADMIN_ADJUSTMENT: 'Admin Adjustment'
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const realBalance = account?.realBalance ?? 0
  const demoBalance = account?.demoBalance ?? 0
  const activeMode = account?.tradingMode ?? account?.trading_mode ?? 'REAL'
  const activeEquity = (account?.balance ?? 0) + (account?.openPnl ?? 0)

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Wallet Overview</h1>
              <p className="text-muted-foreground text-sm">Your spot balances, trading accounts and activity</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleHideBalances}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={hideBalances ? 'Show balances' : 'Hide balances'}
              >
                {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <Button variant="ghost" onClick={refreshData} disabled={refreshing}
                className="flex text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Pending Transactions */}
          {pendingTxs.length > 0 && (
            <Card className="bg-card border-amber-500/20 mb-6">
              <CardHeader>
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" /> Pending ({pendingTxs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {pendingTxs.slice(0, 3).map(tx => (
                    <div key={`${tx.type}-${tx.id}`} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {tx.type === 'DEPOSIT' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} {tx.method}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(tx.amount)} · {tx.status}</div>
                        </div>
                      </div>
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">Pending</span>
                    </div>
                  ))}
                </div>
                {pendingTxs.length > 3 && (
                  <div className="px-4 py-2 text-center">
                    <button onClick={() => router.push('/wallet/history')} className="text-xs text-emerald-400 hover:underline">
                      View all {pendingTxs.length} pending
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unified wallet — estimated total value across spot + trading */}
          <Card className="bg-card border-border mb-6 overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <span className="text-muted-foreground text-sm">Estimated Total Value</span>
                {hideBalances && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Hidden</span>}
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">
                {masked(formatCurrency((spot?.totalUsd || 0) + activeEquity))}
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                ≈ {hideBalances ? '••••' : Number(spot?.totalBtc || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })} BTC in spot
              </div>
              {/* Hybrid breakdown: spot wallet + trading + earn */}
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                  <Coins className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Spot Wallet</span>
                  <span className="text-xs font-semibold text-foreground">{masked(formatCurrency(spot?.totalUsd))}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Trading</span>
                  <span className="text-xs font-semibold text-foreground">{masked(formatCurrency(activeEquity))}</span>
                </div>
                <button onClick={() => router.push('/earn')} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 transition-colors hover:border-emerald-500/30">
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">Earn</span>
                  <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-400/15 px-1.5 py-0.5 rounded">Soon</span>
                </button>
              </div>
              {/* Allocation Donut Chart */}
              {(spot?.balances || []).length > 0 && (
                <div className="mt-5 pt-5 border-t border-border/50">
                  <div className="text-xs text-muted-foreground mb-3 font-medium">Portfolio Allocation</div>
                  <div className="flex items-center gap-6">
                    <svg width="80" height="80" viewBox="0 0 100 100" className="flex-shrink-0">
                      {(() => {
                        const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4']
                        let start = 0
                        const total = spot?.totalUsd || 1
                        return (spot?.balances || []).slice(0, 6).map((b, i) => {
                          const pct = Math.min(100, (Number(b.valueUsd || 0) / total) * 100)
                          const dash = pct * 2.83
                          const gap = 283 - dash
                          const el = (
                            <circle key={b.asset} cx="50" cy="50" r="45" fill="none"
                              stroke={colors[i % colors.length]} strokeWidth="10"
                              strokeDasharray={`${dash} ${gap}`}
                              strokeDashoffset={-start * 2.83}
                              transform="rotate(-90 50 50)"
                              style={{ transition: 'stroke-dasharray 0.5s ease' }}
                            />
                          )
                          start += pct
                          return el
                        })
                      })()}
                    </svg>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                      {(spot?.balances || []).slice(0, 6).map((b, i) => {
                        const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4']
                        const pct = spot?.totalUsd ? Math.min(100, (Number(b.valueUsd || 0) / spot.totalUsd) * 100) : 0
                        return (
                          <div key={b.asset} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="text-muted-foreground">{b.asset}</span>
                            <span className="font-semibold text-foreground">{pct.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5">
                <Button onClick={() => router.push('/wallet/deposit')} size="sm" className="bg-emerald-300 hover:bg-emerald-400 text-black font-semibold w-full">
                  <Plus className="h-4 w-4 mr-1" /> Deposit
                </Button>
                <Button onClick={() => router.push('/wallet/withdraw')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ArrowUpFromLine className="h-4 w-4 mr-1" /> Withdraw
                </Button>
                <Button onClick={() => router.push('/wallet/convert')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ArrowDownUp className="h-4 w-4 mr-1" /> Convert
                </Button>
                <Button onClick={() => router.push('/wallet/send')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <Send className="h-4 w-4 mr-1" /> Send
                </Button>
                <Button onClick={() => router.push('/wallet/receive')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ArrowDownToLine className="h-4 w-4 mr-1" /> Receive
                </Button>
                <Button onClick={() => router.push('/wallet/history')} size="sm" className="w-full bg-muted/40 hover:bg-muted/60 text-foreground border border-border">
                  <HistoryIcon className="h-4 w-4 mr-1" /> History
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border">
                    <th className="text-left p-4">Coin</th>
                    <th className="text-right p-4">Amount</th>
                    <th className="text-right p-4">Price</th>
                    <th className="text-right p-4">USD Value</th>
                    <th className="text-right p-4 hidden sm:table-cell">Allocation</th>
                    <th className="text-right p-4 hidden md:table-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(spot?.balances || []).map(b => {
                    const sparkline = b.sparkline || Array.from({ length: 20 }, (_, i) => 50 + Math.sin(i * 0.5) * 20 + Math.random() * 10)
                    const sparkMin = Math.min(...sparkline)
                    const sparkMax = Math.max(...sparkline)
                    const sparkRange = sparkMax - sparkMin || 1
                    const sparkPath = sparkline.map((v, i) => {
                      const x = (i / (sparkline.length - 1)) * 60
                      const y = 20 - ((v - sparkMin) / sparkRange) * 16
                      return `${i === 0 ? 'M' : 'L'}${x},${y}`
                    }).join(' ')
                    const sparkUp = sparkline[sparkline.length - 1] >= sparkline[0]
                    return (
                      <tr key={b.asset} className="border-b border-border/60 hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/wallet/asset/${b.asset}`)}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-300 text-xs font-bold">
                              {b.asset.slice(0, 3)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{b.asset}</div>
                              <div className="text-muted-foreground text-xs">{b.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right text-sm text-foreground font-medium">
                          {masked(Number(b.balance || 0).toLocaleString('en-US', { maximumFractionDigits: 8 }))}
                        </td>
                        <td className="p-4 text-right text-sm text-muted-foreground">
                          {b.stable ? '$1.00' : masked(formatCurrency(b.priceUsd))}
                        </td>
                        <td className="p-4 text-right text-sm text-foreground font-medium">
                          {masked(formatCurrency(b.valueUsd))}
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <svg width="60" height="20" viewBox="0 0 60 20" className="flex-shrink-0">
                              <path d={sparkPath} fill="none" stroke={sparkUp ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {(() => {
                              const pct = spot?.totalUsd ? Math.min(100, (Number(b.valueUsd || 0) / spot.totalUsd) * 100) : 0
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              )
                            })()}
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button title="Convert" onClick={() => router.push('/wallet/convert')} className="p-1.5 rounded-md text-muted-foreground transition-colors hover:text-emerald-300 hover:bg-emerald-500/10"><ArrowDownUp className="h-3.5 w-3.5" /></button>
                            <button title="Send" onClick={() => router.push('/wallet/send')} className="p-1.5 rounded-md text-muted-foreground transition-colors hover:text-emerald-300 hover:bg-emerald-500/10"><Send className="h-3.5 w-3.5" /></button>
                            <button title="Receive" onClick={() => router.push('/wallet/receive')} className="p-1.5 rounded-md text-muted-foreground transition-colors hover:text-emerald-300 hover:bg-emerald-500/10"><ArrowDownToLine className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {(!spot || spot.balances?.length === 0) && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Loading balances…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Trading Account (Real / Demo) */}
          <h2 className="text-base font-semibold text-foreground mb-3">Trading Account</h2>
          {/* Dual Wallet Cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {/* Real Wallet */}
            <Card className="bg-card border-emerald-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
              <CardContent className="p-5 relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold text-sm">Real Wallet</div>
                    <div className="text-muted-foreground text-xs">Funded via verified deposit</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mb-4">{masked(formatCurrency(realBalance))}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => router.push('/wallet/deposit')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                    size="sm"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Deposit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => router.push('/wallet/withdraw')}
                    size="sm"
                    className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                  >
                    <ArrowDownRight className="h-4 w-4" />
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Demo Wallet */}
            <Card className="bg-card border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8" />
              <CardContent className="p-5 relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Gamepad2 className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-foreground font-semibold text-sm">Demo Wallet</div>
                    <div className="text-muted-foreground text-xs">Virtual funds for risk-free trading</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mb-4">{masked(formatCurrency(demoBalance))}</div>
                {successMsg && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs mb-3 bg-emerald-500/10 rounded-lg px-3 py-2">
                    <CheckCircle className="h-3 w-3 flex-shrink-0" />
                    {successMsg}
                  </div>
                )}
                <Button
                  onClick={requestDemoFunds}
                  disabled={requesting}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                >
                  {requesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Reset +$100,000 Demo Funds
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Stats Row */}
          <div className="mb-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 text-xs font-medium w-fit ${activeMode === 'DEMO' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
              {activeMode === 'DEMO' ? '🎯 Showing Demo Account stats' : '💼 Showing Real Account stats'}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                  <span className="text-muted-foreground text-xs">Active Equity</span>
                </div>
                <div className="text-lg font-bold text-foreground">{masked(formatCurrency(activeEquity))}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {(account?.realizedPnl || 0) >= 0
                    ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                    : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                  <span className="text-muted-foreground text-xs">Realized P&L</span>
                </div>
                <div className={`text-lg font-bold ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{masked(formatCurrency(account?.realizedPnl))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-purple-400" />
                  <span className="text-muted-foreground text-xs">Open P&L</span>
                </div>
                <div className={`text-lg font-bold ${(account?.openPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(account?.openPnl || 0) >= 0 ? '+' : ''}{masked(formatCurrency(account?.openPnl))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger History */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-base">Transaction History</CardTitle>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${ledgerMode === 'REAL' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {ledgerMode === 'REAL' ? '💼 Real Wallet' : '🎯 Demo Wallet'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-muted-foreground text-xs border-b border-border">
                        <th className="text-left p-4">Type</th>
                        <th className="text-left p-4">Description</th>
                        <th className="text-right p-4">Amount</th>
                        <th className="text-right p-4">Balance After</th>
                        <th className="text-right p-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(entry => (
                        <tr key={entry.id} className="border-b border-border/60 hover:bg-muted/40">
                          <td className="p-4">
                            <span className={`text-sm font-medium ${entryTypeColor(entry.type)}`}>
                              {entryTypeLabel(entry.type)}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">{entry.description || '—'}</td>
                          <td className={`p-4 text-right text-sm font-medium ${entry.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                          </td>
                          <td className="p-4 text-right text-foreground text-sm">{formatCurrency(entry.balance)}</td>
                          <td className="p-4 text-right text-muted-foreground text-xs">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
