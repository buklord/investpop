'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp, TrendingDown, Search, Star,
  Menu, RefreshCw, Loader2, BarChart3,
  AlertCircle, CheckCircle, AlertTriangle
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

const MARGIN_RATE = 0.10
const SPREAD_PCT = 0.0005

export default function MarketsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [account, setAccount] = useState(null)
  const [assets, setAssets] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [quotes, setQuotes] = useState({})
  const [positions, setPositions] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [flashMap, setFlashMap] = useState({})
  const prevQuotesRef = useRef({})
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [tradeAction, setTradeAction] = useState('BUY')
  const [quantity, setQuantity] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [tpEnabled, setTpEnabled] = useState(false)
  const [slEnabled, setSlEnabled] = useState(false)
  const [trading, setTrading] = useState(false)
  const [tradeResult, setTradeResult] = useState(null)

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadData() }, [user])

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
    setQuantity('')
    setTakeProfit('')
    setStopLoss('')
    setTpEnabled(false)
    setSlEnabled(false)
  }, [selectedAsset?.id, tradeAction])

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
      const [accountRes, assetsRes, watchlistRes, positionsRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/assets'),
        fetch('/api/watchlist'),
        fetch('/api/positions?status=open'),
      ])
      if (accountRes.ok) setAccount(await accountRes.json())
      const assetsData = await assetsRes.json()
      const watchlistData = await watchlistRes.json()
      if (positionsRes.ok) { const d = await positionsRes.json(); setPositions(d.positions || []) }
      setAssets(assetsData.assets || [])
      setWatchlist(watchlistData.watchlist || [])
      fetchQuotesParallel(assetsData.assets || [])
    } catch (err) { console.error('loadData:', err) }
  }

  const fetchQuotesParallel = async (assetList) => {
    setQuotesLoading(true)
    const results = await Promise.all(
      assetList.map(async (a) => {
        try {
          const res = await fetch('/api/quote?symbol=' + a.symbol + '&type=' + a.type)
          if (res.ok) return { symbol: a.symbol, data: await res.json() }
        } catch {}
        return null
      })
    )
    const newQuotes = {}
    results.forEach(r => { if (r) newQuotes[r.symbol] = r.data })
    setQuotes(newQuotes)
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
  }

  const executeTrade = async () => {
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0 || !selectedAsset) return
    const price = quotes[selectedAsset.symbol]?.price
    if (!price) { setTradeResult({ success: false, message: 'Price unavailable. Please refresh.' }); return }
    setTrading(true)
    setTradeResult(null)
    try {
      const body = { symbol: selectedAsset.symbol, type: selectedAsset.type, action: tradeAction, quantity: qty }
      if (tpEnabled && takeProfit) body.takeProfit = parseFloat(takeProfit)
      if (slEnabled && stopLoss) body.stopLoss = parseFloat(stopLoss)
      const res = await fetch('/api/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        const px = data.trade?.executedPrice
        setTradeResult({ success: true, message: tradeAction + ' executed' + (px ? ' at $' + px.toFixed(2) : '') })
        setQuantity('')
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
      (activeTab === 'watchlist' && watchlist.some(w => w.asset_id === a.id))
    return matchSearch && matchTab
  }), [assets, searchQuery, activeTab, watchlist])

  const selQuote = selectedAsset ? quotes[selectedAsset.symbol] : null
  const qty = parseFloat(quantity) || 0
  const tradePrice = selQuote?.price || 0
  const tradeValue = qty * tradePrice
  const reqMargin = tradeValue * MARGIN_RATE
  const fee = tradeValue * 0.001
  const totalCost = tradeValue + fee
  const availCash = account?.balance || 0
  const insuffFunds = tradeAction === 'BUY' && qty > 0 && totalCost > availCash
  const currentPos = selectedAsset ? positions.find(p => p.symbol === selectedAsset.symbol && p.status === 'OPEN') : null

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
        <div className="ml-auto">
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
                <TabsTrigger value="stocks"    className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Stocks</TabsTrigger>
                <TabsTrigger value="crypto"    className="data-[state=active]:bg-emerald-600 text-xs px-3 h-6">Crypto</TabsTrigger>
                <TabsTrigger value="watchlist" className="data-[state=active]:bg-emerald-600 text-xs px-2 h-6">
                  <Star className="h-3 w-3 mr-1" />Watchlist
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

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
                            <div className={'w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ' + (asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400')}>
                              {asset.type === 'crypto' ? '\u20BF' : asset.symbol.charAt(0)}
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
                      <div className={'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm ' + (asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400')}>
                        {asset.type === 'crypto' ? '\u20BF' : asset.symbol.charAt(0)}
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
          {selectedAsset && selQuote ? (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ' + (selectedAsset.type === 'crypto' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400')}>
                    {selectedAsset.type === 'crypto' ? '\u20BF' : selectedAsset.symbol.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm">{selectedAsset.symbol}</div>
                    <div className="text-xs text-slate-500 truncate">{selectedAsset.name}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-white font-mono font-bold text-sm">{fmt$(selQuote.price)}</div>
                  <div className={'text-xs ' + ((selQuote.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmtPct(selQuote.changePercent)}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                {currentPos && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-400">
                    Open: {currentPos.quantity} @ {fmt$(currentPos.entry_price)}
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">
                    {'Quantity' + (tradeAction === 'SELL' && currentPos ? ' (max ' + currentPos.quantity + ')' : '')}
                  </label>
                  <Input
                    type="number" step="any" min="0"
                    max={tradeAction === 'SELL' && currentPos ? currentPos.quantity : undefined}
                    placeholder="0.00" value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-10 text-base"
                  />
                </div>
                <div className="bg-slate-900/80 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Market Price</span>
                    <span className="text-white font-mono">{fmt$(tradePrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trade Value</span>
                    <span className="text-white font-mono">{qty > 0 ? fmt$(tradeValue) : '\u2014'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/80">Required Margin <span className="text-slate-600">(10%)</span></span>
                    <span className={'font-mono font-semibold ' + (qty > 0 ? 'text-amber-400' : 'text-slate-600')}>{qty > 0 ? fmt$(reqMargin) : '\u2014'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fee (0.1%)</span>
                    <span className="text-slate-400 font-mono">{qty > 0 ? fmt$(fee) : '\u2014'}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 flex justify-between font-medium">
                    <span className="text-slate-300">{tradeAction === 'BUY' ? 'Total Cost' : 'Est. Proceeds'}</span>
                    <span className="text-white font-mono">{qty > 0 ? fmt$(totalCost) : '\u2014'}</span>
                  </div>
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
                {tradeAction === 'BUY' && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={tpEnabled} onChange={e => setTpEnabled(e.target.checked)} className="accent-emerald-500" />
                        Close at Profit
                      </label>
                      {tpEnabled && (
                        <Input type="number" step="any" placeholder="Price" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
                          className="w-28 h-7 bg-slate-900 border-slate-700 text-white text-xs" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={slEnabled} onChange={e => setSlEnabled(e.target.checked)} className="accent-red-500" />
                        Close at Loss
                      </label>
                      {slEnabled && (
                        <Input type="number" step="any" placeholder="Price" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                          className="w-28 h-7 bg-slate-900 border-slate-700 text-white text-xs" />
                      )}
                    </div>
                  </div>
                )}
                {tradeResult && (
                  <div className={'rounded-lg p-3 flex items-start gap-2 text-xs ' + (tradeResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    {tradeResult.success ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    <span>{tradeResult.message}</span>
                  </div>
                )}
                <Button
                  onClick={executeTrade}
                  disabled={trading || qty <= 0 || !selQuote?.price || insuffFunds || (tradeAction === 'SELL' && !currentPos)}
                  className={'w-full h-11 text-sm font-bold ' + (tradeAction === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500') + ' text-white disabled:opacity-40'}
                >
                  {trading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : tradeAction + ' ' + selectedAsset.symbol}
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
