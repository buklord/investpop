'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { getPipSize, formatPrice } from '@/lib/trading/pips'

// ── Internal symbol → TradingView symbol ─────────────────────────────────────
const TV_SYMBOL_MAP = {
  EURUSD: 'FX:EURUSD',   GBPUSD: 'FX:GBPUSD',   USDJPY: 'FX:USDJPY',
  USDCHF: 'FX:USDCHF',   USDCAD: 'FX:USDCAD',   AUDUSD: 'FX:AUDUSD',
  NZDUSD: 'FX:NZDUSD',   EURGBP: 'FX:EURGBP',   EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  US30:   'TVC:DJI',        US100:  'NASDAQ:NDX',     SPX500: 'SP:SPX',
  GER40:  'XETR:DAX',       UK100:  'TVC:UKX',        FRA40:  'EURONEXT:CAC40',
  JPN225: 'TVC:NI225',      AUS200: 'ASX:XJO',        HK50:   'TVC:HSI',
  CHN50:  'SSE:000001',
  AAPL:  'NASDAQ:AAPL',  MSFT:  'NASDAQ:MSFT',  GOOGL: 'NASDAQ:GOOGL',
  AMZN:  'NASDAQ:AMZN',  TSLA:  'NASDAQ:TSLA',  NVDA:  'NASDAQ:NVDA',
  META:  'NASDAQ:META',  JPM:   'NYSE:JPM',      NFLX:  'NASDAQ:NFLX',
  AMD:   'NASDAQ:AMD',
  BTCUSD:  'BINANCE:BTCUSDT',  ETHUSD:  'BINANCE:ETHUSDT',  BNBUSD:  'BINANCE:BNBUSDT',
  SOLUSD:  'BINANCE:SOLUSDT',  XRPUSD:  'BINANCE:XRPUSDT',  ADAUSD:  'BINANCE:ADAUSDT',
  DOGEUSD: 'BINANCE:DOGEUSDT', AVAXUSD: 'BINANCE:AVAXUSDT', DOTUSD:  'BINANCE:DOTUSDT',
  LTCUSD:  'BINANCE:LTCUSDT',
  XAUUSD: 'TVC:GOLD',     XAGUSD: 'TVC:SILVER',  USOIL:  'TVC:USOIL',
  XPTUSD: 'TVC:PLATINUM', NATGAS: 'TVC:NATURALGAS',
}

const TIMEFRAMES = [
  { label: '1m',  tv: '1'   },
  { label: '5m',  tv: '5'   },
  { label: '15m', tv: '15'  },
  { label: '1H',  tv: '60'  },
  { label: '4H',  tv: '240' },
  { label: '1D',  tv: 'D'   },
]

function toTVSymbol(symbol) {
  return TV_SYMBOL_MAP[String(symbol || '').toUpperCase()] || String(symbol || '').toUpperCase()
}

