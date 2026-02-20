'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  RefreshCw,
  Eye,
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function UserShadowPage() {
  const router = useRouter()
  const params = useParams()
  const targetUserId = params.id

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [positions, setPositions] = useState([])
  const [balance, setBalance] = useState(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [targetEmail, setTargetEmail] = useState('')

  const [settlingId, setSettlingId] = useState(null)
  const [toast, setToast] = useState(null)

  const [editBalance, setEditBalance] = useState(false)
  const [newBalance, setNewBalance] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      if (data.user?.role !== 'ADMIN') { router.push('/dashboard'); return }
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadPositions = useCallback(async () => {
    if (!targetUserId) return
    setDataLoading(true)
    try {
      const res = await fetch(`/api/admin/user-positions?userId=${targetUserId}`)
      if (res.ok) {
        const data = await res.json()
        setPositions(data.positions || [])
        setBalance(data.balance ?? null)
      }
    } catch (err) {
      console.error('Failed to load positions:', err)
    } finally {
      setDataLoading(false)
    }
  }, [targetUserId])

  // Load user email from admin users list
  useEffect(() => {
    if (!user || !targetUserId) return
    loadPositions()
    fetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => {
      const u = d?.users?.find(u => u.id === targetUserId)
      if (u) setTargetEmail(u.email)
    }).catch(err => { console.error('Failed to fetch user email:', err) })
  }, [user, loadPositions, targetUserId])

  const handleSettle = async (positionId, outcome) => {
    setSettlingId(`${positionId}-${outcome}`)
    try {
      const res = await fetch('/api/admin/force-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, outcome })
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', text: `Position settled as ${outcome}. P&L: $${data.targetPnl?.toFixed(2) ?? '?'}` })
        await loadPositions()
      } else {
        setToast({ type: 'error', text: data.error || 'Settlement failed.' })
      }
    } catch {
      setToast({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSettlingId(null)
    }
  }

  const handleAdjustBalance = async (e) => {
    e.preventDefault()
    const parsedBalance = parseFloat(newBalance)
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setToast({ type: 'error', text: 'Please enter a valid balance amount.' })
      return
    }
    setAdjustLoading(true)
    try {
      const delta = parsedBalance - (balance || 0)
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, amount: delta, reason: adjustReason || 'Admin balance edit' })
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', text: 'Balance updated.' })
        setEditBalance(false)
        setNewBalance('')
        setAdjustReason('')
        await loadPositions()
      } else {
        setToast({ type: 'error', text: data.error || 'Failed to update balance.' })
      }
    } catch (err) {
      console.error('Failed to adjust balance:', err)
      setToast({ type: 'error', text: 'An error occurred.' })
    } finally {
      setAdjustLoading(false)
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  if (user?.role !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/admin" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}
            className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Admin
          </Button>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-400" />
            <h1 className="text-xl font-bold text-white">User Shadow View</h1>
          </div>
          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs font-medium border border-purple-500/20">
            ADMIN SHADOWING
          </span>
          <Button variant="ghost" size="sm" onClick={loadPositions} disabled={dataLoading}
            className="ml-auto text-slate-400 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* User Info + Balance */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Card className="bg-[#161b22] border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-slate-400 text-xs">Shadowing User</div>
                <div className="text-white font-medium truncate">{targetEmail || 'Loading…'}</div>
                <div className="text-slate-500 text-xs font-mono truncate">{targetUserId}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#161b22] border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-400 text-xs">Account Balance</span>
                </div>
                {!editBalance && (
                  <Button variant="ghost" size="sm"
                    onClick={() => { setEditBalance(true); setNewBalance(balance?.toFixed(2) || '0') }}
                    className="text-amber-400 hover:text-amber-300 text-xs h-6 px-2">
                    Edit
                  </Button>
                )}
              </div>
              {editBalance ? (
                <form onSubmit={handleAdjustBalance} className="flex gap-2 mt-2 flex-wrap">
                  <Input value={newBalance} onChange={e => setNewBalance(e.target.value)}
                    type="number" step="0.01" required placeholder="New balance"
                    className="bg-slate-800 border-slate-700 text-white h-8 text-sm w-28 flex-shrink-0" />
                  <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="bg-slate-800 border-slate-700 text-white h-8 text-sm flex-1 min-w-[120px]" />
                  <Button type="submit" disabled={adjustLoading} size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
                    {adjustLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditBalance(false)}
                    className="text-slate-400 h-8 text-xs">
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="text-2xl font-bold text-white">
                  {balance !== null ? formatCurrency(balance) : '—'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Positions */}
        <Card className="bg-[#161b22] border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              Active Positions
              <span className="text-slate-500 text-xs font-normal">({positions.length} open)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dataLoading && positions.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-10">
                <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No open positions for this user</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-slate-800">
                      <th className="text-left p-4">Instrument</th>
                      <th className="text-left p-4">Side</th>
                      <th className="text-right p-4">Qty</th>
                      <th className="text-right p-4">Entry Price</th>
                      <th className="text-right p-4">Cost (Notional)</th>
                      <th className="text-right p-4">Projected P&amp;L</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => {
                      const entryPrice = parseFloat(pos.entry_price)
                      const qty = parseFloat(pos.quantity)
                      const notional = entryPrice * qty
                      const profitPnl = notional * 0.10
                      const lossPnl = notional * 0.05
                      return (
                        <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="p-4">
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                              {pos.symbol}
                            </span>
                            <div className="text-slate-600 text-xs font-mono mt-1 truncate max-w-[140px]">{pos.id}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              pos.side === 'LONG' || !pos.side
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {pos.side || 'LONG'}
                            </span>
                          </td>
                          <td className="p-4 text-right text-white text-sm">{qty}</td>
                          <td className="p-4 text-right text-white text-sm">{formatCurrency(entryPrice)}</td>
                          <td className="p-4 text-right text-white text-sm">{formatCurrency(notional)}</td>
                          <td className="p-4 text-right">
                            <div className="text-emerald-400 text-xs">+{formatCurrency(profitPnl)}</div>
                            <div className="text-red-400 text-xs">−{formatCurrency(lossPnl)}</div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" disabled={settlingId !== null}
                                onClick={() => handleSettle(pos.id, 'PROFIT')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2">
                                {settlingId === `${pos.id}-PROFIT`
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <><TrendingUp className="h-3 w-3 mr-1 inline" />Force Profit</>}
                              </Button>
                              <Button size="sm" disabled={settlingId !== null}
                                onClick={() => handleSettle(pos.id, 'LOSS')}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2">
                                {settlingId === `${pos.id}-LOSS`
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <><TrendingDown className="h-3 w-3 mr-1 inline" />Force Loss</>}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
