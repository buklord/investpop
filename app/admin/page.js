'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  RefreshCw,
  Radio,
  TrendingUp,
  TrendingDown,
  UserX,
  UserCheck,
  Zap,
  Inbox,
  MonitorPlay,
  Eye,
  Crown,
  KeyRound,
  Trash2,
  TrendingUp as BullIcon,
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [activityFeed, setActivityFeed] = useState([])
  const [systemSettings, setSystemSettings] = useState({ broadcast_message: '', spread_multiplier: '1.0', market_trend: 'NEUTRAL' })
  const [deposits, setDeposits] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  // Market trend state
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendMsg, setTrendMsg] = useState(null)

  // Force close state
  const [forceClosePositionId, setForceClosePositionId] = useState('')
  const [forceSettlePercent, setForceSettlePercent] = useState('')
  const [forceCloseLoading, setForceCloseLoading] = useState(false)
  const [forceCloseMsg, setForceCloseMsg] = useState(null)

  // Adjust balance state
  const [adjustUserId, setAdjustUserId] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState(null)

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState(null)

  // Spread multiplier state
  const [spreadValue, setSpreadValue] = useState('1.0')
  const [spreadLoading, setSpreadLoading] = useState(false)
  const [spreadMsg, setSpreadMsg] = useState(null)

  // Suspend state
  const [suspendMsg, setSuspendMsg] = useState(null)
  const [suspendingId, setSuspendingId] = useState(null)

  // Deposit state
  const [depositMsg, setDepositMsg] = useState(null)
  const [depositActionId, setDepositActionId] = useState(null)

  // Withdrawal state
  const [withdrawalMsg, setWithdrawalMsg] = useState(null)
  const [withdrawalActionId, setWithdrawalActionId] = useState(null)

  // Force settle state
  const [settleMsg, setSettleMsg] = useState(null)
  const [settlingId, setSettlingId] = useState(null)

  // Live positions state
  const [livePositions, setLivePositions] = useState([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [toast, setToast] = useState(null)
  // Per-position custom close price (map: positionId → price string)
  const [customPrices, setCustomPrices] = useState({})

  // KYC state
  const [kycRequests, setKycRequests] = useState([])
  const [kycActionId, setKycActionId] = useState(null)
  const [kycMsg, setKycMsg] = useState(null)

  // Market Control state
  const [mcSettings, setMcSettings] = useState({ volatility: 0.3, trendBias: 'NEUTRAL', spreadPips: 2 })
  const [mcOverrideSymbol, setMcOverrideSymbol] = useState('')
  const [mcOverridePrice, setMcOverridePrice] = useState('')
  const [mcOverrideDuration, setMcOverrideDuration] = useState('10')
  const [mcLoading, setMcLoading] = useState(false)
  const [mcMsg, setMcMsg] = useState(null)
  const [mcPrices, setMcPrices] = useState({})

  // Super admin state
  const [saTargetEmail, setSaTargetEmail] = useState('')
  const [saRole, setSaRole] = useState('ADMIN')
  const [saRoleLoading, setSaRoleLoading] = useState(false)
  const [saRoleMsg, setSaRoleMsg] = useState(null)

  const [saBtcAddress, setSaBtcAddress] = useState('')
  const [saUsdtAddress, setSaUsdtAddress] = useState('')
  const [saBtcBarcode, setSaBtcBarcode] = useState('')
  const [saUsdtBarcode, setSaUsdtBarcode] = useState('')
  const [saConfigLoading, setSaConfigLoading] = useState(false)
  const [saConfigMsg, setSaConfigMsg] = useState(null)

  const [saResetEmail, setSaResetEmail] = useState('')
  const [saResetPassword, setSaResetPassword] = useState('')
  const [saResetLoading, setSaResetLoading] = useState(false)
  const [saResetMsg, setSaResetMsg] = useState(null)

  const [saDeleteEmail, setSaDeleteEmail] = useState('')
  const [saDeleteConfirm, setSaDeleteConfirm] = useState('')
  const [saDeleteLoading, setSaDeleteLoading] = useState(false)
  const [saDeleteMsg, setSaDeleteMsg] = useState(null)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => { checkAuth() }, [])
  useEffect(() => {
    if (user) {
      if (!isAdmin) { router.push('/dashboard'); return }
      loadData()
    }
  }, [user, isAdmin])

  // Auto-refresh live positions every 10 seconds
  useEffect(() => {
    if (!user || !isAdmin) return
    loadLivePositions()
    const interval = setInterval(loadLivePositions, 10000)
    return () => clearInterval(interval)
  }, [user, isAdmin])

  // Load market settings when market-control tab is opened
  useEffect(() => {
    if (activeTab === 'market-control') {
      loadMarketSettings()
      loadMarketPrices()
    }
  }, [activeTab])

  // Auto-dismiss toast after 4 seconds
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
      setUser(data.user)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadMarketSettings = async () => {
    try {
      const res = await fetch('/api/admin/market-control/settings')
      if (res.ok) {
        const data = await res.json()
        setMcSettings(data.settings || mcSettings)
      }
    } catch (e) { console.warn('loadMarketSettings', e) }
  }

  const loadMarketPrices = async () => {
    try {
      const res = await fetch('/api/market/prices')
      if (res.ok) {
        const data = await res.json()
        setMcPrices(data.prices || {})
      }
    } catch (e) { console.warn('loadMarketPrices', e) }
  }

  const handleSaveMarketSettings = async () => {
    setMcLoading(true); setMcMsg(null)
    try {
      const res = await fetch('/api/admin/market-control/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcSettings)
      })
      const data = await res.json()
      if (res.ok) setMcMsg({ type: 'success', text: 'Market settings saved!' })
      else setMcMsg({ type: 'error', text: data.error || 'Failed' })
    } catch (e) { setMcMsg({ type: 'error', text: e.message }) }
    finally { setMcLoading(false) }
  }

  const handlePriceOverride = async () => {
    if (!mcOverrideSymbol || !mcOverridePrice) return
    setMcLoading(true); setMcMsg(null)
    try {
      const res = await fetch('/api/admin/market-control/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: mcOverrideSymbol.toUpperCase(),
          price: parseFloat(mcOverridePrice),
          durationMinutes: parseInt(mcOverrideDuration) || 10
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMcMsg({ type: 'success', text: `Override set: ${mcOverrideSymbol.toUpperCase()} = $${mcOverridePrice}` })
        setMcOverrideSymbol(''); setMcOverridePrice('')
        loadMarketPrices()
      } else setMcMsg({ type: 'error', text: data.error || 'Failed' })
    } catch (e) { setMcMsg({ type: 'error', text: e.message }) }
    finally { setMcLoading(false) }
  }

  const handleTickMarket = async () => {
    try {
      const res = await fetch('/api/market/tick', { method: 'POST' })
      if (res.ok) { loadMarketPrices(); setMcMsg({ type: 'success', text: 'Market tick advanced!' }) }
    } catch (e) { }
  }

  const loadLivePositions = async () => {
    try {
      const res = await fetch('/api/admin/live-positions')
      if (res.ok) setLivePositions((await res.json()).positions || [])
    } catch (err) {
      console.error('Failed to load live positions:', err)
    }
  }

  const handleLiveSettle = async (positionId, outcome) => {
    // outcome: 'PROFIT' | 'LOSS' | 'MARKET'
    setSettlingId(`${positionId}-${outcome}`)
    try {
      const endpoint = outcome === 'MARKET' ? '/api/admin/market-close' : '/api/admin/force-settle'
      const body = outcome === 'MARKET' ? { positionId } : { positionId, outcome }
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', text: `Position ${positionId.slice(0, 8)}… settled successfully. Ledger updated.` })
        await loadLivePositions()
        await loadData()
      } else {
        setToast({ type: 'error', text: data.error || 'Settlement failed.' })
      }
    } catch {
      setToast({ type: 'error', text: 'An error occurred during settlement.' })
    } finally {
      setSettlingId(null)
    }
  }

  const handleForceCloseAtPrice = async (positionId, closePrice) => {
    if (!closePrice || isNaN(parseFloat(closePrice))) {
      setToast({ type: 'error', text: 'Enter a valid close price first.' })
      return
    }
    setSettlingId(`${positionId}-CUSTOM`)
    try {
      const res = await fetch('/api/admin/force-close', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, closePrice: parseFloat(closePrice) })
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', text: `Position closed at $${parseFloat(closePrice).toFixed(2)}. Ledger updated.` })
        setCustomPrices(p => { const n = { ...p }; delete n[positionId]; return n })
        await loadLivePositions()
        await loadData()
      } else {
        setToast({ type: 'error', text: data.error || 'Failed to close position.' })
      }
    } catch {
      setToast({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSettlingId(null)
    }
  }

  const loadData = async () => {
    setDataLoading(true)
    try {
      const [usersRes, auditRes, activityRes, settingsRes, depositsRes, withdrawalsRes, kycRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-log'),
        fetch('/api/admin/activity-feed'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/deposits'),
        fetch('/api/admin/withdrawals'),
        fetch('/api/admin/kyc-requests'),
      ])
      if (usersRes.ok) setUsers((await usersRes.json()).users || [])
      if (auditRes.ok) setAuditLog((await auditRes.json()).log || [])
      if (activityRes.ok) setActivityFeed((await activityRes.json()).feed || [])
      if (depositsRes.ok) setDeposits((await depositsRes.json()).deposits || [])
      if (withdrawalsRes.ok) setWithdrawals((await withdrawalsRes.json()).withdrawals || [])
      if (kycRes.ok) setKycRequests((await kycRes.json()).requests || [])
      if (settingsRes.ok) {
        const s = (await settingsRes.json()).settings || {}
        setSystemSettings(s)
        setBroadcastText(s.broadcast_message || '')
        setSpreadValue(s.spread_multiplier || '1.0')
      }

      if (isSuperAdmin) {
        const saRes = await fetch('/api/super-admin/settings')
        if (saRes.ok) {
          const s = (await saRes.json()).settings || {}
          setSaBtcAddress(s.deposit_btc_address || '')
          setSaUsdtAddress(s.deposit_usdt_address || '')
          setSaBtcBarcode(s.deposit_btc_barcode_url || '')
          setSaUsdtBarcode(s.deposit_usdt_barcode_url || '')
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleSetMarketTrend = async (trend) => {
    setTrendMsg(null); setTrendLoading(true)
    try {
      const res = await fetch('/api/admin/set-market-trend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend })
      })
      const data = await res.json()
      if (res.ok) {
        setTrendMsg({ type: 'success', text: `Market trend set to ${trend}.` })
        setSystemSettings(prev => ({ ...prev, market_trend: trend }))
      } else {
        setTrendMsg({ type: 'error', text: data.error || 'Failed.' })
      }
    } catch { setTrendMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setTrendLoading(false) }
  }

  const refreshData = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const handleKycAction = async (kycId, action) => {
    setKycActionId(`${kycId}-${action}`)
    setKycMsg(null)
    try {
      const res = await fetch(`/api/admin/kyc/${kycId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (res.ok) {
        setKycMsg({ type: 'success', text: data.message })
        await loadData()
      } else {
        setKycMsg({ type: 'error', text: data.error || 'Action failed.' })
      }
    } catch { setKycMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setKycActionId(null) }
  }

  const handleForceClose = async (e) => {
    e.preventDefault(); setForceCloseMsg(null); setForceCloseLoading(true)
    try {
      const res = await fetch('/api/admin/force-close', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: forceClosePositionId })
      })
      const data = await res.json()
      if (res.ok) { setForceCloseMsg({ type: 'success', text: data.message || 'Position closed.' }); setForceClosePositionId(''); loadData() }
      else setForceCloseMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setForceCloseMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setForceCloseLoading(false) }
  }

  const handleAdjustBalance = async (e) => {
    e.preventDefault(); setAdjustMsg(null); setAdjustLoading(true)
    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: adjustUserId, amount: parseFloat(adjustAmount), reason: adjustReason })
      })
      const data = await res.json()
      if (res.ok) { setAdjustMsg({ type: 'success', text: 'Balance adjusted.' }); setAdjustUserId(''); setAdjustAmount(''); setAdjustReason(''); loadData() }
      else setAdjustMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setAdjustMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setAdjustLoading(false) }
  }

  const handleBroadcast = async (e) => {
    e.preventDefault(); setBroadcastMsg(null); setBroadcastLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastText })
      })
      const data = await res.json()
      if (res.ok) setBroadcastMsg({ type: 'success', text: broadcastText ? 'Broadcast sent to all users.' : 'Broadcast cleared.' })
      else setBroadcastMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setBroadcastMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setBroadcastLoading(false) }
  }

  const handleSetSpread = async (e) => {
    e.preventDefault(); setSpreadMsg(null); setSpreadLoading(true)
    try {
      const res = await fetch('/api/admin/spread-multiplier', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: parseFloat(spreadValue) })
      })
      const data = await res.json()
      if (res.ok) setSpreadMsg({ type: 'success', text: `Spread multiplier set to ${spreadValue}x.` })
      else setSpreadMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setSpreadMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setSpreadLoading(false) }
  }

  const handleSuperSetRole = async (e) => {
    e.preventDefault()
    setSaRoleMsg(null)
    setSaRoleLoading(true)
    try {
      const res = await fetch('/api/super-admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saTargetEmail.trim(), role: saRole })
      })
      const data = await res.json()
      if (res.ok) {
        setSaRoleMsg({ type: 'success', text: data.message || 'Role updated.' })
        setSaTargetEmail('')
        await loadData()
      } else {
        setSaRoleMsg({ type: 'error', text: data.error || 'Failed to update role.' })
      }
    } catch {
      setSaRoleMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSaRoleLoading(false)
    }
  }

  const handleSuperDepositConfig = async (e) => {
    e.preventDefault()
    setSaConfigMsg(null)
    setSaConfigLoading(true)
    try {
      const res = await fetch('/api/super-admin/deposit-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          btcAddress: saBtcAddress,
          usdtAddress: saUsdtAddress,
          btcBarcodeUrl: saBtcBarcode,
          usdtBarcodeUrl: saUsdtBarcode
        })
      })
      const data = await res.json()
      if (res.ok) {
        setSaConfigMsg({ type: 'success', text: data.message || 'Deposit config updated.' })
      } else {
        setSaConfigMsg({ type: 'error', text: data.error || 'Failed to update config.' })
      }
    } catch {
      setSaConfigMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSaConfigLoading(false)
    }
  }

  const handleSuperResetPassword = async (e) => {
    e.preventDefault()
    setSaResetMsg(null)
    setSaResetLoading(true)
    try {
      const res = await fetch('/api/super-admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saResetEmail.trim(), newPassword: saResetPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setSaResetMsg({ type: 'success', text: data.message || 'Password reset.' })
        setSaResetPassword('')
      } else {
        setSaResetMsg({ type: 'error', text: data.error || 'Failed to reset password.' })
      }
    } catch {
      setSaResetMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSaResetLoading(false)
    }
  }

  const handleSuperDeleteUser = async (e) => {
    e.preventDefault()
    setSaDeleteMsg(null)

    if (saDeleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setSaDeleteMsg({ type: 'error', text: 'Type DELETE to confirm permanent account deletion.' })
      return
    }

    setSaDeleteLoading(true)
    try {
      const res = await fetch('/api/super-admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saDeleteEmail.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setSaDeleteMsg({ type: 'success', text: data.message || 'User deleted.' })
        setSaDeleteEmail('')
        setSaDeleteConfirm('')
        await loadData()
      } else {
        setSaDeleteMsg({ type: 'error', text: data.error || 'Failed to delete user.' })
      }
    } catch {
      setSaDeleteMsg({ type: 'error', text: 'An error occurred.' })
    } finally {
      setSaDeleteLoading(false)
    }
  }

  const handleSuspend = async (targetUserId, suspend) => {
    setSuspendMsg(null); setSuspendingId(targetUserId)
    try {
      const res = await fetch('/api/admin/suspend-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, suspend })
      })
      const data = await res.json()
      if (res.ok) { setSuspendMsg({ type: 'success', text: data.message }); loadData() }
      else setSuspendMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setSuspendMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setSuspendingId(null) }
  }

  const handleDepositAction = async (depositId, action) => {
    setDepositMsg(null); setDepositActionId(depositId)
    try {
      const res = await fetch('/api/admin/deposits/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, action })
      })
      const data = await res.json()
      if (res.ok) { setDepositMsg({ type: 'success', text: data.message }); loadData() }
      else setDepositMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setDepositMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setDepositActionId(null) }
  }

  const handleWithdrawalAction = async (withdrawalId, action) => {
    setWithdrawalMsg(null); setWithdrawalActionId(`${withdrawalId}-${action}`)
    try {
      const res = await fetch('/api/admin/withdrawals/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId, action })
      })
      const data = await res.json()
      if (res.ok) { setWithdrawalMsg({ type: 'success', text: data.message }); loadData() }
      else setWithdrawalMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setWithdrawalMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setWithdrawalActionId(null) }
  }

  const handleForceSettle = async (positionId, outcome) => {
    setSettleMsg(null); setSettlingId(`${positionId}-${outcome}`)
    try {
      const res = await fetch('/api/admin/force-settle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId,
          outcome,
          percent: forceSettlePercent === '' ? undefined : parseFloat(forceSettlePercent)
        })
      })
      const data = await res.json()
      if (res.ok) { setSettleMsg({ type: 'success', text: data.message }); loadData() }
      else setSettleMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setSettleMsg({ type: 'error', text: 'An error occurred.' }) }
    finally { setSettlingId(null) }
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0)

  const Msg = ({ msg }) => msg ? (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
      {msg.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
      {msg.text}
    </div>
  ) : null

  if (loading) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  )

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar currentPage="/admin" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="h-6 w-6 text-amber-400" />
                {isSuperAdmin ? 'Super Admin Control Centre' : 'Admin Control Centre'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">Platform management and oversight</p>
            </div>
            <Button variant="ghost" onClick={refreshData} disabled={refreshing} className="hidden lg:flex text-slate-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {(dataLoading || refreshing) && (
            <div className="mb-4 flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading…</span>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
                  <UserX className="h-5 w-5 text-red-400" />
                  <div>
                    <div className="text-slate-400 text-xs">Suspended</div>
                    <div className="text-xl font-bold text-white">{users.filter(u => u.is_suspended).length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={`border ${deposits.filter(d => d.status === 'PENDING').length > 0 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-[#161b22] border-slate-800'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Inbox className={`h-5 w-5 ${deposits.filter(d => d.status === 'PENDING').length > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-slate-400 text-xs">Pending Deposits</div>
                    <div className={`text-xl font-bold ${deposits.filter(d => d.status === 'PENDING').length > 0 ? 'text-amber-400' : 'text-white'}`}>
                      {deposits.filter(d => d.status === 'PENDING').length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-amber-400" />
                  <div>
                    <div className="text-amber-400/70 text-xs">{isSuperAdmin ? 'Super Admin Mode' : 'Admin Mode'}</div>
                    <div className="text-amber-400 font-bold text-sm">ACTIVE</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* God Mode Controls */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* System Broadcast */}
            <Card className="bg-[#161b22] border-red-500/20">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-400" />
                  System Broadcast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-3">
                  Displays a scrolling banner on every user&apos;s dashboard. Clear the text to remove it.
                </p>
                <form onSubmit={handleBroadcast} className="space-y-3">
                  <Textarea
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                    placeholder='e.g. "WARNING: High Volatility Expected in BTC"'
                    rows={2}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                  />
                  <Msg msg={broadcastMsg} />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={broadcastLoading} className="bg-red-600 hover:bg-red-700 text-white flex-1">
                      {broadcastLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {broadcastText ? 'Send Broadcast' : 'Clear Broadcast'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Spread Multiplier */}
            <Card className="bg-[#161b22] border-yellow-500/20">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Market Spread Multiplier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-3">
                  Multiply the effective spread/fees for all trades. <span className="text-yellow-400">1.0 = normal</span>. 2.0 = double fees.
                </p>
                <form onSubmit={handleSetSpread} className="space-y-3">
                  <Input
                    value={spreadValue}
                    onChange={e => setSpreadValue(e.target.value)}
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    required
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Msg msg={spreadMsg} />
                  <Button type="submit" disabled={spreadLoading} className="bg-yellow-600 hover:bg-yellow-700 text-white w-full">
                    {spreadLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply Multiplier
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Market Trend Control */}
            <Card className="bg-[#161b22] border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Market Simulation Trend
                  {systemSettings.market_trend && (
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                      systemSettings.market_trend === 'BULL' ? 'bg-emerald-500/20 text-emerald-400' :
                      systemSettings.market_trend === 'BEAR' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {systemSettings.market_trend}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-3">
                  Bias the simulation engine. <span className="text-emerald-400">BULL</span> = prices drift up. <span className="text-red-400">BEAR</span> = drift down. Neutral = random.
                </p>
                <Msg msg={trendMsg} />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Button disabled={trendLoading} onClick={() => handleSetMarketTrend('BULL')}
                    className={`text-xs ${systemSettings.market_trend === 'BULL' ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-emerald-600 text-slate-300'}`}>
                    {trendLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : '📈 BULL'}
                  </Button>
                  <Button disabled={trendLoading} onClick={() => handleSetMarketTrend('NEUTRAL')}
                    className={`text-xs ${systemSettings.market_trend === 'NEUTRAL' ? 'bg-slate-500 text-white' : 'bg-slate-700 hover:bg-slate-500 text-slate-300'}`}>
                    {trendLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : '➡️ NEUTRAL'}
                  </Button>
                  <Button disabled={trendLoading} onClick={() => handleSetMarketTrend('BEAR')}
                    className={`text-xs ${systemSettings.market_trend === 'BEAR' ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-red-600 text-slate-300'}`}>
                    {trendLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : '📉 BEAR'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Force Close / Force Settle Position */}
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <X className="h-5 w-5 text-red-400" />
                  Force Settlement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-3">
                  Force-close any position by UUID. Choose Profit or Loss and set any percentage you want — logged as &quot;Trade Settlement&quot;.
                </p>
                <form onSubmit={handleForceClose} className="space-y-3">
                  <Input
                    value={forceClosePositionId}
                    onChange={e => setForceClosePositionId(e.target.value)}
                    placeholder="Position UUID"
                    required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  <Input
                    value={forceSettlePercent}
                    onChange={e => setForceSettlePercent(e.target.value)}
                    placeholder="Percent (e.g. 10, 1, 15, 30)"
                    type="number"
                    step="0.01"
                    min="0"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Msg msg={forceCloseMsg} />
                  <Msg msg={settleMsg} />
                  <div className="grid grid-cols-3 gap-2">
                    <Button type="submit" disabled={forceCloseLoading} className="bg-red-600 hover:bg-red-700 text-white text-xs">
                      {forceCloseLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Force Close
                    </Button>
                    <Button type="button" disabled={settlingId !== null || !forceClosePositionId}
                      onClick={() => handleForceSettle(forceClosePositionId, 'PROFIT')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                      {settlingId === `${forceClosePositionId}-PROFIT` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><TrendingUp className="h-3 w-3 mr-1" />Profit</>}
                    </Button>
                    <Button type="button" disabled={settlingId !== null || !forceClosePositionId}
                      onClick={() => handleForceSettle(forceClosePositionId, 'LOSS')}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs">
                      {settlingId === `${forceClosePositionId}-LOSS` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><TrendingDown className="h-3 w-3 mr-1" />Loss</>}
                    </Button>
                  </div>
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
                <p className="text-slate-400 text-sm mb-3">
                  Add or subtract from a user&apos;s account. Use negative for deduction.
                </p>
                <form onSubmit={handleAdjustBalance} className="space-y-3">
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
                    placeholder="Amount (negative to subtract)"
                    type="number" step="0.01" required
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Input
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <Msg msg={adjustMsg} />
                  <Button type="submit" disabled={adjustLoading} className="bg-amber-600 hover:bg-amber-700 text-white w-full">
                    {adjustLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply Adjustment
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {suspendMsg && <div className="mb-4"><Msg msg={suspendMsg} /></div>}

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg w-fit">
            {[
              { id: 'live-positions', label: `Live Positions (${livePositions.length})`, highlight: livePositions.length > 0 },
              { id: 'users', label: `Users (${users.length})` },
              { id: 'deposits', label: 'Deposits', badge: deposits.filter(d => d.status === 'PENDING').length },
              { id: 'withdrawals', label: 'Withdrawals', badge: withdrawals.filter(w => w.status === 'PENDING').length },
              { id: 'kyc', label: 'KYC Requests', badge: kycRequests.filter(k => k.status === 'SUBMITTED').length },
              { id: 'market-control', label: '🎛️ Market Control' },
              { id: 'activity', label: `Live Feed (${activityFeed.length})` },
              { id: 'audit', label: `Audit Log (${auditLog.length})` },
              ...(isSuperAdmin ? [{ id: 'super-admin', label: '👑 Super Admin' }] : []),
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {tab.label}
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Users Table */}
          {activeTab === 'live-positions' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <MonitorPlay className="h-5 w-5 text-emerald-400" />
                  Live Open Positions
                  <span className="text-xs text-slate-500 font-normal">(auto-refreshes every 10 s)</span>
                  {liveLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {livePositions.length === 0 ? (
                  <div className="text-center py-10">
                    <MonitorPlay className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No open positions right now</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">User</th>
                          <th className="text-left p-4">Instrument</th>
                          <th className="text-right p-4">Size</th>
                          <th className="text-right p-4">Entry Price</th>
                          <th className="text-right p-4">Open P&amp;L</th>
                          <th className="text-right p-4">Custom Close</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {livePositions.map(pos => {
                          const entryPrice = parseFloat(pos.entry_price)
                          const qty = parseFloat(pos.quantity)
                          const customPrice = customPrices[pos.id] || ''
                          const customPriceNum = parseFloat(customPrice)
                          const customPnl = customPrice && !isNaN(customPriceNum)
                            ? (customPriceNum - entryPrice) * qty
                            : null
                          return (
                            <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                              <td className="p-4">
                                <div className="text-white text-sm">{pos.user_email}</div>
                                <div className="text-slate-500 text-xs font-mono truncate max-w-[160px]">{pos.id}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                                    {pos.symbol}
                                  </span>
                                  <span className={`text-xs ${pos.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {pos.side}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-right text-white text-sm">{qty}</td>
                              <td className="p-4 text-right text-white text-sm">{formatCurrency(entryPrice)}</td>
                              <td className="p-4 text-right text-sm">
                                {customPnl != null ? (
                                  <span className={customPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                    {customPnl >= 0 ? '+' : ''}{formatCurrency(customPnl)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-xs">Enter price →</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder={`e.g. ${entryPrice.toFixed(2)}`}
                                  value={customPrice}
                                  onChange={e => setCustomPrices(p => ({ ...p, [pos.id]: e.target.value }))}
                                  className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:border-emerald-500 focus:outline-none text-right"
                                />
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  <Button size="sm" disabled={settlingId !== null}
                                    onClick={() => handleForceCloseAtPrice(pos.id, customPrice)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-2"
                                    title="Close at custom price entered above">
                                    {settlingId === `${pos.id}-CUSTOM`
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : '⚡ Close'}
                                  </Button>
                                  <Button size="sm" disabled={settlingId !== null}
                                    onClick={() => handleLiveSettle(pos.id, 'PROFIT')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2">
                                    {settlingId === `${pos.id}-PROFIT`
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><TrendingUp className="h-3 w-3 mr-1 inline" />+10%</>}
                                  </Button>
                                  <Button size="sm" disabled={settlingId !== null}
                                    onClick={() => handleLiveSettle(pos.id, 'LOSS')}
                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-7 px-2">
                                    {settlingId === `${pos.id}-LOSS`
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><TrendingDown className="h-3 w-3 mr-1 inline" />−5%</>}
                                  </Button>
                                  <Button size="sm" variant="ghost" disabled={settlingId !== null}
                                    onClick={() => handleLiveSettle(pos.id, 'MARKET')}
                                    className="text-slate-400 hover:text-white hover:bg-slate-700 text-xs h-7 px-2">
                                    {settlingId === `${pos.id}-MARKET`
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><X className="h-3 w-3 mr-1 inline" />Market</>}
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
          )}

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
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">Email / ID</th>
                          <th className="text-left p-4">Role</th>
                          <th className="text-right p-4">Balance</th>
                          <th className="text-center p-4">Status</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className={`border-b border-slate-800 hover:bg-slate-800/30 ${u.is_suspended ? 'opacity-60' : ''}`}>
                            <td className="p-4">
                              <div className="text-white text-sm">{u.email}</div>
                              <div className="text-slate-500 text-xs font-mono truncate max-w-[180px]">{u.id}</div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                u.role === 'SUPER_ADMIN'
                                  ? 'bg-fuchsia-500/10 text-fuchsia-400'
                                  : u.role === 'ADMIN'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-slate-700 text-slate-400'
                              }`}>
                                {u.role || 'USER'}
                              </span>
                            </td>
                            <td className="p-4 text-right text-white text-sm">
                              {u.balance !== null ? formatCurrency(u.balance) : '—'}
                            </td>
                            <td className="p-4 text-center">
                              {u.is_suspended
                                ? <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">Suspended</span>
                                : <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">Active</span>
                              }
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/admin/users/${u.id}`}>
                                  <Button variant="ghost" size="sm"
                                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs">
                                    <Eye className="h-3 w-3 mr-1 inline" />Shadow
                                  </Button>
                                </Link>
                                {u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={suspendingId === u.id}
                                    onClick={() => handleSuspend(u.id, !u.is_suspended)}
                                    className={u.is_suspended
                                      ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs'
                                      : 'text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs'
                                    }
                                  >
                                    {suspendingId === u.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : u.is_suspended
                                        ? <><UserCheck className="h-3 w-3 mr-1 inline" />Reactivate</>
                                        : <><UserX className="h-3 w-3 mr-1 inline" />Suspend</>
                                    }
                                  </Button>
                                )}
                              </div>
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

          {/* Deposits Tab */}
          {activeTab === 'deposits' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-amber-400" />
                  Deposit Requests
                  {deposits.filter(d => d.status === 'PENDING').length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {deposits.filter(d => d.status === 'PENDING').length} pending
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              {depositMsg && <div className="px-6 pb-2"><Msg msg={depositMsg} /></div>}
              {settleMsg && <div className="px-6 pb-2"><Msg msg={settleMsg} /></div>}
              <CardContent className="p-0">
                {deposits.length === 0 ? (
                  <div className="text-center py-10">
                    <Inbox className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No deposit requests yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">User</th>
                          <th className="text-right p-4">Amount</th>
                          <th className="text-center p-4">Method</th>
                          <th className="text-center p-4">Status</th>
                          <th className="text-right p-4">Date</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map(dep => (
                          <tr key={dep.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                            <td className="p-4">
                              <div className="text-white text-sm">{dep.email}</div>
                              <div className="text-slate-500 text-xs font-mono truncate max-w-[150px]">{dep.user_id}</div>
                            </td>
                            <td className="p-4 text-right text-white font-semibold text-sm">
                              ${parseFloat(dep.amount).toLocaleString()}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                dep.method === 'BTC' ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'
                              }`}>
                                {dep.method}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                dep.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                                dep.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                'bg-amber-500/10 text-amber-400'
                              }`}>
                                {dep.status}
                              </span>
                            </td>
                            <td className="p-4 text-right text-slate-500 text-xs">
                              {new Date(dep.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              {dep.status === 'PENDING' && (
                                <div className="flex items-center justify-end gap-2">
                                  <Button size="sm" disabled={depositActionId === dep.id}
                                    onClick={() => handleDepositAction(dep.id, 'APPROVE')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2">
                                    {depositActionId === dep.id
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><CheckCircle className="h-3 w-3 mr-1 inline" />Approve</>
                                    }
                                  </Button>
                                  <Button size="sm" variant="ghost" disabled={depositActionId === dep.id}
                                    onClick={() => handleDepositAction(dep.id, 'REJECT')}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 px-2">
                                    <X className="h-3 w-3 mr-1 inline" />Reject
                                  </Button>
                                </div>
                              )}
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

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-amber-400" />
                  Withdrawal Requests
                  {withdrawals.filter(w => w.status === 'PENDING').length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {withdrawals.filter(w => w.status === 'PENDING').length} pending
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              {withdrawalMsg && <div className="px-6 pb-2"><Msg msg={withdrawalMsg} /></div>}
              <CardContent className="p-0">
                {withdrawals.length === 0 ? (
                  <div className="text-center py-10">
                    <TrendingDown className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No withdrawal requests yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">User</th>
                          <th className="text-right p-4">Amount</th>
                          <th className="text-center p-4">Method</th>
                          <th className="text-left p-4">Address</th>
                          <th className="text-center p-4">Status</th>
                          <th className="text-right p-4">Date</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(wr => {
                          const isPending = wr.status === 'PENDING'
                          const isProcessing = wr.status === 'PROCESSING'
                          const actingApprove = withdrawalActionId === `${wr.id}-APPROVE`
                          const actingReject = withdrawalActionId === `${wr.id}-REJECT`
                          const actingProcessing = withdrawalActionId === `${wr.id}-PROCESSING`

                          return (
                            <tr key={wr.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                              <td className="p-4">
                                <div className="text-white text-sm">{wr.email}</div>
                                <div className="text-slate-500 text-xs font-mono truncate max-w-[150px]">{wr.user_id}</div>
                              </td>
                              <td className="p-4 text-right text-white font-semibold text-sm">
                                ${parseFloat(wr.amount).toLocaleString()}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  wr.method === 'BTC' ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'
                                }`}>
                                  {wr.method}
                                </span>
                              </td>
                              <td className="p-4 text-slate-400 text-xs font-mono truncate max-w-[320px]">{wr.address || '—'}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  wr.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                  wr.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                  wr.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400' :
                                  'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {wr.status}
                                </span>
                              </td>
                              <td className="p-4 text-right text-slate-500 text-xs">
                                {new Date(wr.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-right">
                                {(isPending || isProcessing) ? (
                                  <div className="flex items-center justify-end gap-2">
                                    {isPending && (
                                      <Button size="sm" variant="ghost" disabled={actingProcessing}
                                        onClick={() => handleWithdrawalAction(wr.id, 'PROCESSING')}
                                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs h-7 px-2">
                                        {actingProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Processing'}
                                      </Button>
                                    )}
                                    <Button size="sm" disabled={actingApprove}
                                      onClick={() => handleWithdrawalAction(wr.id, 'APPROVE')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2">
                                      {actingApprove
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <><CheckCircle className="h-3 w-3 mr-1 inline" />Approve</>
                                      }
                                    </Button>
                                    <Button size="sm" variant="ghost" disabled={actingReject}
                                      onClick={() => handleWithdrawalAction(wr.id, 'REJECT')}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 px-2">
                                      <X className="h-3 w-3 mr-1 inline" />{actingReject ? '…' : 'Reject'}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
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
          )}

          {/* Live Activity Feed */}
          {activeTab === 'activity' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  Live Activity Feed
                  <span className="text-xs text-slate-500 font-normal">(last 20 actions)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activityFeed.length === 0 ? (
                  <div className="text-center py-10">
                    <Activity className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No activity yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {activityFeed.map(entry => (
                      <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            entry.action.startsWith('TRADE') ? 'bg-emerald-500' :
                            entry.action === 'LOGIN' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                          <div className="min-w-0">
                            <div className="text-white text-sm font-medium">{entry.action}</div>
                            <div className="text-slate-500 text-xs truncate">{entry.email || 'Unknown'}</div>
                          </div>
                        </div>
                        <div className="text-slate-500 text-xs flex-shrink-0">
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
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
                            <td className="p-4 text-slate-400 text-xs">{entry.admin_email || entry.admin_id}</td>
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

          {/* KYC Requests Tab */}
          {activeTab === 'kyc' && (
            <Card className="bg-[#161b22] border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  KYC Verification Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {kycMsg && (
                  <div className={`mx-4 mt-4 flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${kycMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {kycMsg.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    {kycMsg.text}
                  </div>
                )}
                {kycRequests.length === 0 ? (
                  <div className="text-center py-10">
                    <Shield className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No KYC requests yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left p-4">User</th>
                          <th className="text-left p-4">Name</th>
                          <th className="text-left p-4">Country</th>
                          <th className="text-left p-4">DOB</th>
                          <th className="text-left p-4">Document</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-left p-4">Submitted</th>
                          <th className="text-right p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kycRequests.map(req => {
                          const isActing = kycActionId === `${req.id}-approve` || kycActionId === `${req.id}-reject`
                          return (
                            <tr key={req.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                              <td className="p-4 text-slate-400 text-xs">{req.email}</td>
                              <td className="p-4 text-white text-sm font-medium">{req.first_name} {req.last_name}</td>
                              <td className="p-4 text-slate-400 text-xs">{req.country}</td>
                              <td className="p-4 text-slate-400 text-xs">{req.date_of_birth ? String(req.date_of_birth).split('T')[0] : '—'}</td>
                              <td className="p-4 text-slate-400 text-xs">{req.document_type}</td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                  req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                  'bg-amber-500/10 text-amber-400'
                                }`}>{req.status}</span>
                              </td>
                              <td className="p-4 text-slate-500 text-xs">{new Date(req.created_at).toLocaleDateString()}</td>
                              <td className="p-4 text-right">
                                {req.status === 'SUBMITTED' && (
                                  <div className="flex items-center gap-2 justify-end">
                                    <Button size="sm"
                                      disabled={isActing}
                                      onClick={() => handleKycAction(req.id, 'approve')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3">
                                      {kycActionId === `${req.id}-approve` ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓ Approve'}
                                    </Button>
                                    <Button size="sm"
                                      disabled={isActing}
                                      onClick={() => handleKycAction(req.id, 'reject')}
                                      className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-3">
                                      {kycActionId === `${req.id}-reject` ? <Loader2 className="h-3 w-3 animate-spin" /> : '✕ Reject'}
                                    </Button>
                                  </div>
                                )}
                                {req.status !== 'SUBMITTED' && (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
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
          )}

          {/* ── Market Control Tab ─────────────────────────────────────────── */}
          {activeTab === 'market-control' && (
            <div className="space-y-4">
              {mcMsg && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${mcMsg.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {mcMsg.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  {mcMsg.text}
                </div>
              )}

              {/* Simulator settings */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    🎛️ Simulator Settings
                    <span className="text-xs text-slate-500 font-normal">controls random-walk price engine</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Volatility */}
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Volatility (0 = calm, 1 = chaotic)</label>
                      <input type="range" min="0" max="1" step="0.05"
                        value={mcSettings.volatility}
                        onChange={e => setMcSettings(s => ({ ...s, volatility: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-500" />
                      <span className="text-white text-sm font-mono">{mcSettings.volatility}</span>
                    </div>
                    {/* Trend Bias */}
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Trend Bias</label>
                      <div className="flex gap-2">
                        {['BULL', 'NEUTRAL', 'BEAR'].map(b => (
                          <button key={b} onClick={() => setMcSettings(s => ({ ...s, trendBias: b }))}
                            className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
                              mcSettings.trendBias === b
                                ? b === 'BULL' ? 'bg-emerald-600 text-white' : b === 'BEAR' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}>
                            {b === 'BULL' ? '📈 BULL' : b === 'BEAR' ? '📉 BEAR' : '↔ NEUTRAL'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Spread */}
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Default Spread (pips)</label>
                      <Input type="number" min="0.1" step="0.5"
                        value={mcSettings.spreadPips}
                        onChange={e => setMcSettings(s => ({ ...s, spreadPips: parseFloat(e.target.value) }))}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveMarketSettings} disabled={mcLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-8">
                      {mcLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      💾 Save Settings
                    </Button>
                    <Button onClick={handleTickMarket} variant="outline"
                      className="border-blue-600 text-blue-400 hover:bg-blue-900/30 text-sm h-8">
                      ⚡ Advance One Tick
                    </Button>
                    <Button onClick={loadMarketPrices} variant="outline"
                      className="border-slate-700 text-slate-400 hover:bg-slate-800 text-sm h-8">
                      🔄 Refresh Prices
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Per-symbol price override */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">🎯 Per-Symbol Price Override</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Symbol</label>
                      <Input placeholder="e.g. EURUSD" value={mcOverrideSymbol}
                        onChange={e => setMcOverrideSymbol(e.target.value.toUpperCase())}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm w-32 uppercase" />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Override Price</label>
                      <Input type="number" step="any" placeholder="e.g. 1.1000" value={mcOverridePrice}
                        onChange={e => setMcOverridePrice(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm w-36" />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Duration (min)</label>
                      <Input type="number" min="1" step="1" value={mcOverrideDuration}
                        onChange={e => setMcOverrideDuration(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white h-8 text-sm w-20" />
                    </div>
                    <Button onClick={handlePriceOverride} disabled={mcLoading || !mcOverrideSymbol || !mcOverridePrice}
                      className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-sm">
                      🔧 Set Override
                    </Button>
                  </div>
                  <p className="text-slate-600 text-xs mt-2">Override expires automatically after the duration. Use for demo price manipulation. All overrides are audit-logged.</p>
                </CardContent>
              </Card>

              {/* Live price table */}
              <Card className="bg-[#161b22] border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">📊 Current Simulated Prices</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {Object.keys(mcPrices).length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">Click "Refresh Prices" to load</p>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead className="sticky top-0 bg-[#161b22]">
                          <tr className="text-slate-500 text-xs border-b border-slate-800">
                            <th className="text-left p-3">Symbol</th>
                            <th className="text-right p-3">Bid</th>
                            <th className="text-right p-3">Ask</th>
                            <th className="text-right p-3">Mid</th>
                            <th className="text-right p-3">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(mcPrices).sort(([a],[b]) => a.localeCompare(b)).map(([sym, p]) => (
                            <tr key={sym} className="border-b border-slate-800/50 hover:bg-slate-800/20 font-mono">
                              <td className="p-3 text-white font-bold text-xs">{sym}</td>
                              <td className="p-3 text-right text-red-400 text-xs">{p.bid?.toFixed(5)}</td>
                              <td className="p-3 text-right text-emerald-400 text-xs">{p.ask?.toFixed(5)}</td>
                              <td className="p-3 text-right text-slate-300 text-xs">{p.mid?.toFixed(5)}</td>
                              <td className="p-3 text-right text-xs">
                                {p.source === 'OVERRIDE'
                                  ? <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded text-xs">OVERRIDE</span>
                                  : <span className="text-slate-600 text-xs">sim</span>}
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
          )}

          {activeTab === 'super-admin' && isSuperAdmin && (
            <div className="space-y-4">
              <Card className="bg-[#161b22] border-fuchsia-500/30">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Crown className="h-5 w-5 text-fuchsia-400" />
                    Super Admin Role Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSuperSetRole} className="space-y-3">
                    <Input
                      value={saTargetEmail}
                      onChange={e => setSaTargetEmail(e.target.value)}
                      placeholder="user@example.com"
                      type="email"
                      required
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setSaRole('ADMIN')}
                        className={saRole === 'ADMIN' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                      >
                        Promote to Admin
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setSaRole('USER')}
                        className={saRole === 'USER' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                      >
                        Demote to User
                      </Button>
                    </div>
                    <Msg msg={saRoleMsg} />
                    <Button type="submit" disabled={saRoleLoading} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white w-full">
                      {saRoleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Apply Role Change
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-[#161b22] border-blue-500/30">
                <CardHeader>
                  <CardTitle className="text-white text-base">Deposit Address & Barcode Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSuperDepositConfig} className="space-y-3">
                    <Input value={saBtcAddress} onChange={e => setSaBtcAddress(e.target.value)} placeholder="BTC deposit address" required className="bg-slate-800 border-slate-700 text-white" />
                    <Input value={saUsdtAddress} onChange={e => setSaUsdtAddress(e.target.value)} placeholder="USDT deposit address" required className="bg-slate-800 border-slate-700 text-white" />
                    <Input value={saBtcBarcode} onChange={e => setSaBtcBarcode(e.target.value)} placeholder="BTC custom barcode image URL (optional)" className="bg-slate-800 border-slate-700 text-white" />
                    <Input value={saUsdtBarcode} onChange={e => setSaUsdtBarcode(e.target.value)} placeholder="USDT custom barcode image URL (optional)" className="bg-slate-800 border-slate-700 text-white" />
                    <Msg msg={saConfigMsg} />
                    <Button type="submit" disabled={saConfigLoading} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                      {saConfigLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Deposit Configuration
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="bg-[#161b22] border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-amber-400" />
                      Reset User Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSuperResetPassword} className="space-y-3">
                      <Input value={saResetEmail} onChange={e => setSaResetEmail(e.target.value)} placeholder="user@example.com" type="email" required className="bg-slate-800 border-slate-700 text-white" />
                      <Input value={saResetPassword} onChange={e => setSaResetPassword(e.target.value)} placeholder="New password (min 8 chars)" type="password" minLength={8} required className="bg-slate-800 border-slate-700 text-white" />
                      <Msg msg={saResetMsg} />
                      <Button type="submit" disabled={saResetLoading} className="bg-amber-600 hover:bg-amber-700 text-white w-full">
                        {saResetLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Reset Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="bg-[#161b22] border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-400" />
                      Delete User Account (Permanent)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSuperDeleteUser} className="space-y-3">
                      <Input value={saDeleteEmail} onChange={e => setSaDeleteEmail(e.target.value)} placeholder="user@example.com" type="email" required className="bg-slate-800 border-slate-700 text-white" />
                      <Input value={saDeleteConfirm} onChange={e => setSaDeleteConfirm(e.target.value)} placeholder='Type "DELETE" to confirm' required className="bg-slate-800 border-slate-700 text-white" />
                      <Msg msg={saDeleteMsg} />
                      <Button type="submit" disabled={saDeleteLoading} className="bg-red-600 hover:bg-red-700 text-white w-full">
                        {saDeleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Delete Account Permanently
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {toast.text}
        </div>
      )}
    </div>
  )
}