export default function PositionView({ positionId, onClose, embedded = false }) {
  const [tab, setTab] = useState('CHART')
  const [position, setPosition] = useState(null)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [protect, setProtect] = useState({ tp: '', sl: '', dirty: false, saving: false, error: '' })
  const [tfIdx, setTfIdx] = useState(2) // default 15m for position chart
  const [currentMid, setCurrentMid] = useState(null)
  const isMobile = useIsMobile()

  // ── Load position ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/positions?status=open')
        if (!res.ok) return
        const data = await res.json()
        const found = (data.positions || []).find(p => p.id === positionId)
        if (alive) setPosition(found || null)
      } catch {}
    }
    load()
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [positionId])

  // ── Sync TP/SL fields when position loads/changes ────────────────────────
  useEffect(() => {
    setProtect((p) => ({
      ...p,
      tp: position?.take_profit == null ? '' : String(position.take_profit),
      sl: position?.stop_loss == null ? '' : String(position.stop_loss),
      dirty: false, error: '',
    }))
  }, [position?.take_profit, position?.stop_loss])

  // ── Poll current price for live P&L in header ────────────────────────────
  useEffect(() => {
    if (!position?.symbol) return
    let alive = true
    async function fetchPrice() {
      try {
        const res = await fetch('/api/market/prices', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const p = data.prices?.[position.symbol] || data.prices?.[position.symbol?.toUpperCase()]
        if (alive && p?.mid != null) setCurrentMid(Number(p.mid))
      } catch {}
    }
    fetchPrice()
    const id = setInterval(fetchPrice, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [position?.symbol])

  const pipSize = useMemo(
    () => getPipSize({ symbolId: position?.symbol, type: position?.type }),
    [position?.symbol, position?.type]
  )

  const overlays = useMemo(() => {
    const entry = Number(position?.entry_price)
    const tp = protect.dirty
      ? (protect.tp === '' ? null : Number(protect.tp))
      : (position?.take_profit != null ? Number(position.take_profit) : null)
    const sl = protect.dirty
      ? (protect.sl === '' ? null : Number(protect.sl))
      : (position?.stop_loss != null ? Number(position.stop_loss) : null)
    return { entry, tp, sl }
  }, [position, protect.dirty, protect.sl, protect.tp])

  const unrealized = useMemo(() => {
    if (!position || currentMid == null) return null
    const qty = Number(position.quantity) || 0
    const entry = Number(position.entry_price) || 0
    const points = position.side === 'SHORT' ? (entry - currentMid) : (currentMid - entry)
    const gross = points * qty
    return Number.isFinite(gross) ? gross : null
  }, [currentMid, position])

  // ── Save TP/SL ────────────────────────────────────────────────────────────
  async function saveProtect() {
    setProtect((p) => ({ ...p, saving: true, error: '' }))
    try {
      const tp = protect.tp === '' ? null : Number(protect.tp)
      const sl = protect.sl === '' ? null : Number(protect.sl)
      if ((tp !== null && !Number.isFinite(tp)) || (sl !== null && !Number.isFinite(sl))) {
        setProtect((p) => ({ ...p, saving: false, error: 'TP/SL must be a number or blank.' }))
        return
      }
      const res = await fetch('/api/positions/' + encodeURIComponent(positionId), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ takeProfit: tp, stopLoss: sl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update position')
      setProtect((p) => ({ ...p, saving: false, dirty: false, error: '' }))
    } catch (e) {
      setProtect((p) => ({ ...p, saving: false, error: e?.message || 'Failed to update position' }))
    }
  }

  const sizeLabel = position?.type === 'forex' ? 'Stakes' : 'Lots'
  const direction = position?.side === 'LONG' ? 'BUY' : 'SELL'
  const dirBadge  = direction === 'SELL' ? '↓' : '↑'

  const tvSymbol   = toTVSymbol(position?.symbol)
  const tvInterval = TIMEFRAMES[tfIdx].tv
  const iframeSrc  = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=${tvInterval}&theme=dark&style=1&locale=en&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&hide_top_toolbar=1&withdateranges=0`

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
      <div className="text-base font-semibold">
        {position?.symbol || 'Position'}
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          {(Number(position?.quantity) || 0).toFixed(2)} {sizeLabel} {dirBadge}
        </span>
        <span className="ml-2 text-xs font-mono text-muted-foreground">
          {currentMid == null ? '—' : formatPrice(currentMid, pipSize)}
        </span>
        <span className={
          'ml-2 text-xs font-mono ' +
          (unrealized == null ? 'text-muted-foreground' : unrealized >= 0 ? 'text-emerald-400' : 'text-red-400')
        }>
          {unrealized == null ? '' : `${unrealized >= 0 ? '+' : ''}${unrealized.toFixed(2)}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {tab === 'CHART' && (
          <Button variant="outline" size="sm" onClick={() => setChartExpanded((v) => !v)}>
            {chartExpanded ? 'Collapse' : 'Expand'}
          </Button>
        )}
      </div>
    </div>
  )

  const content = (
    <div className={"h-full flex flex-col dark bg-background text-foreground " + (chartExpanded ? 'overflow-hidden' : '')}>
      {header}

      {!chartExpanded && (
        <div className="px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="MODIFY">Modify</TabsTrigger>
              <TabsTrigger value="PROTECT">Protect</TabsTrigger>
              <TabsTrigger value="CHART">Chart</TabsTrigger>
              <TabsTrigger value="DETAILS">Details</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className={"flex-1 " + (chartExpanded ? 'overflow-hidden px-0 py-0' : 'overflow-auto px-4 py-4')}>

        {tab === 'CHART' && (
          <div className={"relative flex flex-col " + (chartExpanded ? 'h-full' : 'h-[420px]')}>
            {/* TradingView chart */}
            <div className={"flex-1 relative overflow-hidden rounded-lg border border-border " + (chartExpanded ? 'rounded-none border-0' : '')}>
              {position?.symbol ? (
                <>
                  <iframe
                    key={tvSymbol + tvInterval}
                    src={iframeSrc}
                    className="absolute inset-0 w-full h-full border-0"
                    allowTransparency="true"
                    scrolling="no"
                    allow="autoplay; encrypted-media"
                  />

                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              )}
            </div>

            {/* Timeframe bar */}
            <div className="flex items-center border-t border-border bg-[#0e1117] flex-shrink-0 px-2">
              {TIMEFRAMES.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTfIdx(i)}
                  className={[
                    'relative px-3 py-2 text-xs font-semibold transition-colors',
                    i === tfIdx ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {t.label}
                  {i === tfIdx && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Entry / SL / TP footer */}
            {!chartExpanded && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between px-1">
                <div>Entry: <span className="font-mono text-foreground">{formatPrice(overlays.entry, pipSize)}</span></div>
                <div>SL: <span className="font-mono text-foreground">{formatPrice(overlays.sl, pipSize)}</span></div>
                <div>TP: <span className="font-mono text-foreground">{formatPrice(overlays.tp, pipSize)}</span></div>
              </div>
            )}
          </div>
        )}

        {tab === 'PROTECT' && !chartExpanded && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium mb-3">Protections</div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Take profit (price)</div>
                  <Input
                    value={protect.tp}
                    onChange={(e) => setProtect((p) => ({ ...p, tp: e.target.value, dirty: true }))}
                    inputMode="decimal"
                    className="font-mono"
                    placeholder=""
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Stop loss (price)</div>
                  <Input
                    value={protect.sl}
                    onChange={(e) => setProtect((p) => ({ ...p, sl: e.target.value, dirty: true }))}
                    inputMode="decimal"
                    className="font-mono"
                    placeholder=""
                  />
                </div>
              </div>
              {protect.error && (
                <div className="mt-3 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-xs">
                  {protect.error}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <Button onClick={saveProtect} disabled={!protect.dirty || protect.saving} className="flex-1">
                  {protect.saving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setProtect((p) => ({
                    ...p,
                    tp: position?.take_profit == null ? '' : String(position.take_profit),
                    sl: position?.stop_loss == null ? '' : String(position.stop_loss),
                    dirty: false, error: '',
                  }))}
                  disabled={!protect.dirty || protect.saving}
                >
                  Reset
                </Button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Live P/L:{' '}
                <span className={unrealized != null && unrealized >= 0 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono'}>
                  {unrealized == null ? '—' : unrealized.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {(tab === 'MODIFY' || tab === 'DETAILS') && !chartExpanded && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            This tab is intentionally minimal for now.
          </div>
        )}
      </div>

      {!chartExpanded && (
        <div className="px-4 pb-4">
          <Button onClick={onClose} className="w-full h-12">Close</Button>
        </div>
      )}
    </div>
  )

  if (!embedded && isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
        <DrawerContent className="h-[88vh] p-0">
          <div className="flex-1 overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  if (embedded) {
    return <div className="dark bg-background text-foreground h-full">{content}</div>
  }

  return <div className="fixed inset-0 z-50 dark bg-background text-foreground">{content}</div>
}
