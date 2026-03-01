'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  BarChart3,
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
  Gamepad2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function WalletPage() {
  const router = useRouter()
  const withdrawSectionRef = useRef(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [account, setAccount] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerMode, setLedgerMode] = useState('DEMO')
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [withdrawMethod, setWithdrawMethod] = useState('BTC')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])

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
      const [accountRes, ledgerRes, withdrawalsRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/ledger'),
        fetch('/api/wallet/withdrawals')
      ])
      const accountData = await accountRes.json()
      const ledgerData = await ledgerRes.json()
      setAccount(accountData)
      setLedger(ledgerData.entries || [])
      setLedgerMode(ledgerData.mode || accountData?.tradingMode || 'DEMO')

      if (withdrawalsRes.ok) {
        const w = await withdrawalsRes.json()
        setWithdrawals(w.withdrawals || [])
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
        setSuccessMsg(`$${data.amount?.toLocaleString()} demo funds added to your practice account!`)
        await loadData()
      } else {
        setSuccessMsg(data.error || 'Failed to request funds.')
      }
    } catch { setSuccessMsg('Failed to request funds.') }
    finally { setRequesting(false); setTimeout(() => setSuccessMsg(''), 5000) }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0)

  const scrollToWithdraw = () => {
    withdrawSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submitWithdrawal = async (e) => {
    e.preventDefault()
    setWithdrawMsg(null)

    const numAmount = parseFloat(withdrawAmount)
    if (!withdrawAmount || isNaN(numAmount) || numAmount <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Enter a valid withdrawal amount.' })
      return
    }
    if (numAmount > (account?.realBalance ?? 0)) {
      setWithdrawMsg({ type: 'error', text: 'Amount exceeds your Real Wallet balance.' })
      return
    }
    if (!withdrawAddress.trim()) {
      setWithdrawMsg({ type: 'error', text: 'Enter a withdrawal address.' })
      return
    }

    setWithdrawSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, method: withdrawMethod, address: withdrawAddress.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setWithdrawMsg({ type: 'success', text: data.message || 'Withdrawal request submitted.' })
        setWithdrawAmount('')
        setWithdrawAddress('')
        await loadData()
      } else {
        setWithdrawMsg({ type: 'error', text: data.error || 'Failed to submit withdrawal request.' })
      }
    } catch {
      setWithdrawMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  const statusPill = (s) => {
    if (s === 'APPROVED') return 'text-emerald-400 bg-emerald-500/10'
    if (s === 'REJECTED') return 'text-red-400 bg-red-500/10'
    if (s === 'PROCESSING') return 'text-blue-400 bg-blue-500/10'
    return 'text-amber-400 bg-amber-500/10'
  }

  const entryTypeColor = (type) => {
    switch (type) {
      case 'DEPOSIT': return 'text-emerald-500'
      case 'TRADE_SELL': return 'text-emerald-500'
      case 'ADMIN_ADJUSTMENT': return 'text-amber-400'
      case 'TRADE_BUY': return 'text-red-500'
      case 'FEE': return 'text-red-500'
      case 'WITHDRAWAL': return 'text-red-500'
      default: return 'text-slate-400'
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
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const realBalance = account?.realBalance ?? 0
  const demoBalance = account?.demoBalance ?? 0

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">InvestPop</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">My Wallets</h1>
              <p className="text-slate-400 text-sm">Manage your Real and Practice accounts</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Dual Wallet Cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {/* Real Wallet */}
            <Card className="bg-[#161b22] border-emerald-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-8 translate-x-8" />
              <CardContent className="p-5 relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Real Wallet</div>
                    <div className="text-slate-500 text-xs">Funded via verified deposit</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-4">{formatCurrency(realBalance)}</div>
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
                    onClick={scrollToWithdraw}
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
            <Card className="bg-[#161b22] border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8" />
              <CardContent className="p-5 relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Gamepad2 className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Practice Wallet</div>
                    <div className="text-slate-500 text-xs">Virtual funds for risk-free trading</div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-4">{formatCurrency(demoBalance)}</div>
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
                  Reset +$10,000 Demo Funds
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Withdraw Funds */}
          <Card ref={withdrawSectionRef} className="bg-[#161b22] border-slate-800 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Withdraw Funds</CardTitle>
              <p className="text-slate-400 text-sm">Requests are reviewed by an admin. Your Real Wallet balance is deducted only after approval.</p>
            </CardHeader>
            <CardContent>
              {withdrawMsg && (
                <div className={`mb-4 text-sm px-3 py-2.5 rounded-lg ${withdrawMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {withdrawMsg.text}
                </div>
              )}

              <form onSubmit={submitWithdrawal} className="space-y-3">
                <div className="flex gap-2">
                  {['BTC', 'USDT'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWithdrawMethod(m)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${withdrawMethod === m ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    max={realBalance}
                    placeholder="Amount (USD)"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Input
                    value={withdrawAddress}
                    onChange={e => setWithdrawAddress(e.target.value)}
                    placeholder={withdrawMethod === 'BTC' ? 'BTC address' : 'USDT address'}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="text-slate-500 text-xs">Available to withdraw: <span className="text-slate-300 font-medium">{formatCurrency(realBalance)}</span></div>

                <Button
                  type="submit"
                  disabled={withdrawSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {withdrawSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Submit Withdrawal Request
                </Button>
              </form>

              <div className="mt-6">
                <div className="text-slate-400 text-xs mb-2">Recent withdrawal requests</div>
                {withdrawals.length === 0 ? (
                  <div className="text-slate-500 text-sm">No withdrawal requests yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-3">Method</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Address</th>
                          <th className="text-center p-3">Status</th>
                          <th className="text-right p-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(w => (
                          <tr key={w.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-3 text-white text-sm font-medium">{w.method}</td>
                            <td className="p-3 text-right text-white text-sm">{formatCurrency(w.amount)}</td>
                            <td className="p-3 text-slate-400 text-xs font-mono truncate max-w-[320px]">{w.address}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${statusPill(w.status)}`}>{w.status}</span>
                            </td>
                            <td className="p-3 text-right text-slate-500 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-400 text-xs">Total Equity</span>
                </div>
                <div className="text-lg font-bold text-white">{formatCurrency(account?.equity)}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {(account?.realizedPnl || 0) >= 0
                    ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                    : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                  <span className="text-slate-400 text-xs">Realized P&L</span>
                </div>
                <div className={`text-lg font-bold ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.realizedPnl)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-purple-400" />
                  <span className="text-slate-400 text-xs">Open P&L</span>
                </div>
                <div className={`text-lg font-bold ${(account?.openPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(account?.openPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.openPnl)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger History */}
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Transaction History</CardTitle>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${ledgerMode === 'REAL' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {ledgerMode === 'REAL' ? '💼 Real Wallet' : '🎯 Practice Wallet'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-800">
                        <th className="text-left p-4">Type</th>
                        <th className="text-left p-4">Description</th>
                        <th className="text-right p-4">Amount</th>
                        <th className="text-right p-4">Balance After</th>
                        <th className="text-right p-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(entry => (
                        <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="p-4">
                            <span className={`text-sm font-medium ${entryTypeColor(entry.type)}`}>
                              {entryTypeLabel(entry.type)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-sm">{entry.description || '—'}</td>
                          <td className={`p-4 text-right text-sm font-medium ${entry.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                          </td>
                          <td className="p-4 text-right text-white text-sm">{formatCurrency(entry.balance)}</td>
                          <td className="p-4 text-right text-slate-500 text-xs">
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
