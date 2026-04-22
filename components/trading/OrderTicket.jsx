'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { getPipSize, formatPrice, pipsToPriceDelta } from '@/lib/trading/pips'
import { estimateGrossPnl, formatMoneyApprox } from '@/lib/trading/pl'

const QUICK_SIZES = [0.1, 0.5, 1, 2, 5]

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, n))
}

function reducer(state, action) {
  switch (action.type) {
    case 'setSide':    return { ...state, side: action.value }
    case 'setSize':    return { ...state, size: action.value }
    case 'setTpPips':  return { ...state, tpPips: action.value }
    case 'setSlPips':  return { ...state, slPips: action.value }
    case 'toggleTp':   return { ...state, tpOn: !state.tpOn }
    case 'toggleSl':   return { ...state, slOn: !state.slOn }
    default:           return state
  }
}

function loadTradingDefaults() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('trading_defaults')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function initState({ side }) {
  const def = loadTradingDefaults()
  return {
    side,
    size:   def.lotSize != null ? String(def.lotSize) : '',
    tpPips: def.tpPips  != null ? Number(def.tpPips)  : 20,
    slPips: def.slPips  != null ? Number(def.slPips)  : 20,
    tpOn: true,
    slOn: true,
  }
}

function PipsControl({ value, onChange, disabled }) {
  const v = Number(value) || 0
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || v <= 1}
        onClick={() => onChange(Math.max(1, v - 1))}
        className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold disabled:opacity-30 transition-colors"
      >−</button>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-14 h-7 rounded-md bg-white/5 border border-white/10 text-center text-sm font-mono text-white focus:outline-none focus:border-blue-500/60 disabled:opacity-30"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(v + 1)}
        className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold disabled:opacity-30 transition-colors"
      >+</button>
    </div>
  )
}

