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
  Coins
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

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

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

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
      const [accountRes, ledgerRes, spotRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/ledger'),
        fetch('/api/wallet/balances')
      ])
      const accountData = await accountRes.json()
      const ledgerData = await ledgerRes.json()
      setAccount(accountData)
      if (spotRes.ok) setSpot(await spotRes.json())
      setLedger(ledgerData.entries || [])
      setLedgerMode(ledgerData.mode || accountData?.tradingMode || 'REAL')
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

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-foreground text-sm">Kartomtrades</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-muted-foreground p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Wallets</h1>
              <p className="text-muted-foreground text-sm">Manage your Real and Demo accounts</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Spot Wallet (Binance-style multi-asset) */}
          <Card className="bg-card border-border mb-6 overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-emerald-400" />
                <span className="text-muted-foreground text-sm">Spot Wallet · Estimated Balance</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">
                {formatCurrency(spot?.totalUsd)}
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                ≈ {Number(spot?.totalBtc || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })} BTC
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                <Button onClick={() => router.push('/wallet/receive')} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
                  <ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit
                </Button>
                <Button onClick={() => router.push('/wallet/send')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <Send className="h-4 w-4 mr-1" /> Send
                </Button>
                <Button onClick={() => router.push('/wallet/convert')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ArrowDownUp className="h-4 w-4 mr-1" /> Convert
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
                  </tr>
                </thead>
                <tbody>
                  {(spot?.balances || []).map(b => (
                    <tr key={b.asset} className="border-b border-border/60 hover:bg-muted/40">
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
                        {Number(b.balance || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                      </td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {b.stable ? '$1.00' : formatCurrency(b.priceUsd)}
                      </td>
                      <td className="p-4 text-right text-sm text-foreground font-medium">
                        {formatCurrency(b.valueUsd)}
                      </td>
                    </tr>
                  ))}
                  {(!spot || spot.balances?.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">Loading balances…</td></tr>
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
                <div className="text-3xl font-bold text-foreground mb-4">{formatCurrency(realBalance)}</div>
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
                <div className="text-3xl font-bold text-foreground mb-4">{formatCurrency(demoBalance)}</div>
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
                <div className="text-lg font-bold text-foreground">{formatCurrency(activeEquity)}</div>
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
                  {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.realizedPnl)}
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
                  {(account?.openPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.openPnl)}
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
