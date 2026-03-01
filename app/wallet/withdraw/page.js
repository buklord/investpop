'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppSidebar from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Menu,
  ArrowLeft,
  Loader2,
  ArrowDownRight,
  ShieldCheck
} from 'lucide-react'

export default function WithdrawPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [account, setAccount] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])

  const [method, setMethod] = useState('BTC')
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

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
      const [accountRes, withdrawalsRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/wallet/withdrawals')
      ])

      if (accountRes.ok) {
        const accountData = await accountRes.json()
        setAccount(accountData)
      }

      if (withdrawalsRes.ok) {
        const w = await withdrawalsRes.json()
        setWithdrawals(w.withdrawals || [])
      }
    } catch (err) {
      console.error('Failed to load withdrawal data:', err)
    }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0)

  const statusPill = (s) => {
    if (s === 'APPROVED') return 'text-emerald-400 bg-emerald-500/10'
    if (s === 'REJECTED') return 'text-red-400 bg-red-500/10'
    if (s === 'PROCESSING') return 'text-blue-400 bg-blue-500/10'
    return 'text-amber-400 bg-amber-500/10'
  }

  const realBalance = account?.realBalance ?? 0

  const submitWithdrawal = async (e) => {
    e.preventDefault()
    setMsg(null)

    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid withdrawal amount.' })
      return
    }
    if (numAmount > realBalance) {
      setMsg({ type: 'error', text: 'Amount exceeds your Real Wallet balance.' })
      return
    }
    if (!address.trim()) {
      setMsg({ type: 'error', text: 'Enter a withdrawal address.' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, method, address: address.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: data.message || 'Withdrawal request submitted.' })
        setAmount('')
        setAddress('')
        await loadData()
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to submit withdrawal request.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
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
      <AppSidebar currentPage="/wallet" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm leading-none">K</span>
            </div>
            <span className="font-bold text-white text-sm">Withdraw</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <Link href="/wallet" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet
          </Link>

          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Withdraw Funds</h1>
          <p className="text-slate-400 text-sm mb-6">
            Requests are reviewed by an admin. Your Real Wallet balance is deducted only after approval.
          </p>

          <Card className="bg-[#161b22] border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Withdrawal Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {msg && (
                <div className={`text-sm px-3 py-2.5 rounded-lg ${msg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {msg.text}
                </div>
              )}

              <form onSubmit={submitWithdrawal} className="space-y-3">
                <div className="flex gap-2">
                  {['BTC', 'USDT'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${method === m ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    max={realBalance}
                    placeholder="Amount (USD)"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={method === 'BTC' ? 'BTC address' : 'USDT address'}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="text-slate-500 text-xs">
                  Available to withdraw: <span className="text-slate-300 font-medium">{formatCurrency(realBalance)}</span>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownRight className="h-4 w-4 mr-2" />}
                  Submit Withdrawal Request
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Recent withdrawal requests</CardTitle>
            </CardHeader>
            <CardContent>
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
