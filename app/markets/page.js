'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, TrendingUp, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import AppSidebar from '@/components/AppSidebar'
import InstrumentChart from '@/components/trading/InstrumentChart'
import OrderTicket from '@/components/trading/OrderTicket'
import PositionView from '@/components/trading/PositionView'
import { formatPrice, getPipSize } from '@/lib/trading/pips'

// ── tiny change % badge ────────────────────────────────────────────────────
function ChangeBadge({ pct }) {
  if (!Number.isFinite(pct)) return <span className="text-slate-500 text-xs">—</span>
  const pos = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold tabular-nums
      ${pos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

// ── price button ───────────────────────────────────────────────────────────
function PriceBtn({ label, price, pipSize, onClick, variant }) {
  const isSell = variant === 'sell'
  const p = Number(price)
  const display = Number.isFinite(p) ? formatPrice(p, pipSize) : '—'
  return (
    <button
      onClick={onClick}
      className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-full border px-2.5 py-1 sm:px-4 sm:py-1.5 transition-colors w-full
        ${isSell
          ? 'border-slate-600 hover:border-orange-400 hover:bg-orange-500/10 text-white'
          : 'border-slate-600 hover:border-emerald-400 hover:bg-emerald-500/10 text-white'
        }`}
    >
      <span className="font-mono text-[11px] sm:text-sm tabular-nums leading-none">{display}</span>
      <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-none
        ${isSell ? 'text-orange-400' : 'text-emerald-400'}`}>
        {label}
      </span>
    </button>
  )
}

export default function MarketsPage() {
  const router   = useRouter()
  const isMobile = useIsMobile()

  const [loading, setLoading]         = useState(true)
  const [user, setUser]               = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [assets, setAssets]           = useState([])
  const [account, setAccount]         = useState(null)
  const [prices, setPrices]           = useState({})
  const [search, setSearch]           = useState('')

  const [selected, setSelected]       = useState(null)

  const [ticket, setTicket]           = useState(null)
  const [positionId, setPositionId]   = useState(null)

  useEffect(() => { globalThis.__INVESTPOP_ACCOUNT = account }, [account])

  // ── Auth ─────────────────────────────────────────────────────────────────
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

  // ── Market polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    let cancelled = false

    async function loadInitial() {
      try {
        fetch('/api/assets/seed', { method: 'POST' }).catch(() => {})
        const [acctRes, assetsRes, pricesRes] = await Promise.all([
          fetch('/api/account'),
          fetch('/api/assets'),
          fetch('/api/market/prices'),
        ])
        if (!cancelled && acctRes.ok)   setAccount(await acctRes.json())
        if (!cancelled && assetsRes.ok) {
          const d = await assetsRes.json()
          setAssets(d.assets || [])
        }
        if (!cancelled && pricesRes.ok) {
          const d = await pricesRes.json()
          if (!cancelled) setPrices(d.prices || {})
        }
      } catch {}
    }

    loadInitial()

    const tickId = setInterval(async () => {
      try {
        const res = await fetch('/api/market/tick', { method: 'POST' })
        if (!res.ok) return
        const data = await res.json()
        setPrices(data.prices || {})
      } catch {}
    }, 2000)

    const acctId = setInterval(async () => {
      try {
        const r = await fetch('/api/account')
        if (r.ok) setAccount(await r.json())
      } catch {}
    }, 15000)

    return () => { cancelled = true; clearInterval(tickId); clearInterval(acctId) }
  }, [loading])

  // ── Auto-select first asset ───────────────────────────────────────────────
  useEffect(() => {
    if (!selected && assets.length > 0) setSelected(assets[0])
  }, [assets, selected])

  // Chart data is fetched by InstrumentChart via /api/market/candles/*

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(a =>
      String(a.symbol).toLowerCase().includes(q) ||
      String(a.name || '').toLowerCase().includes(q)
    )
  }, [assets, search])

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#0d1117] flex overflow-hidden dark">

      {/* Sidebar */}
      <AppSidebar
        currentPage="/markets"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        account={account}
      />

      {/* Main content – stack vertically */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── Mobile header ───────────────────────────────────────────── */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Markets</span>
          <div className="text-xs font-mono text-slate-300">{headerEquity}</div>
        </div>

        {/* ── Search + balance bar ─────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-[#161b22] border-b border-slate-800">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search markets…"
            className="max-w-xs bg-[#0d1117] border-slate-700 text-white placeholder:text-slate-500 h-8 text-sm"
          />
          <div className="ml-auto text-sm font-mono text-slate-300 hidden lg:block">{headerEquity}</div>
        </div>

        {/* ── Instrument TABLE: takes top 55%, scrollable ──────────────── */}
        <div className="flex-shrink-0 overflow-hidden flex flex-col" style={{ height: '55%' }}>

          {/* Column headers */}
          <div className="flex-shrink-0 grid grid-cols-[minmax(0,2fr)_76px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 sm:gap-x-0 sm:grid-cols-[minmax(0,2fr)_80px_1fr_1fr] lg:grid-cols-[minmax(0,2fr)_80px_1fr_1fr_minmax(0,1fr)] items-center
                          px-4 py-2 bg-[#0d1020] border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Instrument</span>
            <span className="text-center">Change</span>
            <span className="text-center">Sell</span>
            <span className="text-center">Buy</span>
            <span className="hidden lg:block text-right">High / Low</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((a) => {
              const q       = prices[a.symbol] || prices[a.symbol?.toUpperCase()] || null
              const pipSize = getPipSize({ symbolId: a.symbol, type: a.type })
              const bid     = q?.bid
              const ask     = q?.ask
              const high    = q?.high
              const low     = q?.low

              // Compute % change from mid vs base price (base embedded in simulator)
              const mid     = q?.mid
              const pct     = (Number.isFinite(Number(mid)) && Number(mid) > 0)
                ? ((Number(mid) - Number(high || mid)) / Number(high || mid)) * 100
                : null

              const active  = selected?.symbol === a.symbol

              return (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(a) }}
                  className={[
                    'grid grid-cols-[minmax(0,2fr)_76px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 sm:gap-x-0 sm:grid-cols-[minmax(0,2fr)_80px_1fr_1fr] lg:grid-cols-[minmax(0,2fr)_80px_1fr_1fr_minmax(0,1fr)] items-center',
                    'px-4 py-2.5 border-b border-slate-800/50 cursor-pointer transition-colors',
                    active
                      ? 'bg-[#1a2035] border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-800/25',
                  ].join(' ')}
                >
                  {/* Instrument name */}
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-300 leading-none">{a.symbol.slice(0,3)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className={`font-semibold text-sm whitespace-normal break-words sm:whitespace-nowrap sm:truncate leading-tight ${active ? 'text-blue-400' : 'text-white'}`}>
                        {a.name || a.symbol}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{a.symbol}</div>
                    </div>
                  </div>

                  {/* Change % */}
                  <div className="flex justify-start pl-1">
                    <ChangeBadge pct={pct} />
                  </div>

                  {/* Sell */}
                  <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <PriceBtn
                      label="Sell"
                      price={bid}
                      pipSize={pipSize}
                      variant="sell"
                      onClick={() => openTicket(a, 'SELL')}
                    />
                  </div>

                  {/* Buy */}
                  <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <PriceBtn
                      label="Buy"
                      price={ask}
                      pipSize={pipSize}
                      variant="buy"
                      onClick={() => openTicket(a, 'BUY')}
                    />
                  </div>

                  {/* High / Low */}
                  <div className="hidden lg:flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-mono text-emerald-400">{formatPrice(high, pipSize)}</span>
                    <span className="text-[11px] font-mono text-red-400">{formatPrice(low, pipSize)}</span>
                  </div>
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-slate-500 text-sm">No instruments found.</div>
            )}
          </div>
        </div>

        {/* ── Chart panel: takes bottom 45%, always visible ────────────── */}
        <div className="flex-1 min-h-0 border-t border-slate-800 overflow-hidden">
          {selected ? (
            <InstrumentChart
              key={selected.symbol}
              instrument={selected}
              quote={selectedQuote}
              onSell={() => openTicket(selected, 'SELL')}
              onBuy={()  => openTicket(selected, 'BUY')}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Select an instrument to view the chart
            </div>
          )}
        </div>

      </div>{/* /main */}

      {/* ── Trade / position panel ───────────────────────────────────────── */}
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
