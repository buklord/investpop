'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPrice, getPipSize } from '@/lib/trading/pips'

// ── Timeframe config ─────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '1m',  bucketSecs: 60     },
  { label: '5m',  bucketSecs: 300    },
  { label: '1H',  bucketSecs: 3600   },
  { label: '5H',  bucketSecs: 18000  },
  { label: '1D',  bucketSecs: 86400  },
  { label: '1W',  bucketSecs: 604800 },
]

function buildCandles(ticks, bucketSecs) {
  if (!Array.isArray(ticks) || ticks.length === 0) return []
  const map = new Map()
  for (const tick of ticks) {
    const mid = Number(tick?.mid)
    const t = Number(tick?.t)
    if (!Number.isFinite(mid) || mid <= 0) continue
    if (!Number.isFinite(t) || t <= 0) continue
    const time = Math.floor(t / 1000 / bucketSecs) * bucketSecs
    if (!map.has(time)) {
      map.set(time, { time, open: mid, high: mid, low: mid, close: mid })
    } else {
      const c = map.get(time)
      c.high  = Math.max(c.high, mid)
      c.low   = Math.min(c.low, mid)
      c.close = mid
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

export default function InstrumentChart({ ticks = [], instrument, quote, onBuy, onSell }) {
  const [tfIdx, setTfIdx] = useState(1) // default 5m
  const [chartReady, setChartReady] = useState(false)

  const containerRef  = useRef(null)
  const chartApiRef   = useRef(null)
  const seriesRef     = useRef(null)
  const bidLineRef    = useRef(null)
  const roRef         = useRef(null)

  const tf = TIMEFRAMES[tfIdx]

  const candles = useMemo(() => buildCandles(ticks, tf.bucketSecs), [ticks, tf.bucketSecs])

  const pipSize = useMemo(
    () => getPipSize({ symbolId: instrument?.symbol, type: instrument?.type }),
    [instrument?.symbol, instrument?.type]
  )

  // ── Ref callback – fires when the container DIV is first added to the DOM ──
  const setContainer = useCallback((el) => {
    containerRef.current = el
    if (!el) return
    setChartReady(true)
  }, [])

  // ── Chart initialization (runs once, after container is in DOM) ────────────
  useEffect(() => {
    if (!chartReady || !containerRef.current) return
    if (chartApiRef.current) return // already initialized

    let cancelled = false

    async function init() {
      const { createChart, CandlestickSeries, CrosshairMode, LineStyle } = await import('lightweight-charts')
      if (cancelled || !containerRef.current) return

      const el = containerRef.current
      const w  = el.clientWidth  || 400
      const h  = el.clientHeight || 320

      const chart = createChart(el, {
        width:  w,
        height: h,
        layout: {
          background: { color: '#0e1117' },
          textColor:  '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.06)' },
          horzLines: { color: 'rgba(148,163,184,0.06)' },
        },
        rightPriceScale: {
          borderColor:  'rgba(148,163,184,0.12)',
          textColor:    '#94a3b8',
        },
        timeScale: {
          borderColor:  'rgba(148,163,184,0.12)',
          textColor:    '#94a3b8',
          timeVisible:  true,
          secondsVisible: false,
        },
        crosshair: { mode: CrosshairMode.Normal },
        handleScroll:  true,
        handleScale:   true,
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor:        '#22c55e',
        downColor:      '#ef4444',
        borderUpColor:  '#22c55e',
        borderDownColor:'#ef4444',
        wickUpColor:    '#22c55e',
        wickDownColor:  '#ef4444',
      })

      // "Current sell rate" price line
      const bidLine = series.createPriceLine({
        price:            0,
        color:            '#a78bfa',
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: true,
        title:            'Sell rate',
      })

      chartApiRef.current = chart
      seriesRef.current   = series
      bidLineRef.current  = bidLine

      const ro = new ResizeObserver(() => {
        if (!chartApiRef.current || !el.parentElement) return
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
      })
      ro.observe(el)
      roRef.current = ro
    }

    init()

    return () => {
      cancelled = true
      try { roRef.current?.disconnect() } catch {}
      roRef.current = null
      try { chartApiRef.current?.remove() } catch {}
      chartApiRef.current = null
      seriesRef.current   = null
      bidLineRef.current  = null
    }
  }, [chartReady])

  // ── Push candle data whenever it changes ──────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    const chart  = chartApiRef.current
    if (!series || !chart) return
    if (candles.length === 0) return
    try {
      series.setData(candles)
      chart.timeScale().fitContent()
    } catch {}
  }, [candles])

  // ── Live bid line ─────────────────────────────────────────────────────────
  useEffect(() => {
    const line = bidLineRef.current
    if (!line) return
    const bid = Number(quote?.bid)
    if (!Number.isFinite(bid) || bid <= 0) return
    try {
      line.applyOptions({ price: bid, axisLabelVisible: true })
    } catch {}
  }, [quote?.bid])

  const bid = quote?.bid
  const ask = quote?.ask

  return (
    <div className="flex flex-col h-full bg-[#0e1117] select-none">

      {/* ── Header: instrument info + sell/buy ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 flex-shrink-0">
        {/* Left: Sell / Buy price pills (like Plus500 style) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSell?.()}
            className="flex flex-col items-center rounded border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 transition-colors min-w-[70px]"
          >
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Sell</span>
            <span className="text-sm font-mono text-white leading-tight tabular-nums">
              {Number.isFinite(Number(bid)) ? formatPrice(bid, pipSize) : '—'}
            </span>
          </button>
          <button
            onClick={() => onBuy?.()}
            className="flex flex-col items-center rounded border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 transition-colors min-w-[70px]"
          >
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Buy</span>
            <span className="text-sm font-mono text-white leading-tight tabular-nums">
              {Number.isFinite(Number(ask)) ? formatPrice(ask, pipSize) : '—'}
            </span>
          </button>
        </div>

        {/* Right: instrument name + symbol */}
        <div className="text-right min-w-0">
          <div className="text-white font-semibold text-sm truncate">{instrument?.name || instrument?.symbol || '—'}</div>
          <div className="text-[10px] text-slate-500 font-mono">{instrument?.symbol}</div>
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={setContainer} className="absolute inset-0" />
        {candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-500 text-sm">Loading chart…</span>
          </div>
        )}
      </div>

      {/* ── Timeframe bar — Plus500 style with blue underline ── */}
      <div className="flex items-center gap-0 px-4 border-t border-slate-800 flex-shrink-0 bg-[#0e1117]">
        {TIMEFRAMES.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTfIdx(i)}
            className={[
              'relative px-3 py-2 text-xs font-semibold transition-colors',
              i === tfIdx
                ? 'text-blue-400'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {t.label}
            {i === tfIdx && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-t" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
