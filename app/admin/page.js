'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  BarChart3,
  Menu,
  Shield,
  Users,
  Activity,
  DollarSign,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  // Force close state
  const [forceClosePositionId, setForceClosePositionId] = useState('')
  const [forceCloseLoading, setForceCloseLoading] = useState(false)
  const [forceCloseMsg, setForceCloseMsg] = useState(null)

  // Override P&L state
  const [adjustUserId, setAdjustUserId] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      if (user.role !== 'ADMIN') {
        router.push('/dashboard')
        return
      }
      loadData()
    }
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
      const [usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-log')
      ])
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users || [])
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAuditLog(auditData.log || [])
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleForceClose = async (e) => {
    e.preventDefault()
    setForceCloseMsg(null)
    setForceCloseLoading(true)
    try {
      const res = await fetch('/api/admin/force-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: forceClosePositionId })
      })
      const data = await res.json()
      if (res.ok) {
        setForceCloseMsg({ type: 'success', text: data.message || 'Position force-closed successfully.' })
        setForceClosePositionId('')
        loadData()
      } else {
        setForceCloseMsg({ type: 'error', text: data.error || 'Failed to force close position.' })
      }
    } catch {
      setForceCloseMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setForceCloseLoading(false)
    }
  }

  const handleAdjustPnl = async (e) => {
    e.preventDefault()
    setAdjustMsg(null)
    setAdjustLoading(true)
    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: adjustUserId,
          amount: parseFloat(adjustAmount),
          reason: adjustReason
        })
      })
      const data = await res.json()
      if (res.ok) {
        setAdjustMsg({ type: 'success', text: data.message || 'Balance adjusted successfully.' })
        setAdjustUserId('')
        setAdjustAmount('')
        setAdjustReason('')
        loadData()
      } else {
        setAdjustMsg({ type: 'error', text: data.error || 'Failed to adjust balance.' })
      }
    } catch {
      setAdjustMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setAdjustLoading(false)
    }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(value || 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (user?.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar
        currentPage="/admin"
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
            <span className="font-bold text-white text-sm">Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="h-6 w-6 text-amber-400" />
                Admin Dashboard
              </h1>
              <p className="text-slate-400 text-sm mt-1">Platform management and oversight</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing}
              className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-400" />
                  <div>
                    <div className="text-slate-400 text-xs">Total Users</div>
                    <div className="text-xl font-bold text-white">{users.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  <div>
                    <div className="text-slate-400 text-xs">Audit Events</div>
                    <div className="text-xl font-bold text-white">{auditLog.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20 col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-amber-400" />
                  <div>
                    <div className="text-amber-400/70 text-xs">Admin Mode</div>
                    <div className="text-amber-400 font-bold text-sm">ACTIVE</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Actions */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Force Close Position */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <X className="h-5 w-5 text-red-400" />
                  Force Close Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-4">
                  Force-close any open position by its ID. This will close the position at the current market price and log an audit entry.
                </p>
                <form onSubmit={handleForceClose} className="space-y-3">
                  <Input
                    value={forceClosePositionId}
                    onChange={e => setForceClosePositionId(e.target.value)}
                    placeholder="Position UUID"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  {forceCloseMsg && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                      forceCloseMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {forceCloseMsg.type === 'success'
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                      {forceCloseMsg.text}
                    </div>
                  )}
                  <Button type="submit" disabled={forceCloseLoading}
                    className="bg-red-600 hover:bg-red-700 text-white w-full">
                    {forceCloseLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Force Close
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Adjust User Balance */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-400" />
                  Adjust User Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-4">
                  Add or subtract virtual funds from a user's account. Creates an ADMIN_ADJUSTMENT ledger entry.
                </p>
                <form onSubmit={handleAdjustPnl} className="space-y-3">
                  <Input
                    value={adjustUserId}
                    onChange={e => setAdjustUserId(e.target.value)}
                    placeholder="Target User UUID"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  <Input
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    placeholder="Amount (use negative to subtract)"
                    type="number"
                    step="0.01"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Input
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  {adjustMsg && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                      adjustMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {adjustMsg.type === 'success'
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                      {adjustMsg.text}
                    </div>
                  )}
                  <Button type="submit" disabled={adjustLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white w-full">
                    {adjustLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply Adjustment
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Tabs: Users | Audit Log */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'users' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'audit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Audit Log ({auditLog.length})
            </button>
          </div>

          {/* Users Table */}
          {activeTab === 'users' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                {users.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Email</th>
                          <th className="text-left p-4">Role</th>
                          <th className="text-right p-4">Balance</th>
                          <th className="text-right p-4">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-4">
                              <div className="text-white text-sm">{u.email}</div>
                              <div className="text-slate-500 text-xs font-mono">{u.id}</div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                u.role === 'ADMIN'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {u.role || 'USER'}
                              </span>
                            </td>
                            <td className="p-4 text-right text-white text-sm">
                              {u.balance !== null ? formatCurrency(u.balance) : '—'}
                            </td>
                            <td className="p-4 text-right text-slate-500 text-xs">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Log */}
          {activeTab === 'audit' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardContent className="p-0">
                {auditLog.length === 0 ? (
                  <div className="text-center py-10">
                    <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No audit entries yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Action</th>
                          <th className="text-left p-4">Admin</th>
                          <th className="text-left p-4">Target</th>
                          <th className="text-right p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map(entry => (
                          <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-4">
                              <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                                {entry.action}
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 text-xs font-mono">{entry.admin_email || entry.admin_id}</td>
                            <td className="p-4 text-slate-400 text-xs font-mono">{entry.target_id || '—'}</td>
                            <td className="p-4 text-right text-slate-500 text-xs">
                              {new Date(entry.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