export default function OrderTicket({ instrument, initialSide, entryRefPrice, onCancel, onExecuted, embedded = false }) {
  const [state, dispatch] = useReducer(reducer, { side: initialSide }, initState)
  const [quote, setQuote]       = useState(null)
  const [session, setSession]   = useState({ isOpen: true, sessionMessage: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess]   = useState(false)

  const symbolId = instrument?.symbol
  const pipSize  = useMemo(() => getPipSize({ symbolId, type: instrument?.type }), [symbolId, instrument?.type])

  // ── Live quote + session ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!symbolId) return
    try {
      const [qRes, sRes] = await Promise.all([
        fetch('/api/market/quote/' + encodeURIComponent(symbolId)),
        fetch('/api/market/session'),
      ])
      if (qRes.ok) setQuote(await qRes.json())
      if (sRes.ok) {
        const s = await sRes.json()
        setSession({ isOpen: !!s.isOpen, sessionMessage: s.sessionMessage || '' })
      }
    } catch {}
  }, [symbolId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Derived prices ────────────────────────────────────────────────────────
  const bid   = Number(quote?.bid)
  const ask   = Number(quote?.ask)
  const entry = state.side === 'BUY' ? ask : bid
  const high  = Number(quote?.high)
  const low   = Number(quote?.low)

  const tpPrice = useMemo(() => {
    if (!state.tpOn || !Number.isFinite(entry)) return null
    const delta = pipsToPriceDelta(Number(state.tpPips) || 0, pipSize)
    return state.side === 'BUY' ? entry + delta : entry - delta
  }, [entry, pipSize, state.side, state.tpOn, state.tpPips])

  const slPrice = useMemo(() => {
    if (!state.slOn || !Number.isFinite(entry)) return null
    const delta = pipsToPriceDelta(Number(state.slPips) || 0, pipSize)
    return state.side === 'BUY' ? entry - delta : entry + delta
  }, [entry, pipSize, state.side, state.slOn, state.slPips])

  const account = useMemo(() => globalThis?.__INVESTPOP_ACCOUNT || null, [])

  const size = clampNumber(state.size, { min: 0 }) || 0

  const tpDollar = useMemo(() => {
    if (!state.tpOn || !size) return null
    return estimateGrossPnl({ distancePips: Number(state.tpPips) || 0, pipValuePerUnit: 1, size })
  }, [size, state.tpOn, state.tpPips])

  const slDollar = useMemo(() => {
    if (!state.slOn || !size) return null
    const g = estimateGrossPnl({ distancePips: Number(state.slPips) || 0, pipValuePerUnit: 1, size })
    return g != null ? -Math.abs(g) : null
  }, [size, state.slOn, state.slPips])

  const rr = useMemo(() => {
    const tp = Number(state.tpPips) || 0
    const sl = Number(state.slPips) || 1
    if (!state.tpOn || !state.slOn || sl === 0) return null
    const ratio = tp / sl
    return ratio.toFixed(2)
  }, [state.slOn, state.slPips, state.tpOn, state.tpPips])

  // ── Validation ────────────────────────────────────────────────────────────
  const error = useMemo(() => {
    if (!size || size <= 0) return 'Size must be greater than 0'
    if (!session.isOpen) return session.sessionMessage || 'Market is closed'
    if (state.tpOn && Number(state.tpPips) <= 0) return 'TP pips must be positive'
    if (state.slOn && Number(state.slPips) <= 0) return 'SL pips must be positive'
    return null
  }, [session.isOpen, session.sessionMessage, size, state.slOn, state.slPips, state.tpOn, state.tpPips])

  // ── Submit ────────────────────────────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    if (error) { setSubmitError(error); return }
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: instrument.symbol,
          type: instrument.type,
          action: state.side,
          quantity: size,
          takeProfit: state.tpOn ? tpPrice : null,
          stopLoss:   state.slOn ? slPrice : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to execute trade')
      setSuccess(true)
      setTimeout(() => { if (onExecuted) onExecuted({ type: 'MARKET', trade: data.trade, instrument }) }, 900)
    } catch (e) {
      setSubmitError(e?.message || 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }, [error, instrument, onExecuted, size, slPrice, state.side, state.slOn, state.tpOn, tpPrice])

  const isBuy = state.side === 'BUY'

  return (
    <div className={embedded ? 'dark bg-[#0d1117] text-foreground h-full flex flex-col' : 'fixed inset-0 z-50 dark bg-[#0d1117] text-foreground flex flex-col'}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
        <div className="flex flex-col items-center">
          <span className="text-white font-bold text-base tracking-wide">{instrument?.symbol}</span>
          <span className="text-slate-500 text-[11px]">{instrument?.name}</span>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 space-y-4">

        {/* ── SELL / BUY big toggle ── */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {/* SELL */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'setSide', value: 'SELL' })}
            className={[
              'flex flex-col items-center py-3.5 rounded-xl transition-all duration-200',
              !isBuy
                ? 'bg-orange-500/20 border border-orange-500/40 shadow-[0_0_16px_rgba(249,115,22,0.15)]'
                : 'border border-transparent hover:bg-white/[0.04]',
            ].join(' ')}
          >
            <span className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${!isBuy ? 'text-orange-400' : 'text-slate-500'}`}>Sell</span>
            <span className={`text-xl font-mono font-semibold ${!isBuy ? 'text-orange-300' : 'text-slate-400'}`}>
              {Number.isFinite(bid) ? formatPrice(bid, pipSize) : '—'}
            </span>
          </button>
          {/* BUY */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'setSide', value: 'BUY' })}
            className={[
              'flex flex-col items-center py-3.5 rounded-xl transition-all duration-200',
              isBuy
                ? 'bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.15)]'
                : 'border border-transparent hover:bg-white/[0.04]',
            ].join(' ')}
          >
            <span className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${isBuy ? 'text-emerald-400' : 'text-slate-500'}`}>Buy</span>
            <span className={`text-xl font-mono font-semibold ${isBuy ? 'text-emerald-300' : 'text-slate-400'}`}>
              {Number.isFinite(ask) ? formatPrice(ask, pipSize) : '—'}
            </span>
          </button>
        </div>

        {/* High / Low / Spread row */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-500">
          <span>H <span className="text-slate-400">{Number.isFinite(high) ? formatPrice(high, pipSize) : '—'}</span></span>
          <span>L <span className="text-slate-400">{Number.isFinite(low)  ? formatPrice(low,  pipSize) : '—'}</span></span>
          <span>Spread <span className="text-slate-400">{Number.isFinite(bid) && Number.isFinite(ask) ? formatPrice(Math.abs(ask - bid), pipSize) : '—'}</span></span>
        </div>

        {/* ── Amount ── */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Amount</span>
            <span className="text-xs text-slate-500 font-mono">{instrument?.symbol}</span>
          </div>

          {/* Quick chips */}
          <div className="flex gap-2">
            {QUICK_SIZES.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => dispatch({ type: 'setSize', value: String(q) })}
                className={[
                  'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  String(state.size) === String(q)
                    ? (isBuy ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40' : 'bg-orange-500/25 text-orange-300 border border-orange-500/40')
                    : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.10] border border-transparent',
                ].join(' ')}
              >{q}</button>
            ))}
          </div>

          {/* Manual input */}
          <input
            type="number"
            value={state.size}
            onChange={e => dispatch({ type: 'setSize', value: e.target.value })}
            inputMode="decimal"
            placeholder="Custom amount…"
            className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* ── TP / SL card ── */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Risk / Reward</span>
            {rr && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                R:R {rr}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Take Profit */}
            <div className={['rounded-xl p-3 border transition-colors', state.tpOn ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.06]'].join(' ')}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${state.tpOn ? 'text-emerald-400' : 'text-slate-500'}`}>TP</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'toggleTp' })}
                  className={['w-8 h-4 rounded-full transition-colors relative', state.tpOn ? 'bg-emerald-500' : 'bg-white/20'].join(' ')}
                >
                  <span className={['absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', state.tpOn ? 'right-0.5' : 'left-0.5'].join(' ')} />
                </button>
              </div>
              <PipsControl value={state.tpPips} onChange={v => dispatch({ type: 'setTpPips', value: v })} disabled={!state.tpOn} />
              <div className="mt-2 text-[11px] font-mono space-y-0.5">
                <div className="text-slate-500">~ {tpPrice != null ? formatPrice(tpPrice, pipSize) : '—'}</div>
                {tpDollar != null && <div className="text-emerald-400 font-semibold">+{formatMoneyApprox(tpDollar, account?.currency)}</div>}
              </div>
            </div>

            {/* Stop Loss */}
            <div className={['rounded-xl p-3 border transition-colors', state.slOn ? 'bg-red-500/10 border-red-500/30' : 'bg-white/[0.03] border-white/[0.06]'].join(' ')}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${state.slOn ? 'text-red-400' : 'text-slate-500'}`}>SL</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'toggleSl' })}
                  className={['w-8 h-4 rounded-full transition-colors relative', state.slOn ? 'bg-red-500' : 'bg-white/20'].join(' ')}
                >
                  <span className={['absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', state.slOn ? 'right-0.5' : 'left-0.5'].join(' ')} />
                </button>
              </div>
              <PipsControl value={state.slPips} onChange={v => dispatch({ type: 'setSlPips', value: v })} disabled={!state.slOn} />
              <div className="mt-2 text-[11px] font-mono space-y-0.5">
                <div className="text-slate-500">~ {slPrice != null ? formatPrice(slPrice, pipSize) : '—'}</div>
                {slDollar != null && <div className="text-red-400 font-semibold">{formatMoneyApprox(slDollar, account?.currency)}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Market closed banner ── */}
        {!session.isOpen && (
          <div className="rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-200 px-4 py-3 text-sm">
            {session.sessionMessage || 'Market is closed'}
          </div>
        )}

        {/* ── Error ── */}
        {(submitError || (!submitError && error && size > 0)) && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
            {submitError || error}
          </div>
        )}

      </div>

      {/* ── Place order button (sticky bottom) ── */}
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        <button
          type="button"
          onClick={placeOrder}
          disabled={submitting || !!error || success}
          className={[
            'w-full h-14 rounded-2xl text-base font-bold tracking-wide transition-all duration-200 relative overflow-hidden',
            success
              ? 'bg-emerald-500 text-white'
              : isBuy
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white disabled:bg-emerald-500/30 disabled:text-emerald-500/50'
                : 'bg-orange-500 hover:bg-orange-400 text-white disabled:bg-orange-500/30 disabled:text-orange-500/50',
            'disabled:cursor-not-allowed shadow-lg',
          ].join(' ')}
        >
          {success
            ? '✓ Order placed!'
            : submitting
              ? 'Placing…'
              : Number.isFinite(entry)
                ? `${isBuy ? 'Buy' : 'Sell'} ${instrument?.symbol} @ ${formatPrice(entry, pipSize)}`
                : `${isBuy ? 'Buy' : 'Sell'} ${instrument?.symbol ?? ''}`
          }
        </button>
        {size > 0 && !error && Number.isFinite(entry) && (
          <div className="mt-2 text-center text-xs text-slate-500">
            {size} × {formatPrice(entry, pipSize)} · Market execution
          </div>
        )}
      </div>
    </div>
  )
}
