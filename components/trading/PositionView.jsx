'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { getPipSize, formatPrice } from '@/lib/trading/pips'

function buildCandlesFromTicks(ticks, groupSize = 6) {
  if (!Array.isArray(ticks) || ticks.length < groupSize) return []
  const candles = []
  for (let i = 0; i < ticks.length; i += groupSize) {
    const slice = ticks.slice(i, i + groupSize)
    if (slice.length === 0) continue
    const open = slice[0].mid
    const close = slice[slice.length - 1].mid
    const high = Math.max(...slice.map(p => p.mid))
    const low = Math.min(...slice.map(p => p.mid))
    const time = Math.floor((slice[slice.length - 1].t || Date.now()) / 1000)
    candles.push({ time, open, high, low, close })
  }
  return candles
}

export default function PositionView({ positionId, onClose, embedded = false }) {
  const [tab, setTab] = useState('CHART')
  const [position, setPosition] = useState(null)
  const [ticks, setTicks] = useState([])
  const [chartExpanded, setChartExpanded] = useState(false)
  const [protect, setProtect] = useState({ tp: '', sl: '', dirty: false, saving: false, error: '' })
  const isMobile = useIsMobile()
  const chartRef = useRef(null)
  const chartApiRef = useRef(null)
  const seriesRef = useRef(null)
  const priceLinesRef = useRef({ entry: null, tp: null, sl: null })
  const resizeObserverRef = useRef(null)

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

  useEffect(() => {
    setProtect((p) => {
      const tp = position?.take_profit == null ? '' : String(position.take_profit)
      const sl = position?.stop_loss == null ? '' : String(position.stop_loss)
      return { ...p, tp, sl, dirty: false, error: '' }
    })
  }, [position?.take_profit, position?.stop_loss])

  useEffect(() => {
    let alive = true
    async function loadHistory() {
      if (!position?.symbol) return
      try {
        const res = await fetch('/api/market/history/' + encodeURIComponent(position.symbol) + '?limit=240')
        if (!res.ok) return
        const data = await res.json()
        if (alive) setTicks(data.history || [])
      } catch {}
    }
    loadHistory()
    const id = setInterval(loadHistory, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [position?.symbol])

  const pipSize = useMemo(() => getPipSize({ symbolId: position?.symbol, type: position?.type }), [position?.symbol, position?.type])

  const candles = useMemo(() => buildCandlesFromTicks(ticks, 6), [ticks])

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

  const lastMid = useMemo(() => {
    const last = ticks?.[ticks.length - 1]
    return last?.mid != null ? Number(last.mid) : null
  }, [ticks])

  const unrealized = useMemo(() => {
    if (!position || lastMid == null) return null
    const qty = Number(position.quantity) || 0
    const entry = Number(position.entry_price) || 0
    const side = position.side
    const points = side === 'SHORT' ? (entry - lastMid) : (lastMid - entry)
    const gross = points * qty
    if (!Number.isFinite(gross)) return null
    return gross
  }, [lastMid, position])

  useEffect(() => {
    if (tab !== 'CHART') return
    if (!chartRef.current) return
    if (chartApiRef.current) return

    let cancelled = false

    async function init() {
      const { createChart, LineStyle, CrosshairMode } = await import('lightweight-charts')
      if (cancelled) return

      const themedRoot = chartRef.current?.closest('.dark') || document.documentElement
      const css = getComputedStyle(themedRoot)
      const bg = css.getPropertyValue('--background').trim()
      const fg = css.getPropertyValue('--foreground').trim()
      const border = css.getPropertyValue('--border').trim()
      const muted = css.getPropertyValue('--muted-foreground').trim()
      const chartUp = css.getPropertyValue('--chart-2').trim()
      const chartDown = css.getPropertyValue('--chart-1').trim()

      const upColor = chartUp ? `hsl(${chartUp})` : (muted ? `hsl(${muted})` : (fg ? `hsl(${fg})` : 'white'))
      const downColor = chartDown ? `hsl(${chartDown})` : (muted ? `hsl(${muted})` : (fg ? `hsl(${fg})` : 'white'))

      chartRef.current.innerHTML = ''
      const chart = createChart(chartRef.current, {
        layout: {
          background: { color: bg ? `hsl(${bg})` : 'black' },
          textColor: muted ? `hsl(${muted})` : (fg ? `hsl(${fg})` : 'white'),
        },
        grid: {
          vertLines: { color: border ? `hsl(${border} / 0.5)` : 'rgba(148,163,184,0.2)' },
          horzLines: { color: border ? `hsl(${border} / 0.5)` : 'rgba(148,163,184,0.2)' },
        },
        rightPriceScale: { borderColor: border ? `hsl(${border})` : 'rgba(148,163,184,0.25)' },
        timeScale: { borderColor: border ? `hsl(${border})` : 'rgba(148,163,184,0.25)' },
        crosshair: { mode: CrosshairMode.Normal },
      })

      const series = chart.addCandlestickSeries({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      })

      chartApiRef.current = chart
      seriesRef.current = series

      priceLinesRef.current.entry = series.createPriceLine({
        price: Number.isFinite(overlays.entry) ? overlays.entry : 0,
        color: muted ? `hsl(${muted})` : 'rgba(148,163,184,0.8)',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: Number.isFinite(overlays.entry),
        title: 'Entry',
      })
      priceLinesRef.current.tp = series.createPriceLine({
        price: Number.isFinite(overlays.tp) ? overlays.tp : 0,
        color: upColor,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: Number.isFinite(overlays.tp),
        title: 'TP',
      })
      priceLinesRef.current.sl = series.createPriceLine({
        price: Number.isFinite(overlays.sl) ? overlays.sl : 0,
        color: downColor,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: Number.isFinite(overlays.sl),
        title: 'SL',
      })

      if (candles.length > 0) {
        series.setData(candles)
        chart.timeScale().fitContent()
      }

      const el = chartRef.current
      const ro = new ResizeObserver(() => {
        if (!chartApiRef.current) return
        chartApiRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight })
        chartApiRef.current.timeScale().fitContent()
      })
      ro.observe(el)
      resizeObserverRef.current = ro
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    }

    init()

    return () => {
      cancelled = true
      try {
        resizeObserverRef.current?.disconnect()
      } catch {}
      resizeObserverRef.current = null
      try {
        chartApiRef.current?.remove()
      } catch {}
      chartApiRef.current = null
      seriesRef.current = null
      priceLinesRef.current = { entry: null, tp: null, sl: null }
    }
  }, [candles.length, overlays.entry, overlays.sl, overlays.tp, tab])

  useEffect(() => {
    if (tab !== 'CHART') return
    const series = seriesRef.current
    const chart = chartApiRef.current
    if (!series || !chart) return
    if (candles.length > 0) {
      series.setData(candles)
    }
    chart.timeScale().fitContent()
  }, [candles, tab])

  useEffect(() => {
    if (tab !== 'CHART') return
    const entryLine = priceLinesRef.current.entry
    const tpLine = priceLinesRef.current.tp
    const slLine = priceLinesRef.current.sl
    if (entryLine) {
      entryLine.applyOptions({
        price: Number.isFinite(overlays.entry) ? overlays.entry : 0,
        axisLabelVisible: Number.isFinite(overlays.entry),
        lineVisible: Number.isFinite(overlays.entry),
      })
    }
    if (tpLine) {
      tpLine.applyOptions({
        price: Number.isFinite(overlays.tp) ? overlays.tp : 0,
        axisLabelVisible: Number.isFinite(overlays.tp),
        lineVisible: Number.isFinite(overlays.tp),
      })
    }
    if (slLine) {
      slLine.applyOptions({
        price: Number.isFinite(overlays.sl) ? overlays.sl : 0,
        axisLabelVisible: Number.isFinite(overlays.sl),
        lineVisible: Number.isFinite(overlays.sl),
      })
    }
  }, [overlays.entry, overlays.sl, overlays.tp, tab])

  const sizeLabel = position?.type === 'forex' ? 'Stakes' : 'Lots'
  const direction = position?.side === 'LONG' ? 'BUY' : 'SELL'
  const dirBadge = direction === 'SELL' ? '↓' : '↑'

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
      <div className="text-base font-semibold">
        {position?.symbol || 'Position'}
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          {(Number(position?.quantity) || 0).toFixed(2)} {sizeLabel} {dirBadge}
        </span>
        <span className="ml-2 text-xs font-mono text-muted-foreground">
          {lastMid == null ? '—' : formatPrice(lastMid, pipSize)}
        </span>
        <span
          className={
            'ml-2 text-xs font-mono ' +
            (unrealized == null
              ? 'text-muted-foreground'
              : unrealized >= 0
                ? 'text-emerald-400'
                : 'text-red-400')
          }
        >
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
          <div className={"relative h-full " + (chartExpanded ? 'px-0' : '')}>
            <div className={"rounded-lg border border-border overflow-hidden bg-card " + (chartExpanded ? 'h-full rounded-none border-0' : 'h-[420px]') }>
              <div ref={chartRef} className="w-full h-full" />
            </div>
            {!chartExpanded && (
              <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                <div>
                  Entry: <span className="font-mono text-foreground">{formatPrice(overlays.entry, pipSize)}</span>
                </div>
                <div>
                  SL: <span className="font-mono text-foreground">{formatPrice(overlays.sl, pipSize)}</span>
                </div>
                <div>
                  TP: <span className="font-mono text-foreground">{formatPrice(overlays.tp, pipSize)}</span>
                </div>
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
                    placeholder="" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Stop loss (price)</div>
                  <Input
                    value={protect.sl}
                    onChange={(e) => setProtect((p) => ({ ...p, sl: e.target.value, dirty: true }))}
                    inputMode="decimal"
                    className="font-mono"
                    placeholder="" />
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
                  onClick={() =>
                    setProtect((p) => ({
                      ...p,
                      tp: position?.take_profit == null ? '' : String(position.take_profit),
                      sl: position?.stop_loss == null ? '' : String(position.stop_loss),
                      dirty: false,
                      error: '',
                    }))
                  }
                  disabled={!protect.dirty || protect.saving}
                >
                  Reset
                </Button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Live P/L: <span className={unrealized != null && unrealized >= 0 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono'}>
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
    return (
      <div className="dark bg-background text-foreground h-full">
        {content}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 dark bg-background text-foreground">
      {content}
    </div>
  )
}
