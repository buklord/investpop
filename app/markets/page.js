'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp, TrendingDown, Search, Star,
  Menu, RefreshCw, Loader2, BarChart3,
  AlertCircle, CheckCircle, AlertTriangle, ChevronDown
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const MARGIN_RATE = 0.10
const SPREAD_PCT = 0.0005

// ── Institutional lot & pip helpers ──────────────────────────────────────────
// 1 standard forex lot = 100,000 units; all other assets: 1 lot = 1 unit
function getLotMultiplier(assetType) {
  return assetType === 'forex' ? 100000 : 1
}
// Smallest price move (pip) per asset class
function getPipSize(asset) {
  if (!asset) return 0.01
  if (asset.type === 'forex') return asset.symbol.includes('JPY') ? 0.01 : 0.0001
  if (asset.type === 'index')  return 1
  return 0.01  // crypto & stocks
}
// Default distance for auto-TP/SL: 20 pips for forex, 2 % for others
function getDefaultOffset(asset, price) {
  if (!asset || !price) return 0
  if (asset.type === 'forex') return getPipSize(asset) * 20
  return price * 0.02
}
// Human-readable distance from current price (pips or %)
function formatDistance(asset, currentPrice, targetPrice) {
  if (!asset || !currentPrice || !targetPrice) return ''
  const diff = targetPrice - currentPrice
  if (asset.type === 'forex') {
    const pip = getPipSize(asset)
    const pips = diff / pip
    return (pips >= 0 ? '+' : '') + pips.toFixed(1) + ' pips'
  }
  const pct = (diff / currentPrice) * 100
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
}
// Projected P&L if TP/SL is hit (for 1 lot, scaled by actual lots)
function projectedPnl(asset, lots, entryPrice, targetPrice) {
  if (!asset || !lots || !entryPrice || !targetPrice) return null
  const mult = getLotMultiplier(asset.type)
  return (targetPrice - entryPrice) * parseFloat(lots) * mult
}
// ─────────────────────────────────────────────────────────────────────────────

// TradingView symbol mapping for all asset types
const TV_SYMBOL_MAP = {
  // Forex
  EURUSD: 'FX:EURUSD', GBPUSD: 'FX:GBPUSD', USDJPY: 'FX:USDJPY',
  USDCHF: 'FX:USDCHF', USDCAD: 'FX:USDCAD', AUDUSD: 'FX:AUDUSD',
  NZDUSD: 'FX:NZDUSD', EURGBP: 'FX:EURGBP', EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  // Indices
  US30:   'TVC:DJI',   US100:  'TVC:NDQ',   SPX500: 'SP:SPX',
  GER40:  'TVC:DAX',   UK100:  'TVC:UKX',   FRA40:  'TVC:CAC40',
  JPN225: 'TVC:NI225', AUS200: 'TVC:ASX200', HK50:  'TVC:HSI',
  CHN50:  'TVC:CN50',
  // Crypto
  BTCUSD: 'BINANCE:BTCUSDT', ETHUSD: 'BINANCE:ETHUSDT',
  BNBUSD: 'BINANCE:BNBUSDT',  SOLUSD: 'BINANCE:SOLUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',  ADAUSD: 'BINANCE:ADAUSDT',
  DOGEUSD:'BINANCE:DOGEUSDT', AVAXUSD:'BINANCE:AVAXUSDT',
  DOTUSD: 'BINANCE:DOTUSDT',  LTCUSD: 'BINANCE:LTCUSDT',
}

function getTvSymbol(asset) {
  if (!asset) return null
  if (TV_SYMBOL_MAP[asset.symbol]) return TV_SYMBOL_MAP[asset.symbol]
  // Stocks: TradingView auto-resolves plain symbols like AAPL, MSFT
  return asset.symbol
}

function MarketsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [account, setAccount] = useState(null)
  const [assets, setAssets] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [quotes, setQuotes] = useState({})
  const [delayedData, setDelayedData] = useState(false)
  const [dataMode, setDataMode] = useState('live') // 'live' | 'simulated'
  const [positions, setPositions] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [flashMap, setFlashMap] = useState({})
  const prevQuotesRef = useRef({})
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [tradeAction, setTradeAction] = useState('BUY')
  const [lots, setLots] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  // Multiple TP levels (TP2, TP3) — optional partial close targets
  const [tp2Enabled, setTp2Enabled] = useState(false)
  const [tp3Enabled, setTp3Enabled] = useState(false)
  const [tp2Price, setTp2Price] = useState('')
  const [tp3Price, setTp3Price] = useState('')
  const [trailingStop, setTrailingStop] = useState(false)
  const [trading, setTrading] = useState(false)
  const [tradeResult, setTradeResult] = useState(null)
  const [chartCollapsed, setChartCollapsed] = useState(false)
  const chartContainerRef = useRef(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

  // 2-second fast-refresh: advance simulator tick + get updated bid/ask for selected asset
  useEffect(() => {
    if (!user || !selectedAsset) return
    const interval = setInterval(async () => {
      try {
        // Advance the price simulator (fire-and-forget, get updated prices back)
        const tickRes = await fetch('/api/market/tick', { method: 'POST' })
        if (tickRes.ok) {
          const tickData = await tickRes.json()
          const sym = selectedAsset.symbol.toUpperCase()
          const p = tickData.prices?.[sym]
          if (p) {
            setQuotes(prev => ({
              ...prev,
              [selectedAsset.symbol]: {
                ...prev[selectedAsset.symbol],
                price: p.mid,
                bid: p.bid,
                ask: p.ask,
                simulated: true,
              }
            }))
            setDataMode('simulated')
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [user, selectedAsset?.symbol, selectedAsset?.type])

  // 15-second full list refresh + account stats + data mode check
  useEffect(() => {
    if (!user || assets.length === 0) return
    const interval = setInterval(() => {
      fetchQuotesParallel(assets)
      fetch('/api/account').then(r => r.ok ? r.json() : null).then(d => { if (d) setAccount(d) })
      fetch('/api/market/status').then(r => r.ok ? r.json() : null).then(s => { if (s) setDataMode(s.mode) })
    }, 15000)
    return () => clearInterval(interval)
  }, [user, assets])

  // Auto-select asset from URL query (?select=SYMBOL&type=TYPE) once assets are loaded
  useEffect(() => {
    const selectSym = searchParams?.get('select')
    const selectType = searchParams?.get('type')
    if (!selectSym || assets.length === 0 || selectedAsset) return
    const found = assets.find(a => a.symbol === selectSym && (!selectType || a.type === selectType))
    if (found) setSelectedAsset(found)
  }, [assets, searchParams, selectedAsset])

  // TradingView chart: recreate when selected asset changes
  useEffect(() => {
    if (!selectedAsset || !chartContainerRef.current || chartCollapsed) return
    const tvSym = getTvSymbol(selectedAsset)
    if (!tvSym) return

    const buildWidget = () => {
      if (!chartContainerRef.current) return
      chartContainerRef.current.innerHTML = ''
      const containerId = 'tv-mkts-' + Date.now()
      const el = document.createElement('div')
      el.id = containerId
      el.style.height = '100%'
      chartContainerRef.current.appendChild(el)
      try {
        new window.TradingView.widget({
          width: '100%', height: '100%',
          symbol: tvSym, interval: 'D',
          timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
          toolbar_bg: '#161b22', enable_publishing: false,
          hide_side_toolbar: true, allow_symbol_change: false,
          container_id: containerId,
          backgroundColor: '#0d1117', gridColor: '#1e293b',
        })
      } catch {}
    }

    if (window.TradingView) {
      buildWidget()
    } else {
      const existing = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]')
      if (existing) {
        const poll = setInterval(() => { if (window.TradingView) { clearInterval(poll); buildWidget() } }, 100)
      } else {
        const s = document.createElement('script')
        s.src = 'https://s3.tradingview.com/tv.js'
        s.onload = buildWidget
        document.head.appendChild(s)
      }
    }
  }, [selectedAsset?.symbol, chartCollapsed])

  useEffect(() => {
    if (Object.keys(quotes).length === 0) return
    const newFlash = {}
    Object.entries(quotes).forEach(([sym, q]) => {
      const prev = prevQuotesRef.current[sym]
      if (prev?.price != null && q?.price != null && q.price !== prev.price) {
        newFlash[sym] = q.price > prev.price ? 'up' : 'down'
      }
    })
    if (Object.keys(newFlash).length > 0) {
      setFlashMap(newFlash)
      setTimeout(() => setFlashMap({}), 800)
    }
    prevQuotesRef.current = { ...quotes }
  }, [quotes])

  useEffect(() => {
    setTradeResult(null)
    setLots('')
    setTakeProfit('')
    setStopLoss('')
    setTpEnabled(false)
    setSlEnabled(false)
    setTrailingStop(false)
  }, [selectedAsset?.id, tradeAction])

  // Auto-populate Take Profit when checkbox is enabled
  useEffect(() => {
    if (tpEnabled && selectedAsset) {
      const price = quotes[selectedAsset.symbol]?.price
      if (price) {
        const offset = getDefaultOffset(selectedAsset, price)
        const tp = tradeAction === 'BUY' ? price + offset : price - offset
        setTakeProfit(tp.toFixed(getPipSize(selectedAsset) < 0.01 ? 5 : 2))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpEnabled])

  // Auto-populate Stop Loss when checkbox is enabled
  useEffect(() => {
    if (slEnabled && selectedAsset) {
      const price = quotes[selectedAsset.symbol]?.price
      if (price) {
        const offset = getDefaultOffset(selectedAsset, price)
        const sl = tradeAction === 'BUY' ? price - offset : price + offset
        setStopLoss(sl.toFixed(getPipSize(selectedAsset) < 0.01 ? 5 : 2))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slEnabled])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
      if (data.broadcastMessage) setBroadcastMessage(data.broadcastMessage)
    } catch { router.push('/') }
    finally { setLoading(false) }
  }

  const loadData = async () => {
    try {
      fetch('/api/assets/seed', { method: 'POST' }).catch(() => {})
      const [accountRes, assetsRes, watchlistRes, positionsRes, statusRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/assets'),
        fetch('/api/watchlist'),
        fetch('/api/positions?status=open'),
        fetch('/api/market/status'),
      ])
      if (accountRes.ok) setAccount(await accountRes.json())
      const assetsData = await assetsRes.json()
      const watchlistData = await watchlistRes.json()
      if (positionsRes.ok) { const d = await positionsRes.json(); setPositions(d.positions || []) }
      if (statusRes.ok) { const s = await statusRes.json(); setDataMode(s.mode) }
      setAssets(assetsData.assets || [])
      setWatchlist(watchlistData.watchlist || [])
      fetchQuotesParallel(assetsData.assets || [])
    } catch (err) { console.error('loadData:', err) }
  }

  // ONE batch request for all assets — replaces N parallel /api/quote calls.
  // Uses the /api/quotes/batch endpoint which calls Twelve Data's batch API
  // (20 symbols = 1 API credit instead of 20).
  const fetchQuotesParallel = async (assetList) => {
    if (!assetList || assetList.length === 0) return
    setQuotesLoading(true)
    try {
      const symbolsParam = assetList.map(a => `${a.symbol},${a.type}`).join('|')
      const res = await fetch('/api/quotes/batch?symbols=' + encodeURIComponent(symbolsParam))
      if (res.ok) {
        const data = await res.json()
        setQuotes(prev => ({ ...prev, ...data.quotes }))
        setDelayedData(!!data.delayed)
        // Detect simulation mode from any quote having simulated:true
        if (Object.values(data.quotes || {}).some(q => q?.simulated)) setDataMode('simulated')
      }
    } catch (err) {
      console.error('fetchQuotesBatch:', err)
    }
    setQuotesLoading(false)
  }

  const refreshData = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchQuotesParallel(assets),
      fetch('/api/account').then(r => r.ok ? r.json() : null).then(d => { if (d) setAccount(d) }),
    ])
    setRefreshing(false)
  }

  const toggleWatchlist = async (e, assetId, isWatched) => {
    e.stopPropagation()
    try {
      if (isWatched) {
        const item = watchlist.find(w => w.asset_id === assetId)
        if (item) {
          await fetch('/api/watchlist/' + item.id, { method: 'DELETE' })
          setWatchlist(prev => prev.filter(w => w.id !== item.id))
        }
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId }),
        })
        if (res.ok) {
          const data = await res.json()
          const asset = assets.find(a => a.id === assetId)
          setWatchlist(prev => [...prev, { id: data.id, asset_id: assetId, symbol: asset.symbol, name: asset.name, type: asset.type }])
        }
      }
    } catch (err) { console.error('toggleWatchlist:', err) }
  }

  const selectAsset = (asset, action) => {
    setSelectedAsset(asset)
    setTradeAction(action || 'BUY')
    // Immediately fetch quote for selected asset so trade ticket shows price right away
    if (!quotes[asset.symbol]) {
      fetch('/api/quote?symbol=' + asset.symbol + '&type=' + asset.type)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setQuotes(prev => ({ ...prev, [asset.symbol]: d })) })
        .catch(() => {})
    }
  }

  const executeTrade = async () => {
    const lotsNum = parseFloat(lots)
    if (!lotsNum || lotsNum <= 0 || !selectedAsset) return
    const price = quotes[selectedAsset.symbol]?.price
    if (!price) { setTradeResult({ success: false, message: 'Price unavailable. Please refresh.' }); return }
    // Convert lots → units for the API
    const actualQty = lotsNum * getLotMultiplier(selectedAsset.type)
    setTrading(true)
    setTradeResult(null)
    try {
      const body = { symbol: selectedAsset.symbol, type: selectedAsset.type, action: tradeAction, quantity: actualQty }
      if (tpEnabled && takeProfit) body.takeProfit = parseFloat(takeProfit)
      if (slEnabled && stopLoss) body.stopLoss = parseFloat(stopLoss)
      if (tp2Enabled && tp2Price) body.takeProfit2 = parseFloat(tp2Price)
      if (tp3Enabled && tp3Price) body.takeProfit3 = parseFloat(tp3Price)
      const res = await fetch('/api/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        const px = data.trade?.executedPrice
        setTradeResult({ success: true, message: tradeAction + ' executed' + (px ? ' at $' + px.toFixed(2) : '') })
        setLots('')
        fetch('/api/account').then(r => r.ok ? r.json() : null).then(d => { if (d) setAccount(d) })
        fetch('/api/positions?status=open').then(r => r.ok ? r.json() : null).then(d => { if (d) setPositions(d.positions || []) })
      } else {
        setTradeResult({ success: false, message: data.error })
      }
    } catch { setTradeResult({ success: false, message: 'Network error. Please try again.' }) }
    finally { setTrading(false) }
  }

  const fmt$ = (v) => {
    if (v == null || isNaN(v)) return '\u2014'
    if (Math.abs(v) >= 1) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
    return '$' + v.toFixed(4)
  }
  const fmtPct = (v) => (v == null ? '\u2014' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%')

  const filteredAssets = useMemo(() => assets.filter(a => {
    const q = searchQuery.toLowerCase()
    const matchSearch = a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    const matchTab = activeTab === 'all' ||
      (activeTab === 'stocks' && a.type === 'stock') ||
      (activeTab === 'crypto' && a.type === 'crypto') ||
      (activeTab === 'forex'  && a.type === 'forex') ||
      (activeTab === 'index'  && a.type === 'index') ||
      (activeTab === 'watchlist' && watchlist.some(w => w.asset_id === a.id))
    return matchSearch && matchTab
  }), [assets, searchQuery, activeTab, watchlist])

  const selQuote = selectedAsset ? quotes[selectedAsset.symbol] : null
  const lotsNum = parseFloat(lots) || 0
  const lotMult = getLotMultiplier(selectedAsset?.type)
  const qty = lotsNum * lotMult           // actual units for value/margin math
  // MT-style: BUY executes at ask (higher), SELL executes at bid (lower)
  const tradePrice = tradeAction === 'BUY'
    ? (selQuote?.ask || selQuote?.price || 0)
    : (selQuote?.bid || selQuote?.price || 0)
  const tradeValue = qty * tradePrice
  const reqMargin = tradeValue * MARGIN_RATE
  const fee = tradeValue * 0.001
  const totalCost = tradeValue + fee
  const availCash = account?.balance || 0
  const insuffFunds = tradeAction === 'BUY' && lotsNum > 0 && totalCost > availCash
  const currentPos = selectedAsset ? positions.find(p => p.symbol === selectedAsset.symbol && p.status === 'OPEN') : null
  const pipSize = getPipSize(selectedAsset)
  // lot presets depending on asset class
  const lotPresets = selectedAsset?.type === 'forex' ? [0.01, 0.10, 1.00] : [1, 5, 10]
  // Rounding precision for lot arithmetic (match smallest preset)
  const lotPrecision = selectedAsset?.type === 'forex' ? 100000 : 10

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">
      {broadcastMessage && (
        <div className="bg-red-600/90 border-b border-red-500 px-4 py-1.5 flex items-center gap-2 overflow-hidden flex-shrink-0 z-50">
          <AlertTriangle className="h-3.5 w-3.5 text-white flex-shrink-0" />
          <div className="text-white text-xs font-medium whitespace-nowrap animate-marquee">{broadcastMessage}</div>
        </div>
      )}

      {/* Account stats header desktop */}
      <div className="hidden lg:flex bg-[#0d1117] border-b border-slate-800 px-4 h-11 items-center gap-6 flex-shrink-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-bold text-white">InvestPop</span>
        </div>
        <div className="h-4 w-px bg-slate-700" />
        <div className="flex items-center gap-6 text-xs">
          <span className="text-slate-500">Available Cash: <span className="text-white font-medium">{fmt$(account?.balance)}</span></span>
          <span className="text-slate-500">Equity: <span className="text-white font-medium">{fmt$(account?.equity)}</span></span>
          <span className="text-slate-500">Open P&L:{' '}
            <span className={(account?.openPnl || 0) >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {(account?.openPnl || 0) >= 0 ? '+' : ''}{fmt$(account?.openPnl)}
            </span>
          </span>
          <span className="text-slate-500">Positions: <span className="text-white font-medium">{positions.length}</span></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium"
          >
            ● Live Market
          </span>
          <button onClick={refreshData} disabled={refreshing} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <RefreshCw className={'h-3.5 w-3.5' + (refreshing ? ' animate-spin' : '')} />
          </button>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden bg-[#161b22] border-b border-slate-800 px-3 py-2.5 flex items-center justify-between flex-shrink-0 z-40">
        <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu className="h-5 w-5" /></button>
        <span className="font-bold text-white text-sm">Markets</span>
        <button onClick={refreshData} disabled={refreshing} className="text-slate-400 p-1">
          <RefreshCw className={'h-4 w-4' + (refreshing ? ' animate-spin' : '')} />
        </button>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar currentPage="/markets" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Center: Market list */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-[#161b22] flex-shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 text-xs"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-800 h-8">
                <TabsTrigger value="all"       className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">All</TabsTrigger>
                <TabsTrigger value="forex"     className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Forex</TabsTrigger>
                <TabsTrigger value="index"     className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Indices</TabsTrigger>
                <TabsTrigger value="stocks"    className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Stocks</TabsTrigger>
                <TabsTrigger value="crypto"    className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Crypto</TabsTrigger>
                <TabsTrigger value="watchlist" className="data-[state=active]:bg-emerald-600 text-xs px-2 h-6">
                  <Star className="h-3 w-3 mr-1" />Watchlist
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* TradingView chart panel — shown when an asset is selected on desktop */}
          {selectedAsset && (
            <div className="hidden lg:flex flex-col border-b border-slate-800 flex-shrink-0" style={{ height: chartCollapsed ? 'auto' : '280px' }}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d1117] border-b border-slate-800/60 flex-shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                  {selectedAsset.symbol} · {selectedAsset.name}
                  {selQuote && (
                    <span className={'ml-2 font-mono ' + ((selQuote.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {fmt$(selQuote.price)}
                      <span className="ml-1 text-slate-500">{fmtPct(selQuote.changePercent)}</span>
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setChartCollapsed(c => !c)}
                  className="text-slate-500 hover:text-slate-300 p-0.5"
                  title={chartCollapsed ? 'Expand chart' : 'Collapse chart'}
                >
                  <ChevronDown className={'h-4 w-4 transition-transform ' + (chartCollapsed ? 'rotate-180' : '')} />
                </button>
              </div>
              {!chartCollapsed && (
                <div ref={chartContainerRef} className="flex-1 w-full bg-[#0d1117]" />
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {quotesLoading && Object.keys(quotes).length === 0 && (
              <div className="p-3 space-y-1.5">
                {[...Array(10)].map((_, i) => <div key={i} className="h-11 animate-shimmer rounded" />)}
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#0d1117] border-b border-slate-800 text-slate-500">
                    <th className="text-left px-3 py-2.5 font-medium">Instrument</th>
                    <th className="text-right px-3 py-2.5 font-medium">Change</th>
                    <th className="text-center px-2 py-2.5 font-medium w-28">Sell</th>
                    <th className="text-center px-2 py-2.5 font-medium w-28">Buy</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map(asset => {
                    const q = quotes[asset.symbol]
                    const isWatched = watchlist.some(w => w.asset_id === asset.id)
                    const isSelected = selectedAsset?.id === asset.id
                    const isPositive = (q?.changePercent || 0) >= 0
                    const spread = (q?.price || 0) * SPREAD_PCT
                    const sellPx = q?.price ? q.price - spread : null
                    const buyPx  = q?.price ? q.price + spread : null
                    const flashCls = flashMap[asset.symbol] === 'up' ? 'price-flash-green' : flashMap[asset.symbol] === 'down' ? 'price-flash-red' : ''
                    return (
                      <tr
                        key={asset.id}
                        onClick={() => selectAsset(asset, 'BUY')}
                        className={'border-b border-slate-800/60 cursor-pointer transition-colors ' + flashCls + ' ' + (isSelected ? 'bg-emerald-600/10 border-l-2 border-l-emerald-500' : 'hover:bg-slate-800/40')}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' +
                              (asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' :
                               asset.type === 'forex'  ? 'bg-purple-500/10 text-purple-400' :
                               asset.type === 'index'  ? 'bg-yellow-500/10 text-yellow-400' :
                                                         'bg-blue-500/10 text-blue-400')
                            }>
                              {asset.type === 'crypto' ? '\u20BF' :
                               asset.type === 'forex'  ? '\u20AC' :
                               asset.type === 'index'  ? '\u25B3' :
                               asset.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{asset.symbol}</div>
                              <div className="text-slate-500 truncate max-w-[130px]">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {q ? (
                            <span className={'font-medium ' + (isPositive ? 'text-emerald-400' : 'text-red-400')}>
                              {fmtPct(q.changePercent)}
                            </span>
                          ) : quotesLoading ? (
                            <div className="h-3 w-10 animate-shimmer rounded ml-auto" />
                          ) : '\u2014'}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={e => { e.stopPropagation(); selectAsset(asset, 'SELL') }}
                            className="w-full px-2 py-1.5 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 font-mono font-semibold border border-red-500/20 hover:border-red-400/50 transition-colors text-xs"
                          >
                            {sellPx ? fmt$(sellPx) : <span className="text-slate-600">\u2014</span>}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={e => { e.stopPropagation(); selectAsset(asset, 'BUY') }}
                            className="w-full px-2 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 font-mono font-semibold border border-emerald-500/20 hover:border-emerald-400/50 transition-colors text-xs"
                          >
                            {buyPx ? fmt$(buyPx) : <span className="text-slate-600">\u2014</span>}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={e => toggleWatchlist(e, asset.id, isWatched)}
                            className={'p-1 rounded transition-colors ' + (isWatched ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400')}
                          >
                            <Star className={'h-3.5 w-3.5 ' + (isWatched ? 'fill-current' : '')} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredAssets.length === 0 && !quotesLoading && (
                <div className="text-center py-16">
                  <Search className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No assets found</p>
                </div>
              )}
            </div>

            {/* Mobile list */}
            <div className="block sm:hidden divide-y divide-slate-800">
              {filteredAssets.map(asset => {
                const q = quotes[asset.symbol]
                const isWatched = watchlist.some(w => w.asset_id === asset.id)
                const isPositive = (q?.changePercent || 0) >= 0
                return (
                  <div key={asset.id} className="p-3 flex items-center gap-3">
                    <Link href={'/asset/' + asset.symbol + '?type=' + asset.type} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ' +
                        (asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' :
                         asset.type === 'forex'  ? 'bg-purple-500/10 text-purple-400' :
                         asset.type === 'index'  ? 'bg-yellow-500/10 text-yellow-400' :
                                                   'bg-blue-500/10 text-blue-400')}>
                        {asset.type === 'crypto' ? '\u20BF' :
                         asset.type === 'forex'  ? '\u20AC' :
                         asset.type === 'index'  ? '\u25B3' :
                         asset.symbol.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white text-sm">{asset.symbol}</div>
                        <div className="text-xs text-slate-500 truncate">{asset.name}</div>
                      </div>
                    </Link>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-white text-sm">
                        {quotesLoading && !q ? <Loader2 className="h-4 w-4 animate-spin inline" /> : fmt$(q?.price)}
                      </div>
                      <div className={'text-xs flex items-center justify-end gap-0.5 ' + (isPositive ? 'text-emerald-400' : 'text-red-400')}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {fmtPct(q?.changePercent)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={e => toggleWatchlist(e, asset.id, isWatched)} className={'p-1.5 ' + (isWatched ? 'text-yellow-400' : 'text-slate-500')}>
                        <Star className={'h-4 w-4 ' + (isWatched ? 'fill-current' : '')} />
                      </button>
                      <Link href={'/asset/' + asset.symbol + '?type=' + asset.type}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs">Trade</Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Trade ticket desktop */}
        <div className="hidden lg:flex w-72 xl:w-80 bg-[#161b22] border-l border-slate-800 flex-col flex-shrink-0">
          {selectedAsset ? (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ' +
                    (selectedAsset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' :
                     selectedAsset.type === 'forex'  ? 'bg-purple-500/10 text-purple-400' :
                     selectedAsset.type === 'index'  ? 'bg-yellow-500/10 text-yellow-400' :
                                                       'bg-blue-500/10 text-blue-400')}>
                    {selectedAsset.type === 'crypto' ? '\u20BF' :
                     selectedAsset.type === 'forex'  ? '\u20AC' :
                     selectedAsset.type === 'index'  ? '\u25B3' :
                     selectedAsset.symbol.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm">{selectedAsset.symbol}</div>
                    <div className="text-xs text-slate-500 truncate">{selectedAsset.name}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  {selQuote ? (
                    <>
                      {/* Show Bid/Ask when simulator has them, otherwise mid price */}
                      {selQuote.bid && selQuote.ask ? (
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-slate-500">Bid</span>
                            <span className="text-red-400 font-mono font-bold">{fmt$(selQuote.bid)}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-slate-500">Ask</span>
                            <span className="text-emerald-400 font-mono font-bold">{fmt$(selQuote.ask)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-white font-mono font-bold text-sm">{fmt$(selQuote.price)}</div>
                      )}
                      <div className={'text-xs ' + ((selQuote.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtPct(selQuote.changePercent)}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <div className="h-4 w-20 animate-shimmer rounded" />
                      <div className="h-3 w-12 animate-shimmer rounded ml-auto" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Buy / Sell toggle */}
                <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg">
                  <button
                    onClick={() => setTradeAction('BUY')}
                    className={'py-2 rounded-md text-sm font-bold transition-colors ' + (tradeAction === 'BUY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white')}
                  >Buy</button>
                  <button
                    onClick={() => setTradeAction('SELL')}
                    disabled={!currentPos}
                    className={'py-2 rounded-md text-sm font-bold transition-colors ' + (tradeAction === 'SELL' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed')}
                  >Sell</button>
                </div>

                {/* Open position hint */}
                {currentPos && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-400">
                    Open: {selectedAsset?.type === 'forex'
                      ? (currentPos.quantity / 100000).toFixed(2) + ' lots'
                      : currentPos.quantity + ' units'
                    } @ {fmt$(currentPos.entry_price)}
                  </div>
                )}

                {/* ── Lot Size ─────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">
                      {selectedAsset?.type === 'forex' ? 'Lots (1 lot = 100,000 units)' : 'Amount (units)'}
                    </label>
                    {lotsNum > 0 && tradePrice > 0 && (
                      <span className="text-xs text-slate-500 font-mono">{fmt$(tradeValue)}</span>
                    )}
                  </div>

                  {/* Stepper row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const step = lotPresets[0]
                        setLots(v => String(Math.max(0, Math.round(((parseFloat(v) || 0) - step) * lotPrecision) / lotPrecision)))}
                      }
                      className="w-10 h-10 rounded bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold flex-shrink-0 transition-colors"
                    >−</button>
                    <Input
                      type="number" step="any" min="0"
                      placeholder={selectedAsset?.type === 'forex' ? '0.01' : '1'}
                      value={lots}
                      onChange={e => setLots(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-10 text-base text-center font-mono"
                    />
                    <button
                      onClick={() => {
                        const step = lotPresets[0]
                        setLots(v => String(Math.round(((parseFloat(v) || 0) + step) * lotPrecision) / lotPrecision))
                      }}
                      className="w-10 h-10 rounded bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold flex-shrink-0 transition-colors"
                    >+</button>
                  </div>

                  {/* Preset buttons */}
                  <div className="flex gap-1.5 mt-2">
                    {lotPresets.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setLots(String(preset))}
                        className={'flex-1 py-1 rounded text-xs font-semibold transition-colors border ' +
                          (parseFloat(lots) === preset
                            ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                          )}
                      >
                        {preset < 1 ? preset.toFixed(2) : preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Trade summary ───────────────────────── */}
                <div className="bg-slate-900/80 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Notional Value</span>
                    <span className="text-white font-mono font-semibold">{qty > 0 && tradePrice ? fmt$(tradeValue) : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-400/90">Margin Required</span>
                    <span className={'font-mono font-bold ' + (qty > 0 ? 'text-amber-400' : 'text-slate-600')}>{qty > 0 && tradePrice ? fmt$(reqMargin) : '—'}</span>
                  </div>
                  {selectedAsset?.type === 'forex' && lotsNum > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Pip Value</span>
                      <span className="text-slate-300 font-mono">{fmt$(pipSize * lotsNum * lotMult)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Available Cash</span>
                  <span className={availCash > 0 ? 'text-emerald-400' : 'text-slate-400'}>{fmt$(availCash)}</span>
                </div>

                {insuffFunds && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2 text-xs">
                    <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-red-400 font-semibold">Insufficient Funds</div>
                      <Link href="/wallet" className="text-red-300 underline hover:text-red-200 mt-0.5 block">Add Funds →</Link>
                    </div>
                  </div>
                )}

                {/* ── Risk Management ─────────────────────── */}
                <div className="space-y-2 text-xs border-t border-slate-800/60 pt-3">
                  <div className="text-slate-500 text-xs mb-1 font-medium">Risk Management</div>

                  {/* Take Profit */}
                  <div>
                    <label className="flex items-center gap-2 text-emerald-500/80 cursor-pointer mb-1.5">
                      <input type="checkbox" checked={tpEnabled} onChange={e => setTpEnabled(e.target.checked)} className="accent-emerald-500" />
                      Take Profit (TP)
                    </label>
                    {tpEnabled && (
                      <>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setTakeProfit(v => {
                              const n = (parseFloat(v) || tradePrice) - pipSize
                              return n.toFixed(pipSize < 0.01 ? 5 : 2)
                            })}
                            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base transition-colors"
                          >−</button>
                          <Input
                            type="number" step="any" placeholder="Price"
                            value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
                            className="bg-slate-900 border-emerald-600/40 text-white h-8 text-xs text-center font-mono"
                          />
                          <button
                            onClick={() => setTakeProfit(v => {
                              const n = (parseFloat(v) || tradePrice) + pipSize
                              return n.toFixed(pipSize < 0.01 ? 5 : 2)
                            })}
                            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base transition-colors"
                          >+</button>
                        </div>
                        {takeProfit && tradePrice > 0 && (
                          <div className="flex justify-between mt-1 px-1">
                            <span className="text-slate-600">{formatDistance(selectedAsset, tradePrice, parseFloat(takeProfit))}</span>
                            {lotsNum > 0 && (() => {
                              const pnl = projectedPnl(selectedAsset, lotsNum, tradePrice, parseFloat(takeProfit))
                              return pnl != null ? (
                                <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {pnl >= 0 ? '+' : ''}{fmt$(pnl)}
                                </span>
                              ) : null
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Stop Loss */}
                  <div>
                    <label className="flex items-center gap-2 text-red-500/80 cursor-pointer mb-1.5">
                      <input type="checkbox" checked={slEnabled} onChange={e => setSlEnabled(e.target.checked)} className="accent-red-500" />
                      Stop Loss (SL)
                    </label>
                    {slEnabled && (
                      <>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setStopLoss(v => {
                              const n = (parseFloat(v) || tradePrice) - pipSize
                              return n.toFixed(pipSize < 0.01 ? 5 : 2)
                            })}
                            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base transition-colors"
                          >−</button>
                          <Input
                            type="number" step="any" placeholder="Price"
                            value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                            className="bg-slate-900 border-red-600/40 text-white h-8 text-xs text-center font-mono"
                          />
                          <button
                            onClick={() => setStopLoss(v => {
                              const n = (parseFloat(v) || tradePrice) + pipSize
                              return n.toFixed(pipSize < 0.01 ? 5 : 2)
                            })}
                            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base transition-colors"
                          >+</button>
                        </div>
                        {stopLoss && tradePrice > 0 && (
                          <div className="flex justify-between mt-1 px-1">
                            <span className="text-slate-600">{formatDistance(selectedAsset, tradePrice, parseFloat(stopLoss))}</span>
                            {lotsNum > 0 && (() => {
                              const pnl = projectedPnl(selectedAsset, lotsNum, tradePrice, parseFloat(stopLoss))
                              return pnl != null ? (
                                <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {pnl >= 0 ? '+' : ''}{fmt$(pnl)}
                                </span>
                              ) : null
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-blue-400/80 cursor-pointer">
                    <input type="checkbox" checked={trailingStop} onChange={e => setTrailingStop(e.target.checked)} className="accent-blue-500" />
                    Trailing Stop
                  </label>

                  {/* TP2 — second take-profit level */}
                  {tpEnabled && (
                    <div>
                      <label className="flex items-center gap-2 text-emerald-400/60 cursor-pointer mb-1.5">
                        <input type="checkbox" checked={tp2Enabled} onChange={e => setTp2Enabled(e.target.checked)} className="accent-emerald-500" />
                        <span>TP2 <span className="text-slate-500">(optional 2nd target)</span></span>
                      </label>
                      {tp2Enabled && (
                        <>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTp2Price(v => ((parseFloat(v) || tradePrice) - pipSize).toFixed(pipSize < 0.01 ? 5 : 2))} className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base">−</button>
                            <Input type="number" step="any" placeholder="TP2 Price" value={tp2Price} onChange={e => setTp2Price(e.target.value)} className="bg-slate-900 border-emerald-500/20 text-white h-8 text-xs text-center font-mono" />
                            <button onClick={() => setTp2Price(v => ((parseFloat(v) || tradePrice) + pipSize).toFixed(pipSize < 0.01 ? 5 : 2))} className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base">+</button>
                          </div>
                          {tp2Price && tradePrice > 0 && lotsNum > 0 && (() => {
                            const pnl = projectedPnl(selectedAsset, lotsNum, tradePrice, parseFloat(tp2Price))
                            return pnl != null ? <div className="text-right mt-1 px-1"><span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{fmt$(pnl)}</span></div> : null
                          })()}
                        </>
                      )}
                    </div>
                  )}

                  {/* TP3 — third take-profit level */}
                  {tpEnabled && tp2Enabled && (
                    <div>
                      <label className="flex items-center gap-2 text-emerald-400/40 cursor-pointer mb-1.5">
                        <input type="checkbox" checked={tp3Enabled} onChange={e => setTp3Enabled(e.target.checked)} className="accent-emerald-500" />
                        <span>TP3 <span className="text-slate-500">(optional 3rd target)</span></span>
                      </label>
                      {tp3Enabled && (
                        <>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTp3Price(v => ((parseFloat(v) || tradePrice) - pipSize).toFixed(pipSize < 0.01 ? 5 : 2))} className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base">−</button>
                            <Input type="number" step="any" placeholder="TP3 Price" value={tp3Price} onChange={e => setTp3Price(e.target.value)} className="bg-slate-900 border-emerald-500/10 text-white h-8 text-xs text-center font-mono" />
                            <button onClick={() => setTp3Price(v => ((parseFloat(v) || tradePrice) + pipSize).toFixed(pipSize < 0.01 ? 5 : 2))} className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex-shrink-0 text-base">+</button>
                          </div>
                          {tp3Price && tradePrice > 0 && lotsNum > 0 && (() => {
                            const pnl = projectedPnl(selectedAsset, lotsNum, tradePrice, parseFloat(tp3Price))
                            return pnl != null ? <div className="text-right mt-1 px-1"><span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{fmt$(pnl)}</span></div> : null
                          })()}
                        </>
                      )}
                    </div>
                  )}

                </div>{/* end Risk Management */}

                {/* Trade result */}
                {tradeResult && (
                  <div className={'rounded-lg p-3 flex items-start gap-2 text-xs ' + (tradeResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    {tradeResult.success ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    <span>{tradeResult.message}</span>
                  </div>
                )}

                {/* Execute button — label shows lots + symbol */}
                <Button
                  onClick={executeTrade}
                  disabled={trading || lotsNum <= 0 || !selQuote?.price || insuffFunds || (tradeAction === 'SELL' && !currentPos)}
                  className={'w-full h-11 text-sm font-bold ' + (tradeAction === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500') + ' text-white disabled:opacity-40'}
                >
                  {trading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> :
                   !selQuote ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading price...</> :
                   lotsNum > 0
                     ? `${tradeAction} ${lotsNum} ${selectedAsset?.type === 'forex' ? 'Lots' : selectedAsset.symbol}`
                     : `${tradeAction} ${selectedAsset.symbol}`}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-slate-600" />
              </div>
              <div className="text-slate-400 text-sm font-medium mb-1">Select an Instrument</div>
              <div className="text-slate-600 text-xs">Click any row or the Sell / Buy buttons to open the trade ticket</div>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}

export default function MarketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <MarketsPageContent />
    </Suspense>
  )
}
