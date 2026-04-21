'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPrice, getPipSize } from '@/lib/trading/pips'
import { TrendingUp, TrendingDown } from 'lucide-react'

// ── Timeframe config ─────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '1m', secs: 60 },
  { label: '5m', secs: 300 },
  { label: '1H', secs: 3600 },
  { label: '5H', secs: 18000 },
  { label: '1D', secs: 86400 },
  { label: '1W', secs: 604800 },
]

function computeEMA(candles, period) {
  const k = 2 / (period + 1)
  const result = []
  let ema = null
  for (const c of candles) {
    ema = ema === null ? c.close : c.close * k + ema * (1 - k)
    result.push({ time: c.time, value: parseFloat(ema.toFixed(8)) })
  }
  return result
}

export default function InstrumentChart({ instrument, quote, onBuy, onSell }) {
  const [tfIdx, setTfIdx]               = useState(1)
  const [chartReady, setChartReady]     = useState(false)
  const [chartInitDone, setChartInitDone] = useState(false)
  const [candles, setCandles]           = useState([])
  const [limit, setLimit]               = useState(300)
  const [candlesLoading, setCandlesLoading] = useState(false)
  const [ohlc, setOhlc]                 = useState(null)

  const containerRef      = useRef(null)
  const chartApiRef       = useRef(null)
  const seriesRef         = useRef(null)
  const volSeriesRef      = useRef(null)
  const emaSeriesRef      = useRef(null)
  const bidLineRef        = useRef(null)
  const roRef             = useRef(null)

  const didInitialFitRef  = useRef(false)
  const candlesRef        = useRef([])
  const limitRef          = useRef(limit)
  const fetchingRef       = useRef(false)
  const lastLoadMoreAtRef = useRef(0)

  const tf = TIMEFRAMES[tfIdx]

  useEffect(() => { candlesRef.current = candles }, [candles])
  useEffect(() => { limitRef.current = limit }, [limit])

  const pipSize = useMemo(
    () => getPipSize({ symbolId: instrument?.symbol, type: instrument?.type }),
    [instrument?.symbol, instrument?.type]
  )

  // ── Reset on symbol / tf change ───────────────────────────────────────────
  useEffect(() => {
    if (!instrument?.symbol) return
    didInitialFitRef.current = false
    setCandles([])
    setLimit(300)
    setOhlc(null)
  }, [instrument?.symbol, tf.secs])

  // ── Fetch candles ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!instrument?.symbol) return
    let alive = true
    const controller = new AbortController()

    async function load() {
      try {
        fetchingRef.current = true
        setCandlesLoading(true)
        const url = `/api/market/candles/${encodeURIComponent(instrument.symbol)}?tf=${tf.secs}&limit=${limit}`
        const res = await fetch(url, { signal: controller.signal, cache: 'force-cache' })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!alive || !data) return
        setCandles(Array.isArray(data.candles) ? data.candles : [])
      } catch {
      } finally {
        fetchingRef.current = false
        setCandlesLoading(false)
      }
    }

    load()
    const id = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(id)
      try { controller.abort() } catch {}
    }
  }, [instrument?.symbol, tf.secs, limit])

  // ── Container ref callback ─────────────────────────────────────────────────
  const setContainer = useCallback((el) => {
    containerRef.current = el
    if (!el) return
    setChartReady(true)
  }, [])

  // ── Chart initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !containerRef.current) return
    if (chartApiRef.current) return
    let cancelled = false

    async function init() {
      const { createChart, CandlestickSeries, CrosshairMode, LineStyle, HistogramSeries, LineSeries } =
        await import('lightweight-charts')
      if (cancelled || !containerRef.current) return

      const el = containerRef.current

      const chart = createChart(el, {
        width:  el.clientWidth  || 400,
        height: el.clientHeight || 320,
        layout: {
          background: { color: '#0e1117' },
          textColor:  '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(148,163,184,0.04)' },
          horzLines: { color: 'rgba(148,163,184,0.04)' },
        },
        rightPriceScale: {
          borderColor:  'rgba(148,163,184,0.10)',
          textColor:    '#94a3b8',
          scaleMargins: { top: 0.05, bottom: 0.22 },
        },
        timeScale: {
          borderColor:    'rgba(148,163,184,0.10)',
          textColor:      '#94a3b8',
          timeVisible:    true,
          secondsVisible: false,
          rightOffset:    6,
          barSpacing:     8,
          minBarSpacing:  2,
        },
        crosshair: { mode: CrosshairMode.Normal },
        handleScroll: true,
        handleScale:  true,
      })

      // Candlestick — TradingView teal/red palette
      const series = chart.addSeries(CandlestickSeries, {
        upColor:         '#26a69a',
        downColor:       '#ef5350',
        borderUpColor:   '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor:     '#26a69a',
        wickDownColor:   '#ef5350',
      })

      // Volume histogram in lower 20%
      const volSeries = chart.addSeries(HistogramSeries, {
        color:        'rgba(148, 163, 184, 0.18)',
        priceFormat:  { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        drawTicks: false,
        visible: false,
      })

      // EMA-20 amber line
      const emaSeries = chart.addSeries(LineSeries, {
        color:                  '#f59e0b',
        lineWidth:              1,
        priceLineVisible:       false,
        lastValueVisible:       false,
        crosshairMarkerVisible: false,
      })

      // Current sell rate dashed line
      const bidLine = series.createPriceLine({
        price:            0,
        color:            '#a78bfa',
        lineWidth:        1,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: true,
        title:            'Sell',
      })

      chartApiRef.current  = chart
      seriesRef.current    = series
      volSeriesRef.current = volSeries
      emaSeriesRef.current = emaSeries
      bidLineRef.current   = bidLine

      // Crosshair OHLC subscriber
      chart.subscribeCrosshairMove((param) => {
        if (!param?.point || !param?.seriesData) { setOhlc(null); return }
        const bar = param.seriesData.get(series)
        if (bar) setOhlc({ open: bar.open, high: bar.high, low: bar.low, close: bar.close })
        else setOhlc(null)
      })

      setChartInitDone(true)

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
      roRef.current    = null
      try { chartApiRef.current?.remove() } catch {}
      chartApiRef.current  = null
      seriesRef.current    = null
      volSeriesRef.current = null
      emaSeriesRef.current = null
      bidLineRef.current   = null
      setChartInitDone(false)
      setOhlc(null)
    }
  }, [chartReady])

  // ── Load more history on left-edge pan ────────────────────────────────────
  useEffect(() => {
    const chart = chartApiRef.current
    if (!chartInitDone || !chart) return

    const timeScale = chart.timeScale()
    const handler = (range) => {
      if (!range) return
      const curr = candlesRef.current
      if (!curr || curr.length < 30) return
      const firstTime = Number(curr[0]?.time)
      if (!Number.isFinite(firstTime)) return
      if (Number(range.from) > firstTime + tf.secs * 10) return
      if (limitRef.current >= 500) return
      if (fetchingRef.current) return
      const now = Date.now()
      if (now - lastLoadMoreAtRef.current < 1500) return
      lastLoadMoreAtRef.current = now
      setLimit((prev) => Math.min(500, prev + 200))
    }

    try { timeScale.subscribeVisibleTimeRangeChange(handler) } catch { return }
    return () => { try { timeScale.unsubscribeVisibleTimeRangeChange(handler) } catch {} }
  }, [chartInitDone, tf.secs])

  // ── Push candle + volume + EMA data ──────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    const chart  = chartApiRef.current
    if (!series || !chart || candles.length === 0) return

    try {
      const ts = chart.timeScale()
      const existingRange = didInitialFitRef.current ? ts.getVisibleRange() : null

      series.setData(candles)

      // Volume
      const volSer = volSeriesRef.current
      if (volSer) {
        volSer.setData(candles.map(c => ({
          time:  c.time,
          value: c.value || Math.round(Math.abs(c.close - c.open) / c.open * c.close * 1000),
          color: c.close >= c.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)',
        })))
      }

      // EMA-20
      const emaSer = emaSeriesRef.current
      if (emaSer && candles.length >= 20) {
        emaSer.setData(computeEMA(candles, 20))
      }

      if (!didInitialFitRef.current) {
        ts.fitContent()
        didInitialFitRef.current = true
      } else if (existingRange) {
        ts.setVisibleRange(existingRange)
      }
    } catch {}
  }, [candles])

  // ── Live bid line ─────────────────────────────────────────────────────────
  useEffect(() => {
    const line = bidLineRef.current
    if (!line) return
    const bid = Number(quote?.bid)
    if (!Number.isFinite(bid) || bid <= 0) return
    try { line.applyOptions({ price: bid }) } catch {}
  }, [quote?.bid])

  const bid = quote?.bid
  const ask = quote?.ask

  const spread = (Number.isFinite(Number(bid)) && Number.isFinite(Number(ask)))
    ? formatPrice(Math.abs(Number(ask) - Number(bid)), pipSize)
    : null

  const dayChange = useMemo(() => {
    if (candles.length < 2) return null
    const first = candles[0].close
    const last  = candles[candles.length - 1].close
    const pct   = ((last - first) / first) * 100
    return { pct, positive: pct >= 0 }
  }, [candles])

  const quoteLoading     = quote == null
  const showChartLoading = !chartInitDone || (candlesLoading && candles.length === 0)

  return (
    <div className="flex flex-col h-full bg-[#0e1117] select-none">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0 gap-2 min-w-0">

        {/* Sell / Buy pills + spread */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onSell?.()}
            className="flex flex-col items-center rounded border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 transition-colors min-w-[70px]"
          >
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Sell</span>
            <span className="text-sm font-mono text-white leading-tight tabular-nums">
              {Number.isFinite(Number(bid)) ? formatPrice(bid, pipSize) : quoteLoading ? '…' : '—'}
            </span>
          </button>
          <button
            onClick={() => onBuy?.()}
            className="flex flex-col items-center rounded border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 transition-colors min-w-[70px]"
          >
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Buy</span>
            <span className="text-sm font-mono text-white leading-tight tabular-nums">
              {Number.isFinite(Number(ask)) ? formatPrice(ask, pipSize) : quoteLoading ? '…' : '—'}
            </span>
          </button>
          {spread && (
            <div className="hidden sm:flex flex-col items-center opacity-70">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Spread</span>
              <span className="text-[11px] font-mono text-slate-400">{spread}</span>
            </div>
          )}
        </div>

        {/* OHLC crosshair info (centre, desktop) */}
        {ohlc ? (
          <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-mono flex-1 justify-center min-w-0">
            <span>O <span className="text-slate-200">{formatPrice(ohlc.open, pipSize)}</span></span>
            <span className="text-emerald-400">H <span className="text-slate-200">{formatPrice(ohlc.high, pipSize)}</span></span>
            <span className="text-red-400">L <span className="text-slate-200">{formatPrice(ohlc.low, pipSize)}</span></span>
            <span className={ohlc.close >= ohlc.open ? 'text-emerald-400' : 'text-red-400'}>
              C {formatPrice(ohlc.close, pipSize)}
            </span>
          </div>
        ) : dayChange ? (
          <div className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            {dayChange.positive
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <span className={`text-xs font-semibold ${dayChange.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {dayChange.positive ? '+' : ''}{dayChange.pct.toFixed(2)}%
            </span>
          </div>
        ) : null}

        {/* Instrument name */}
        <div className="text-right min-w-0 flex-shrink-0">
          <div className="text-white font-semibold text-sm truncate max-w-[120px] sm:max-w-none">
            {instrument?.name || instrument?.symbol || '—'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{instrument?.symbol}</div>
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={setContainer} className="absolute inset-0" />
        {showChartLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-slate-600 text-sm">Loading chart…</span>
          </div>
        )}
        {/* Mobile OHLC overlay on crosshair */}
        {ohlc && (
          <div className="absolute top-1 left-2 flex gap-2 text-[10px] font-mono bg-[#0d1117]/90 px-2 py-1 rounded sm:hidden pointer-events-none">
            <span>O <span className="text-slate-200">{formatPrice(ohlc.open, pipSize)}</span></span>
            <span className="text-emerald-400">H <span className="text-slate-200">{formatPrice(ohlc.high, pipSize)}</span></span>
            <span className="text-red-400">L <span className="text-slate-200">{formatPrice(ohlc.low, pipSize)}</span></span>
            <span className={ohlc.close >= ohlc.open ? 'text-emerald-400' : 'text-red-400'}>
              C {formatPrice(ohlc.close, pipSize)}
            </span>
          </div>
        )}
      </div>

      {/* ── Timeframe bar + EMA legend ── */}
      <div className="flex items-center px-4 border-t border-slate-800 flex-shrink-0 bg-[#0e1117]">
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
        <div className="ml-auto flex items-center gap-1.5 pr-1 opacity-70">
          <span className="w-5 h-[2px] bg-amber-400 inline-block rounded" />
          <span className="text-[10px] text-slate-500">EMA 20</span>
        </div>
      </div>
    </div>
  )
}

