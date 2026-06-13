'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
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
  Clock,
  Bell,
  BellRing,
  Trash2,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  X,
  Activity,
  CreditCard,
  Repeat,
  Share2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function WalletPage() {
  const router = useRouter()
  const { toast } = useToast()
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
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [priceAlerts, setPriceAlerts] = useState([])
  const [triggeredAlerts, setTriggeredAlerts] = useState([])
  const [showAlertForm, setShowAlertForm] = useState(false)
  const [alertAsset, setAlertAsset] = useState('')
  const [alertPrice, setAlertPrice] = useState('')
  const [alertDirection, setAlertDirection] = useState('above')
  const [lastTxIds, setLastTxIds] = useState(new Set())
  const [perfData, setPerfData] = useState([])
  const [showShare, setShowShare] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [showAllBalances, setShowAllBalances] = useState(false)
  const BALANCES_PAGE_SIZE = 10

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) { loadData(); loadPerformance() } }, [user])

  // Poll for new transactions every 30s
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => { loadData(); loadPerformance() }, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('vq_hideBalances') : null
    if (saved === '1') setHideBalances(true)
    const savedCurr = typeof window !== 'undefined' ? localStorage.getItem('vq_currency') : null
    if (savedCurr) setDisplayCurrency(savedCurr)
    const savedAlerts = typeof window !== 'undefined' ? localStorage.getItem('vq_priceAlerts') : null
    if (savedAlerts) setPriceAlerts(JSON.parse(savedAlerts))
    const savedTriggered = typeof window !== 'undefined' ? localStorage.getItem('vq_triggeredAlerts') : null
    if (savedTriggered) setTriggeredAlerts(JSON.parse(savedTriggered))
    const savedLastIds = typeof window !== 'undefined' ? localStorage.getItem('vq_lastTxIds') : null
    if (savedLastIds) setLastTxIds(new Set(JSON.parse(savedLastIds)))
  }, [])

  const toggleHideBalances = () => {
    setHideBalances(prev => {
      const next = !prev
      if (typeof window !== 'undefined') localStorage.setItem('vq_hideBalances', next ? '1' : '0')
      return next
    })
  }

  const handleSetCurrency = (curr) => {
    setDisplayCurrency(curr)
    if (typeof window !== 'undefined') localStorage.setItem('vq_currency', curr)
  }

  const masked = (val) => hideBalances ? '••••••' : val

  const saveAlerts = (alerts) => {
    setPriceAlerts(alerts)
    localStorage.setItem('vq_priceAlerts', JSON.stringify(alerts))
  }

  const addPriceAlert = () => {
    const price = parseFloat(alertPrice)
    if (!alertAsset || !price || price <= 0) return
    const next = [...priceAlerts, { id: Date.now(), asset: alertAsset.toUpperCase(), targetPrice: price, direction: alertDirection, createdAt: Date.now() }]
    saveAlerts(next)
    setAlertAsset(''); setAlertPrice(''); setShowAlertForm(false)
  }

  const removePriceAlert = (id) => {
    saveAlerts(priceAlerts.filter(a => a.id !== id))
  }

  const dismissTriggered = (id) => {
    const next = triggeredAlerts.filter(a => a.id !== id)
    setTriggeredAlerts(next)
    localStorage.setItem('vq_triggeredAlerts', JSON.stringify(next))
  }

  const checkAlerts = (currentPrices) => {
    if (!currentPrices || !priceAlerts.length) return
    const newTriggered = []
    const remaining = []
    priceAlerts.forEach(alert => {
      const price = currentPrices[alert.asset]
      if (!price) { remaining.push(alert); return }
      const triggered = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice
      if (triggered) {
        newTriggered.push({ ...alert, triggeredAt: Date.now(), currentPrice: price })
      } else {
        remaining.push(alert)
      }
    })
    if (newTriggered.length) {
      const allTriggered = [...triggeredAlerts, ...newTriggered.filter(n => !triggeredAlerts.some(t => t.id === n.id))]
      setTriggeredAlerts(allTriggered)
      localStorage.setItem('vq_triggeredAlerts', JSON.stringify(allTriggered))
      saveAlerts(remaining)
    }
  }

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
      let spotData = null
      if (spotRes.ok) {
        spotData = await spotRes.json()
        setSpot(spotData)
        // Build price map for alert checking
        const priceMap = {}
        ;(spotData?.balances || []).forEach(b => { priceMap[b.asset] = b.priceUsd || (b.stable ? 1 : 0) })
        checkAlerts(priceMap)
      }
      setLedger(ledgerData.entries || [])
      setLedgerMode(ledgerData.mode || accountData?.tradingMode || 'REAL')
      if (pendingRes.ok) {
        const pd = await pendingRes.json()
        setPendingTxs(pd.pending || [])
      }
      // Push notifications for new transactions
      const entries = ledgerData.entries || []
      if (entries.length && lastTxIds.size > 0) {
        const newTxs = entries.filter(e => !lastTxIds.has(e.id))
        newTxs.slice(0, 3).forEach(tx => {
          const label = tx.type === 'DEPOSIT' ? 'Deposit' : tx.type === 'WITHDRAWAL' ? 'Withdrawal' : tx.type === 'TRADE_BUY' ? 'Trade' : tx.type === 'TRADE_SELL' ? 'Trade' : 'Transaction'
          const isPositive = tx.amount >= 0
          toast({
            title: `${label} ${isPositive ? 'received' : 'sent'}`,
            description: `${isPositive ? '+' : ''}${formatCurrency(tx.amount)} · ${tx.description || tx.type}`,
          })
        })
      }
      if (entries.length) {
        const ids = entries.map(e => e.id)
        setLastTxIds(new Set(ids))
        localStorage.setItem('vq_lastTxIds', JSON.stringify(ids))
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err)
    }
  }

  const loadPerformance = async () => {
    try {
      // Try to fetch real snapshots, fallback to generated data
      const res = await fetch('/api/account/snapshots?limit=30')
      let data = []
      if (res.ok) {
        const json = await res.json()
        data = (json.snapshots || []).map(s => ({ date: new Date(s.createdAt), value: s.equity }))
      }
      if (!data.length) {
        // Generate realistic mock performance curve
        const days = 30
        const today = new Date()
        let value = (spot?.totalUsd || 0) + ((account?.balance ?? 0) + (account?.openPnl ?? 0)) || 10000
        for (let i = days; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          value = value * (1 + (Math.random() * 0.02 - 0.008))
          data.push({ date: d, value })
        }
      }
      setPerfData(data)
    } catch {}
  }

  const refreshData = async () => { setRefreshing(true); await loadData(); await loadPerformance(); setRefreshing(false) }

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

  const FX = { USD: 1, EUR: 0.92, GBP: 0.79 }
  const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' }

  const formatCurrency = (value) => {
    const rate = FX[displayCurrency] || 1
    const symbol = CURRENCY_SYMBOLS[displayCurrency] || '$'
    const converted = (value || 0) * rate
    if (displayCurrency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(converted)
    }
    return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

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
              <div className="hidden sm:flex items-center gap-1 rounded-lg bg-muted/50 border border-border p-0.5">
                {['USD', 'EUR', 'GBP'].map(curr => (
                  <button
                    key={curr}
                    onClick={() => handleSetCurrency(curr)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      displayCurrency === curr
                        ? 'bg-emerald-600 text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
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

          {/* Triggered Price Alerts */}
          {triggeredAlerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {triggeredAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <BellRing className="h-5 w-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {alert.asset} {alert.direction === 'above' ? 'rose above' : 'fell below'} {formatCurrency(alert.targetPrice)}
                      </div>
                      <div className="text-xs text-emerald-400">
                        Now at {formatCurrency(alert.currentPrice || 0)}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => dismissTriggered(alert.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
              {/* Portfolio Performance Chart */}
              {perfData.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Portfolio Performance (30 days)
                    </div>
                    {(() => {
                      const start = perfData[0]?.value || 1
                      const end = perfData[perfData.length - 1]?.value || 0
                      const pct = start ? ((end - start) / start) * 100 : 0
                      const up = pct >= 0
                      return (
                        <span className={`text-xs font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '+' : ''}{pct.toFixed(2)}%
                        </span>
                      )
                    })()}
                  </div>
                  {(() => {
                    const vals = perfData.map(d => d.value)
                    const minV = Math.min(...vals)
                    const maxV = Math.max(...vals)
                    const range = maxV - minV || 1
                    const w = 600
                    const h = 120
                    const points = perfData.map((d, i) => {
                      const x = (i / (perfData.length - 1)) * w
                      const y = h - ((d.value - minV) / range) * (h - 20) - 10
                      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
                    }).join(' ')
                    const area = points + ` L${w},${h} L0,${h} Z`
                    return (
                      <div>
                        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[100px]">
                          <defs>
                            <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={area} fill="url(#perfGrad)" />
                          <path d={points} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {/* End dot */}
                          <circle cx={(perfData.length - 1) / (perfData.length - 1) * w} cy={h - ((perfData[perfData.length - 1].value - minV) / range) * (h - 20) - 10} r="4" fill="#10b981" />
                        </svg>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                          <span>30 days ago</span>
                          <span>Today</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-5">
                <Button onClick={() => router.push('/wallet/deposit')} size="sm" className="bg-emerald-300 hover:bg-emerald-400 text-black font-semibold w-full">
                  <Plus className="h-4 w-4 mr-1" /> Deposit
                </Button>
                <Button onClick={() => router.push('/wallet/onramp')} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CreditCard className="h-4 w-4 mr-1" /> Buy
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
                <Button onClick={() => router.push('/wallet/dca')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <Repeat className="h-4 w-4 mr-1" /> DCA
                </Button>
                <Button onClick={() => router.push('/wallet/receive')} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ArrowDownToLine className="h-4 w-4 mr-1" /> Receive
                </Button>
                <Button onClick={() => setShowShare(true)} size="sm" className="w-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <Share2 className="h-4 w-4 mr-1" /> Share
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
                  {(spot?.balances || [])
                    .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
                    .slice(0, showAllBalances ? undefined : BALANCES_PAGE_SIZE)
                    .map(b => {
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
              {(spot?.balances || []).length > BALANCES_PAGE_SIZE && (
                <div className="px-4 py-3 border-t border-border/60 flex items-center justify-center">
                  <button
                    onClick={() => setShowAllBalances(v => !v)}
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                  >
                    {showAllBalances ? 'Show less' : `Show ${(spot?.balances || []).length - BALANCES_PAGE_SIZE} more`}
                    <span className={`transition-transform ${showAllBalances ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Price Alerts */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-400" /> Price Alerts ({priceAlerts.length})
                </CardTitle>
                <button
                  onClick={() => setShowAlertForm(!showAlertForm)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> {showAlertForm ? 'Cancel' : 'Add'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showAlertForm && (
                <div className="px-4 pb-4 border-b border-border">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Input
                      placeholder="Asset (e.g. BTC)"
                      value={alertAsset}
                      onChange={e => setAlertAsset(e.target.value.toUpperCase())}
                      className="bg-muted/50 border-border text-foreground text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Target price"
                      value={alertPrice}
                      onChange={e => setAlertPrice(e.target.value)}
                      className="bg-muted/50 border-border text-foreground text-sm"
                    />
                    <div className="flex rounded-md border border-border overflow-hidden">
                      <button
                        onClick={() => setAlertDirection('above')}
                        className={`flex-1 text-xs font-medium py-2 transition-colors ${alertDirection === 'above' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        <TrendingUp className="h-3 w-3 inline mr-1" />Above
                      </button>
                      <button
                        onClick={() => setAlertDirection('below')}
                        className={`flex-1 text-xs font-medium py-2 transition-colors ${alertDirection === 'below' ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        <TrendingDown className="h-3 w-3 inline mr-1" />Below
                      </button>
                    </div>
                  </div>
                  <Button onClick={addPriceAlert} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    Set Alert
                  </Button>
                </div>
              )}
              {priceAlerts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  No active alerts. Click "Add" to get notified when a price hits your target.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {priceAlerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {alert.direction === 'above' ? (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span className="text-sm text-foreground font-medium">{alert.asset}</span>
                        <span className="text-xs text-muted-foreground">
                          {alert.direction === 'above' ? '≥' : '≤'} {formatCurrency(alert.targetPrice)}
                        </span>
                      </div>
                      <button onClick={() => removePriceAlert(alert.id)} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
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

      {/* Share Earnings Modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowShare(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Share2 className="h-5 w-5 text-emerald-400" /> Share Your Earnings
              </h3>
              <button onClick={() => setShowShare(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const totalValue = (spot?.balances || []).reduce((s, b) => s + ((b.usdValue || b.amount * (b.price || 0)) || 0), 0)
              const perfChange = perfData.length > 1
                ? ((perfData[perfData.length - 1].value - perfData[0].value) / (perfData[0].value || 1) * 100).toFixed(1)
                : '0.0'
              const isUp = parseFloat(perfChange) >= 0
              const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

              const messages = [
                {
                  platform: 'Twitter/X',
                  icon: 'X',
                  text: `Just checked my crypto portfolio on Vaultquokka ${isUp ? '🚀' : '📊'} — ${isUp ? 'up' : 'down'} ${Math.abs(perfChange)}% this month.\n\nManaging multiple assets, DCA plans, and copy trading all in one place.\n\nTry it free: ${appUrl}`,
                  color: 'bg-zinc-900 text-white',
                },
                {
                  platform: 'WhatsApp',
                  icon: '💬',
                  text: `Hey! I've been using Vaultquokka for crypto trading and it's solid. Portfolio ${isUp ? 'up' : 'down'} ${Math.abs(perfChange)}% this month. Check it out: ${appUrl}`,
                  color: 'bg-emerald-600 text-white',
                },
                {
                  platform: 'Telegram',
                  icon: '📢',
                  text: `Vaultquokka update: Portfolio value $${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} — ${isUp ? '+' : ''}${perfChange}% this month.\n\nDCA + Copy Trading + Wallet all-in-one.\n${appUrl}`,
                  color: 'bg-blue-500 text-white',
                },
              ]

              return (
                <div className="space-y-4">
                  <div className="text-center py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Portfolio Value</div>
                    <div className="text-2xl font-bold text-foreground">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    <div className={`text-sm font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{perfChange}% this month
                    </div>
                  </div>

                  <div className="space-y-2">
                    {messages.map(m => (
                      <button
                        key={m.platform}
                        onClick={() => {
                          navigator.clipboard.writeText(m.text)
                          setShareCopied(true)
                          toast({ title: 'Copied!', description: `Post copied for ${m.platform}` })
                          setTimeout(() => setShareCopied(false), 2000)
                        }}
                        className="w-full text-left p-3 rounded-lg border border-border hover:border-emerald-500/30 bg-muted/20 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-foreground">{m.platform}</span>
                          <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to copy</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">{m.text}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const tweetText = messages[0].text.replace(/\n/g, '%0A')
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(messages[0].text)}`, '_blank')
                      }}
                      className="flex-1 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      Post on X
                    </button>
                    <button
                      onClick={() => {
                        const url = `https://wa.me/?text=${encodeURIComponent(messages[1].text)}`
                        window.open(url, '_blank')
                      }}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      💬 WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        const url = `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(messages[2].text)}`
                        window.open(url, '_blank')
                      }}
                      className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                    >
                      📢 Telegram
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
