'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowRight
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [account, setAccount] = useState(null)
  const [ledger, setLedger] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [accountRes, ledgerRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/ledger')
      ])
      const accountData = await accountRes.json()
      const ledgerData = await ledgerRes.json()
      setAccount(accountData)
      setLedger(ledgerData.entries || [])
    } catch (err) {
      console.error('Failed to load wallet data:', err)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const requestDemoFunds = async () => {
    setRequesting(true)
    setSuccessMsg('')
    try {
      const res = await fetch('/api/wallet/request-funds', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`$${data.amount?.toLocaleString()} demo funds added to your account!`)
        await loadData()
      } else {
        setSuccessMsg(data.error || 'Failed to request funds.')
      }
    } catch {
      setSuccessMsg('Failed to request funds.')
    } finally {
      setRequesting(false)
      setTimeout(() => setSuccessMsg(''), 5000)
    }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(value || 0)

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
      TRADE_BUY: 'Trade Buy',
      TRADE_SELL: 'Trade Sell',
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

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar
        currentPage="/wallet"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

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
              <h1 className="text-xl sm:text-2xl font-bold text-white">Wallet</h1>
              <p className="text-slate-400 text-sm">Virtual balance and ledger history</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="text-slate-400 text-sm">Cash Balance</span>
                </div>
                <div className="text-2xl font-bold text-white">{formatCurrency(account?.balance)}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="text-slate-400 text-sm">Total Equity</span>
                </div>
                <div className="text-2xl font-bold text-white">{formatCurrency(account?.equity)}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 ${(account?.realizedPnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                    {(account?.realizedPnl || 0) >= 0
                      ? <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                      : <ArrowDownRight className="h-5 w-5 text-red-500" />}
                  </div>
                  <span className="text-slate-400 text-sm">Realized P&L</span>
                </div>
                <div className={`text-2xl font-bold ${(account?.realizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {(account?.realizedPnl || 0) >= 0 ? '+' : ''}{formatCurrency(account?.realizedPnl)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Request Demo Funds */}
          <Card className="bg-[#161b22] border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-base">Add Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Fund your account via crypto deposit, or request demo funds to practise.
              </p>
              {successMsg && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm mb-4 bg-emerald-500/10 rounded-lg px-4 py-3">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {successMsg}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.push('/wallet/deposit')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Deposit Funds
                </Button>
                <Button
                  onClick={requestDemoFunds}
                  disabled={requesting}
                  variant="ghost"
                  className="text-slate-400 hover:text-white border border-slate-700"
                >
                  {requesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add $10,000 Demo Funds
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ledger History */}
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Transaction Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <div className="text-center py-10">
                  <Wallet className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No ledger entries yet</p>
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
