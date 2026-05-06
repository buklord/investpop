'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, BarChart2, List, LayoutGrid, Star, Bell, X as XIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'
import AppSidebar from '@/components/AppSidebar'
import InstrumentChart from '@/components/trading/InstrumentChart'
import OrderTicket from '@/components/trading/OrderTicket'
import PositionView from '@/components/trading/PositionView'
import { formatPrice, getPipSize } from '@/lib/trading/pips'

// ── Constants ──────────────────────────────────────────────────────────────
const COMMODITY_SYMBOLS = new Set(['XAUUSD', 'XAGUSD', 'USOIL', 'XPTUSD', 'NATGAS'])

const CATEGORIES = [
  { key: 'all',       label: 'All'         },
  { key: 'forex',     label: 'Forex'       },
  { key: 'crypto',    label: 'Crypto'      },
  { key: 'stock',     label: 'Stocks'      },
  { key: 'index',     label: 'Indices'     },
  { key: 'commodity', label: 'Commodities' },
]

const CAT_COLORS = {
  forex:     'bg-blue-500/20 text-blue-300',
  crypto:    'bg-amber-500/20 text-amber-300',
  stock:     'bg-purple-500/20 text-purple-300',
  index:     'bg-cyan-500/20 text-cyan-300',
  commodity: 'bg-orange-500/20 text-orange-300',
}

function assetCategory(a) {
  if (COMMODITY_SYMBOLS.has(a.symbol)) return 'commodity'
  return a.type
}

function calcPct(quote) {
  const mid  = Number(quote?.mid)
  const open = Number(quote?.open ?? quote?.high)
  if (!Number.isFinite(mid) || !Number.isFinite(open) || open === 0) return null
  return ((mid - open) / open) * 100
}

// 6-level scale — small moves (±0.5%) stay near-neutral; strong colors only for big moves
function heatmapColor(pct) {
  if (pct == null) return 'bg-white/[0.03] border-white/[0.06] text-white/35'
  if (pct >=  2)   return 'bg-emerald-500/60 border-emerald-400/35 text-white'
  if (pct >=  0.5) return 'bg-emerald-500/25 border-emerald-500/20 text-white/90'
  if (pct >=  0)   return 'bg-emerald-400/[0.10] border-emerald-400/[0.12] text-white/75'
  if (pct >= -0.5) return 'bg-rose-400/[0.10] border-rose-400/[0.12] text-white/75'
  if (pct >= -2)   return 'bg-rose-500/25 border-rose-500/20 text-white/90'
  return             'bg-rose-600/55 border-rose-600/30 text-white'
}

// ── localStorage pin helpers ────────────────────────────────────────────────
const PINS_KEY = 'market_pins_v1'
function loadPins() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]') } catch { return [] }
}
function savePins(pins) {
  try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)) } catch {}
}

// ── Row skeleton ───────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="px-3 py-2.5 border-b border-white/[0.04] flex items-center gap-2.5">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2 w-16" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

