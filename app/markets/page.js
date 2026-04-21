'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Search, BarChart2, List } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
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

// Per-category icon badge colours
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
function InstrumentRow({ asset, quote, selected, onSelect, onBuy, onSell }) {
  const pipSize = getPipSize({ symbolId: asset.symbol, type: asset.type })
  const bid  = Number(quote?.bid)
  const ask  = Number(quote?.ask)
  const mid  = Number(quote?.mid)
  const high = Number(quote?.high)
  const low  = Number(quote?.low)
  const active = selected?.symbol === asset.symbol
  const cat  = assetCategory(asset)

  // % change (mid vs high as proxy for open)
  const pct = (Number.isFinite(mid) && Number.isFinite(high) && high > 0)
    ? ((mid - high) / high) * 100
    : null
  const posChange = pct != null && pct >= 0

  // Price bar position in today's H/L range
  const rangePct = (Number.isFinite(mid) && Number.isFinite(high) && Number.isFinite(low) && high > low)
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
      {/* Top: icon + name + change% */}
      <div className="flex items-center gap-2.5">
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
          <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${posChange ? 'text-emerald-400' : 'text-red-400'}`}>
            {posChange ? '+' : ''}{pct.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Bottom: SELL | range bar | BUY */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSell(asset) }}
          className="flex-1 h-7 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/25 active:scale-95 text-orange-300 text-[11px] font-mono font-semibold transition-all"
        >
          {Number.isFinite(bid) ? formatPrice(bid, pipSize) : '—'}
        </button>

        {/* Micro range bar + spread */}
        <div className="w-10 flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-full h-[3px] rounded-full bg-white/[0.08] relative overflow-hidden">
            {rangePct != null && (
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-blue-400/50"
                style={{ width: `${rangePct}%` }}
              />
            )}
          </div>
          {Number.isFinite(bid) && Number.isFinite(ask) && (
            <span className="text-[9px] text-white/20 font-mono tabular-nums leading-none">
              {formatPrice(Math.abs(ask - bid), pipSize, 1)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBuy(asset) }}
          className="flex-1 h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 active:scale-95 text-emerald-300 text-[11px] font-mono font-semibold transition-all"
        >
          {Number.isFinite(ask) ? formatPrice(ask, pipSize) : '—'}
        </button>
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
  const [mobileView, setMobileView]       = useState('list') // 'list' | 'chart'

  useEffect(() => { globalThis.__INVESTPOP_ACCOUNT = account }, [account])

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

  const selectedQuote = useMemo(() => {
    if (!selected?.symbol) return null
    return prices[selected.symbol] || prices[selected.symbol?.toUpperCase()] || null
  }, [prices, selected?.symbol])

  const headerEquity = useMemo(() => {
    if (!account) return '—'
    const c  = account.currency || 'USD'
    const eq = Number(account.equity ?? account.balance)
    const s  = c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : ''
    return Number.isFinite(eq) ? `${s}${eq.toFixed(2)}` : '—'
  }, [account])

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

  // ── Selected instrument info ───────────────────────────────────────────────
  const selPipSize = selected ? getPipSize({ symbolId: selected.symbol, type: selected.type }) : 0.0001
  const selCat     = selected ? assetCategory(selected) : null

  // ── Instrument list panel (shared: desktop left + mobile list view) ─────
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
      <div
        className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto flex-shrink-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={[
              'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-150',
              category === key
                ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                : 'bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Column labels */}
      <div className="flex items-center px-3 pb-1.5 flex-shrink-0">
        <span className="flex-1 text-[10px] uppercase tracking-wider text-white/20 font-semibold">Instrument</span>
        <span className="text-[10px] uppercase tracking-wider text-white/20 font-semibold">Sell / Buy</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {showMarketSkeleton
          ? Array.from({ length: 14 }).map((_, i) => <RowSkeleton key={i} />)
          : filtered.length === 0
            ? <div className="px-4 py-10 text-center text-white/25 text-sm">No instruments found.</div>
            : filtered.map((a) => (
                <InstrumentRow
                  key={a.id}
                  asset={a}
                  quote={prices[a.symbol] || prices[a.symbol?.toUpperCase()] || null}
                  selected={selected}
                  onSelect={handleSelect}
                  onBuy={(asset)  => openTicket(asset, 'BUY')}
                  onSell={(asset) => openTicket(asset, 'SELL')}
                />
              ))
        }
      </div>
    </div>
  )

  // ── Chart panel ───────────────────────────────────────────────────────────
  const chartPanel = (
    <div className="flex flex-col h-full">
      {/* Selected instrument info bar */}
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

      {/* App sidebar */}
      <AppSidebar
        currentPage="/markets"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        account={account}
      />

      {/* ── DESKTOP: side-by-side list + chart ─────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-w-0 overflow-hidden">

        {/* Left: instrument list panel */}
        <div className="w-[340px] flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden bg-[#0d1117]">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <span className="text-white font-bold text-sm">Markets</span>
            <span className="text-xs font-mono text-white/30">{headerEquity}</span>
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

      {/* ── MOBILE: tab switcher between list and chart ─────────────────── */}
      <div className="flex lg:hidden flex-1 flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0d1117] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/50 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-white/[0.06] rounded-xl p-1">
            <button
              onClick={() => setMobileView('list')}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                mobileView === 'list'
                  ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <List className="w-3.5 h-3.5" />
              Markets
            </button>
            <button
              onClick={() => setMobileView('chart')}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                mobileView === 'chart'
                  ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Chart
            </button>
          </div>

          <span className="text-xs font-mono text-white/30">{headerEquity}</span>
        </div>

        {/* Mobile content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileView === 'list' ? listPanel : chartPanel}
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
    </div>
  )
}