// ── Instrument row ─────────────────────────────────────────────────────────
function InstrumentRow({ asset, quote, selected, onSelect, onBuy, onSell, pinned, onPin, onBell, hasAlert }) {
  const pipSize   = getPipSize({ symbolId: asset.symbol, type: asset.type })
  const bid       = Number(quote?.bid)
  const ask       = Number(quote?.ask)
  const mid       = Number(quote?.mid)
  const high      = Number(quote?.high)
  const low       = Number(quote?.low)
  const active    = selected?.symbol === asset.symbol
  const cat       = assetCategory(asset)
  const pct       = calcPct(quote)
  const posChange = pct != null && pct >= 0
  const rangePct  = (Number.isFinite(mid) && Number.isFinite(high) && Number.isFinite(low) && high > low)
    ? Math.max(0, Math.min(100, Math.round(((mid - low) / (high - low)) * 100)))
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(asset)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(asset) }}
      className={[
        'px-3 py-2.5 border-b border-white/[0.04] cursor-pointer transition-all duration-100 flex flex-col gap-1.5',
        active
          ? 'bg-blue-500/10 border-l-[3px] border-l-blue-500'
          : 'hover:bg-white/[0.04] border-l-[3px] border-l-transparent',
      ].join(' ')}
    >
      {/* Top: icon + name + pct + bell + star */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold tracking-tight ${CAT_COLORS[cat] ?? 'bg-white/10 text-white/50'}`}>
          {asset.symbol.slice(0, 3)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold truncate leading-tight ${active ? 'text-blue-300' : 'text-white/90'}`}>
            {asset.name || asset.symbol}
          </div>
          <div className="text-[10px] text-white/30 font-mono leading-none mt-0.5">{asset.symbol}</div>
        </div>

        {pct != null && (
          <span className={`text-[11px] font-bold tabular-nums ${posChange ? 'text-emerald-400' : 'text-red-400'}`}>
            {posChange ? '+' : ''}{pct.toFixed(2)}%
          </span>
        )}

        {/* Bell */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBell(asset, quote) }}
          title="Set price alert"
          className={`flex-shrink-0 p-1 rounded transition-colors ${hasAlert ? 'text-amber-400' : 'text-white/15 hover:text-amber-400'}`}
        >
          <Bell className={`w-3.5 h-3.5 ${hasAlert ? 'fill-amber-400/30' : ''}`} />
        </button>

        {/* Star / pin */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPin(asset.symbol) }}
          title={pinned ? 'Unpin' : 'Pin to top'}
          className={`flex-shrink-0 p-1 rounded transition-colors ${pinned ? 'text-amber-400' : 'text-white/15 hover:text-amber-400'}`}
        >
          <Star className={`w-3.5 h-3.5 ${pinned ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Bottom: SELL | range bar | BUY */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={(e) => { e.stopPropagation(); onSell(asset) }}
          className="flex-1 h-7 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/25 active:scale-95 text-orange-300 text-[11px] font-mono font-semibold transition-all">
          {Number.isFinite(bid) ? formatPrice(bid, pipSize) : '—'}
        </button>

        <div className="w-10 flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-full h-[3px] rounded-full bg-white/[0.08] relative overflow-hidden">
            {rangePct != null && (
              <div className="absolute top-0 left-0 h-full rounded-full bg-blue-400/50" style={{ width: `${rangePct}%` }} />
            )}
          </div>
          {Number.isFinite(bid) && Number.isFinite(ask) && (
            <span className="text-[9px] text-white/20 font-mono tabular-nums leading-none">
              {formatPrice(Math.abs(ask - bid), pipSize, 1)}
            </span>
          )}
        </div>

        <button type="button" onClick={(e) => { e.stopPropagation(); onBuy(asset) }}
          className="flex-1 h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 active:scale-95 text-emerald-300 text-[11px] font-mono font-semibold transition-all">
          {Number.isFinite(ask) ? formatPrice(ask, pipSize) : '—'}
        </button>
      </div>
    </div>
  )
}

// ── Heatmap tile ─────────────────────────────────────────────────────────────
function HeatmapTile({ asset, quote, selected, onSelect, pinned, onPin, onBell, hasAlert }) {
  const pct     = calcPct(quote)
  const mid     = Number(quote?.mid)
  const pipSize = getPipSize({ symbolId: asset.symbol, type: asset.type })
  const active  = selected?.symbol === asset.symbol
  const color   = heatmapColor(pct)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(asset)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(asset) }}
      className={[
        'group relative rounded-xl p-3 flex flex-col justify-between cursor-pointer',
        'transition-all duration-150 border min-h-[92px]',
        color,
        active ? 'ring-2 ring-blue-400/70' : 'hover:brightness-110',
      ].join(' ')}
    >
      {/* Top: symbol + action icons */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight tracking-wide">{asset.symbol}</div>
          <div className="text-[10px] opacity-45 truncate mt-0.5 leading-none">{asset.name}</div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={e => { e.stopPropagation(); onBell(asset, quote) }}
            className={`p-0.5 rounded ${hasAlert ? '!opacity-100 text-amber-300' : 'text-white/50 hover:text-amber-300'}`}>
            <Bell className={`w-3 h-3 ${hasAlert ? 'fill-amber-300/30' : ''}`} />
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onPin(asset.symbol) }}
            className={`p-0.5 rounded ${pinned ? '!opacity-100 text-amber-300' : 'text-white/50 hover:text-amber-300'}`}>
            <Star className={`w-3 h-3 ${pinned ? 'fill-amber-300' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bottom: price + percent */}
      <div className="mt-2">
        <div className="text-[11px] font-mono tabular-nums opacity-60 leading-none mb-1">
          {Number.isFinite(mid) ? formatPrice(mid, pipSize) : '—'}
        </div>
        {pct != null && (
          <div className="text-[14px] font-extrabold tabular-nums leading-none">
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ── Heatmap view ──────────────────────────────────────────────────────────────
function HeatmapView({ assets, prices, selected, onSelect, pins, onPin, onBell, alertSymbols }) {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {assets.map(asset => (
          <HeatmapTile
            key={asset.id}
            asset={asset}
            quote={prices[asset.symbol] || prices[asset.symbol?.toUpperCase()] || null}
            selected={selected}
            onSelect={onSelect}
            pinned={pins.includes(asset.symbol)}
            onPin={onPin}
            onBell={onBell}
            hasAlert={alertSymbols.has(asset.symbol)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Alert modal ───────────────────────────────────────────────────────────────
function AlertModal({ asset, quote, existingAlerts, onClose, onSave, onDelete }) {
  const pipSize = getPipSize({ symbolId: asset?.symbol, type: asset?.type })
  const mid     = Number(quote?.mid)
  const [price,  setPrice]  = useState(Number.isFinite(mid) ? formatPrice(mid, pipSize) : '')
  const [dir,    setDir]    = useState('above')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const num = Number(price)
    if (!Number.isFinite(num) || num <= 0) return
    setSaving(true)
    await onSave({ symbol: asset.symbol, type: dir, price: num })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#161b22] border border-slate-700 rounded-2xl w-[300px] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-white font-bold text-sm flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-400" />{asset?.symbol} Price Alert
            </div>
            <div className="text-slate-500 text-xs mt-0.5">{asset?.name}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Direction */}
          <div className="flex gap-2">
            {['above', 'below'].map(d => (
              <button key={d} type="button" onClick={() => setDir(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  dir === d ? 'bg-blue-500 text-white' : 'bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}>
                {d === 'above' ? '↑ Crosses above' : '↓ Drops below'}
              </button>
            ))}
          </div>

          {/* Price input */}
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Alert price</label>
            <Input
              type="number"
              step="any"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              placeholder="Enter price"
            />
            {Number.isFinite(mid) && (
              <div className="text-slate-600 text-[10px] mt-1">Current mid: {formatPrice(mid, pipSize)}</div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !price}
            className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? 'Saving…' : 'Set Alert'}
          </button>
        </div>

        {/* Existing alerts for this symbol */}
        {existingAlerts && existingAlerts.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">Active alerts</div>
            <div className="space-y-2">
              {existingAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between">
                  <span className="text-white/70 text-xs">
                    {alert.type === 'above' ? '↑' : '↓'} {formatPrice(Number(alert.price), pipSize)}
                  </span>
                  <button onClick={() => onDelete(alert.id)}
                    className="text-red-400 hover:text-red-300 text-[10px] transition-colors">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const router   = useRouter()
  const isMobile = useIsMobile()

  const [loading, setLoading]             = useState(true)
  const [marketLoading, setMarketLoading] = useState(true)
  const [user, setUser]                   = useState(null)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [assets, setAssets]               = useState([])
  const [account, setAccount]             = useState(null)
  const [prices, setPrices]               = useState({})
  const [search, setSearch]               = useState('')
  const [selected, setSelected]           = useState(null)
  const [ticket, setTicket]               = useState(null)
  const [positionId, setPositionId]       = useState(null)
  const [category, setCategory]           = useState('all')
  const [mobileView, setMobileView]       = useState('list') // 'list' | 'heatmap' | 'chart'

  // Feature state
  const [listMode, setListMode]       = useState('list') // 'list' | 'heatmap'
  const [pins, setPins]               = useState([])
  const [alerts, setAlerts]           = useState([])
  const [alertModal, setAlertModal]   = useState(null)   // { asset, quote }

  useEffect(() => { globalThis.__INVESTPOP_ACCOUNT = account }, [account])

  // Load pins from localStorage after mount
  useEffect(() => { setPins(loadPins()) }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) { router.push('/'); return }
        const data = await res.json().catch(() => ({}))
        if (alive) setUser(data.user || null)
      } catch { router.push('/') }
      finally { if (alive) setLoading(false) }
    }
    checkAuth()
    return () => { alive = false }
  }, [router])

  // ── Load price alerts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const res = await fetch('/api/alerts')
        if (res.ok) setAlerts((await res.json()).alerts || [])
      } catch {}
    }
    load()
  }, [user])

  // ── Market data + polling ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      if (!cancelled) setMarketLoading(true)
      try {
        try { await fetch('/api/assets/seed', { method: 'POST' }) } catch {}
        const [acctRes, assetsRes, pricesRes] = await Promise.all([
          fetch('/api/account', { cache: 'no-store' }),
          fetch('/api/assets',  { cache: 'no-store' }),
          fetch('/api/market/prices', { cache: 'no-store' }),
        ])
        if (!cancelled && acctRes.ok)   setAccount(await acctRes.json())
        if (!cancelled && assetsRes.ok) { const d = await assetsRes.json(); setAssets(d.assets || []) }
        if (!cancelled && pricesRes.ok) { const d = await pricesRes.json(); setPrices(d.prices || {}) }
      } catch {}
      finally { if (!cancelled) setMarketLoading(false) }
    }
    loadInitial()
    const tickId = setInterval(async () => {
      try {
        const res = await fetch('/api/market/tick', { method: 'POST' })
        if (!res.ok) return
        setPrices((await res.json()).prices || {})
      } catch {}
    }, 2000)
    const acctId = setInterval(async () => {
      try { const r = await fetch('/api/account'); if (r.ok) setAccount(await r.json()) } catch {}
    }, 15000)
    return () => { cancelled = true; clearInterval(tickId); clearInterval(acctId) }
  }, [])

  // Auto-select first asset
  useEffect(() => {
    if (!selected && assets.length > 0) setSelected(assets[0])
  }, [assets, selected])

  // ── Pin helpers ───────────────────────────────────────────────────────────
  const togglePin = useCallback((symbol) => {
    setPins(prev => {
      const next = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [symbol, ...prev]
      savePins(next)
      return next
    })
  }, [])

  // ── Alert helpers ─────────────────────────────────────────────────────────
  const openBell = useCallback((asset, quote) => {
    setAlertModal({ asset, quote })
  }, [])

  const handleCreateAlert = async ({ symbol, type, price }) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, type, price })
      })
      if (res.ok) {
        const updated = await fetch('/api/alerts')
        if (updated.ok) setAlerts((await updated.json()).alerts || [])
        setAlertModal(null)
      }
    } catch {}
  }

  const handleDeleteAlert = async (id) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = assets
    if      (category === 'forex')     result = result.filter(a => a.type === 'forex')
    else if (category === 'stock')     result = result.filter(a => a.type === 'stock')
    else if (category === 'crypto')    result = result.filter(a => a.type === 'crypto')
    else if (category === 'index')     result = result.filter(a => a.type === 'index' && !COMMODITY_SYMBOLS.has(a.symbol))
    else if (category === 'commodity') result = result.filter(a => COMMODITY_SYMBOLS.has(a.symbol))
    const q = search.trim().toLowerCase()
    if (q) result = result.filter(a =>
      String(a.symbol).toLowerCase().includes(q) ||
      String(a.name || '').toLowerCase().includes(q)
    )
    return result
  }, [assets, search, category])

  // Sort: pinned first with separator, then rest
  const { pinnedAssets, unpinnedAssets } = useMemo(() => {
    const pinned   = filtered.filter(a => pins.includes(a.symbol))
    const unpinned = filtered.filter(a => !pins.includes(a.symbol))
    return { pinnedAssets: pinned, unpinnedAssets: unpinned }
  }, [filtered, pins])

  const alertSymbols = useMemo(() => new Set(alerts.map(a => a.symbol)), [alerts])

  const selectedQuote = useMemo(() => {
    if (!selected?.symbol) return null
    return prices[selected.symbol] || prices[selected.symbol?.toUpperCase()] || null
  }, [prices, selected?.symbol])

  const headerEquity = useMemo(() => {
    if (!account) return '—'
    const eq = Number(account.equity ?? account.balance)
    return Number.isFinite(eq) ? `$${eq.toFixed(2)}` : '—'
  }, [account])

  const headerMode = account?.tradingMode ?? account?.trading_mode ?? null

  const showMarketSkeleton = marketLoading && assets.length === 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-white/30 text-sm">Loading…</div>
      </div>
    )
  }

  // ── Panel helpers ─────────────────────────────────────────────────────────
  const panelOpen  = !!ticket || !!positionId
  const closePanel = () => { setTicket(null); setPositionId(null) }

  const openTicket = (instrument, side) => {
    const q   = prices[instrument.symbol] || prices[instrument.symbol?.toUpperCase()] || null
    const ref = side === 'BUY' ? Number(q?.ask) : Number(q?.bid)
    setTicket({ instrument, side, entryRefPrice: ref || 0 })
  }

  const handleSelect = (asset) => {
    setSelected(asset)
    if (isMobile) setMobileView('chart')
  }

  const panelContent = ticket ? (
    <OrderTicket
      embedded
      instrument={ticket.instrument}
      initialSide={ticket.side}
      entryRefPrice={ticket.entryRefPrice}
      onCancel={closePanel}
      onExecuted={(result) => {
        if (result?.type === 'MARKET' && result?.trade?.positionId) {
          setTicket(null)
          setPositionId(result.trade.positionId)
        } else {
          closePanel()
        }
      }}
    />
  ) : positionId ? (
    <PositionView embedded positionId={positionId} onClose={closePanel} />
  ) : null

  const selPipSize = selected ? getPipSize({ symbolId: selected.symbol, type: selected.type }) : 0.0001
  const selCat     = selected ? assetCategory(selected) : null

  // ── Row renderer (with pinning support) ───────────────────────────────────
  const renderRows = (list) => list.map((a) => (
    <InstrumentRow
      key={a.id}
      asset={a}
      quote={prices[a.symbol] || prices[a.symbol?.toUpperCase()] || null}
      selected={selected}
      onSelect={handleSelect}
      onBuy={(asset)  => openTicket(asset, 'BUY')}
      onSell={(asset) => openTicket(asset, 'SELL')}
      pinned={pins.includes(a.symbol)}
      onPin={togglePin}
      onBell={openBell}
      hasAlert={alertSymbols.has(a.symbol)}
    />
  ))

  // ── List panel (shared: desktop left + mobile list view) ──────────────────
  const listPanel = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(({ key, label }) => (
          <button key={key} onClick={() => setCategory(key)}
            className={[
              'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-150',
              category === key
                ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {listMode === 'list' && (
        <div className="flex items-center px-3 pb-1.5 flex-shrink-0">
          <span className="flex-1 text-[10px] uppercase tracking-wider text-white/20 font-semibold">Instrument</span>
          <span className="text-[10px] uppercase tracking-wider text-white/20 font-semibold">Sell / Buy</span>
        </div>
      )}

      {/* Content: list or heatmap */}
      {listMode === 'list' ? (
        <div className="flex-1 overflow-y-auto">
          {showMarketSkeleton
            ? Array.from({ length: 14 }).map((_, i) => <RowSkeleton key={i} />)
            : filtered.length === 0
              ? <div className="px-4 py-10 text-center text-white/25 text-sm">No instruments found.</div>
              : (
                <>
                  {pinnedAssets.length > 0 && (
                    <>
                      {renderRows(pinnedAssets)}
                      {unpinnedAssets.length > 0 && (
                        <div className="px-3 py-1.5 flex items-center gap-2">
                          <div className="flex-1 h-px bg-white/[0.06]" />
                          <span className="text-[9px] uppercase tracking-wider text-white/20">All instruments</span>
                          <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>
                      )}
                    </>
                  )}
                  {renderRows(unpinnedAssets)}
                </>
              )
          }
        </div>
      ) : (
        showMarketSkeleton
          ? <div className="flex-1 flex items-center justify-center text-white/25 text-sm">Loading…</div>
          : <HeatmapView
              assets={filtered}
              prices={prices}
              selected={selected}
              onSelect={handleSelect}
              pins={pins}
              onPin={togglePin}
              onBell={openBell}
              alertSymbols={alertSymbols}
            />
      )}
    </div>
  )

  // ── Chart panel ───────────────────────────────────────────────────────────
  const chartPanel = (
    <div className="flex flex-col h-full">
      {selected && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] flex-shrink-0 bg-[#0d1117]">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${CAT_COLORS[selCat] ?? 'bg-white/10 text-white/50'}`}>
            {selected.symbol.slice(0, 3)}
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">{selected.name || selected.symbol}</div>
            <div className="text-white/30 text-[10px] font-mono">{selected.symbol}</div>
          </div>
          <div className="ml-auto flex items-center gap-4 text-[11px] font-mono text-white/30">
            {selectedQuote?.high != null && (
              <span>H <span className="text-emerald-400/70">{formatPrice(selectedQuote.high, selPipSize)}</span></span>
            )}
            {selectedQuote?.low != null && (
              <span>L <span className="text-red-400/70">{formatPrice(selectedQuote.low, selPipSize)}</span></span>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {selected ? (
          <InstrumentChart
            key={selected.symbol}
            instrument={selected}
            quote={selectedQuote}
            onSell={() => openTicket(selected, 'SELL')}
            onBuy={()  => openTicket(selected, 'BUY')}
          />
        ) : showMarketSkeleton ? (
          <div className="h-full flex items-center justify-center text-white/25 text-sm">Loading markets…</div>
        ) : (
          <div className="h-full flex items-center justify-center text-white/25 text-sm">Select an instrument to view the chart</div>
        )}
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0d1117] flex overflow-hidden">
      <AppSidebar
        currentPage="/markets"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        account={account}
      />

      {/* ── DESKTOP: side-by-side ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-w-0 overflow-hidden">

        {/* Left: instrument list panel */}
        <div className="w-[340px] flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden bg-[#0d1117]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <span className="text-white font-bold text-sm">Markets</span>
            <div className="flex items-center gap-1">
              {/* List / Heatmap toggle */}
              <div className="flex items-center gap-0.5 bg-white/[0.06] rounded-lg p-0.5">
                <button onClick={() => setListMode('list')}
                  title="List view"
                  className={`p-1.5 rounded-md transition-all ${listMode === 'list' ? 'bg-blue-500 text-white' : 'text-white/30 hover:text-white/60'}`}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setListMode('heatmap')}
                  title="Heatmap view"
                  className={`p-1.5 rounded-md transition-all ${listMode === 'heatmap' ? 'bg-blue-500 text-white' : 'text-white/30 hover:text-white/60'}`}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            <div className="flex items-center gap-2">
              {headerMode && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${headerMode === 'DEMO' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {headerMode === 'DEMO' ? '🎯 DEMO' : '💼 REAL'}
                </span>
              )}
              <span className="text-xs font-mono text-white/30">{headerEquity}</span>
            </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {listPanel}
          </div>
        </div>

        {/* Right: full-height chart */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {chartPanel}
        </div>
      </div>

      {/* ── MOBILE: tab switcher ────────────────────────────────────────── */}
      <div className="flex lg:hidden flex-1 flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0d1117] flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white/50 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1 bg-white/[0.06] rounded-xl p-1">
            <button onClick={() => setMobileView('list')}
              className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                mobileView === 'list' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-white/40 hover:text-white/70'].join(' ')}>
              <List className="w-3.5 h-3.5" />List
            </button>
            <button onClick={() => setMobileView('heatmap')}
              className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                mobileView === 'heatmap' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-white/40 hover:text-white/70'].join(' ')}>
              <LayoutGrid className="w-3.5 h-3.5" />Heat
            </button>
            <button onClick={() => setMobileView('chart')}
              className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                mobileView === 'chart' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'text-white/40 hover:text-white/70'].join(' ')}>
              <BarChart2 className="w-3.5 h-3.5" />Chart
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {headerMode && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${headerMode === 'DEMO' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {headerMode === 'DEMO' ? '🎯' : '💼'}
              </span>
            )}
            <span className="text-xs font-mono text-white/30">{headerEquity}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileView === 'list' && listPanel}
          {mobileView === 'heatmap' && (
            <div className="flex flex-col h-full">
              <div className="px-3 pt-3 pb-2 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50" />
                </div>
              </div>
              <HeatmapView
                assets={filtered}
                prices={prices}
                selected={selected}
                onSelect={handleSelect}
                pins={pins}
                onPin={togglePin}
                onBell={openBell}
                alertSymbols={alertSymbols}
              />
            </div>
          )}
          {mobileView === 'chart' && chartPanel}
        </div>
      </div>

      {/* ── Trade / position panel ──────────────────────────────────────── */}
      {!isMobile ? (
        <Sheet open={panelOpen} onOpenChange={(open) => { if (!open) closePanel() }}>
          <SheetContent side="right" className="p-0 w-full sm:max-w-md overflow-hidden">
            {panelContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={panelOpen} onOpenChange={(open) => { if (!open) closePanel() }}>
          <DrawerContent className="h-[92vh] p-0">
            <div className="flex-1 overflow-hidden">{panelContent}</div>
          </DrawerContent>
        </Drawer>
      )}

      {/* ── Alert modal ─────────────────────────────────────────────────── */}
      {alertModal && (
        <AlertModal
          asset={alertModal.asset}
          quote={alertModal.quote}
          existingAlerts={alerts.filter(a => a.symbol === alertModal.asset.symbol)}
          onClose={() => setAlertModal(null)}
          onSave={handleCreateAlert}
          onDelete={handleDeleteAlert}
        />
      )}
    </div>
  )
}
