'use client'

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { getPipSize, formatPrice, pipsToPriceDelta } from '@/lib/trading/pips'
import {
  estimateGrossPnl,
  estimateBalancePct,
  formatMoneyApprox,
  formatPctApprox,
} from '@/lib/trading/pl'

const ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, n))
}

function reducer(state, action) {
  switch (action.type) {
    case 'setOrderType':
      return { ...state, orderType: action.value }
    case 'setSize':
      return { ...state, size: action.value }
    case 'setMarketRangeEnabled':
      return { ...state, marketRange: { ...state.marketRange, enabled: action.value } }
    case 'setMarketRangePips':
      return { ...state, marketRange: { ...state.marketRange, pips: action.value } }
    case 'setTpEnabled':
      return { ...state, tp: { ...state.tp, enabled: action.value } }
    case 'setTpPips':
      return { ...state, tp: { ...state.tp, pips: action.value } }
    case 'setSlEnabled':
      return { ...state, sl: { ...state.sl, enabled: action.value } }
    case 'setSlPips':
      return { ...state, sl: { ...state.sl, pips: action.value } }
    case 'setTriggerPrice':
      return { ...state, pending: { ...state.pending, triggerPrice: action.value } }
    case 'setLimitPrice':
      return { ...state, pending: { ...state.pending, limitPrice: action.value } }
    case 'setTrailingEnabled':
      return { ...state, trailing: { ...state.trailing, enabled: action.value } }
    case 'setComment':
      return { ...state, comment: action.value }
    default:
      return state
  }
}

function getSizeLabel(type) {
  return type === 'forex' ? 'Stakes' : 'Quantity (Lots)'
}

function createInitialState({ side, entryRefPrice }) {
  return {
    side,
    orderType: 'MARKET',
    entryRefPrice,
    size: '',
    marketRange: { enabled: false, pips: 5 },
    tp: { enabled: true, pips: 20 },
    sl: { enabled: true, pips: 20 },
    triggerBasis: 'TRADE',
    trailing: { enabled: false },
    pending: { triggerPrice: '', limitPrice: '' },
    comment: '',
  }
}

export default function OrderTicket({
  instrument,
  initialSide,
  entryRefPrice,
  onCancel,
  onExecuted,
  embedded = false,
}) {
  const [state, dispatch] = useReducer(
    reducer,
    { side: initialSide, entryRefPrice },
    () => createInitialState({ side: initialSide, entryRefPrice })
  )

  const [quote, setQuote] = useState(null)
  const [session, setSession] = useState({ isOpen: true, sessionMessage: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const symbolId = instrument?.symbol
  const pipSize = useMemo(
    () => getPipSize({ symbolId, type: instrument?.type }),
    [symbolId, instrument?.type]
  )

  const refreshQuote = useCallback(async () => {
    if (!symbolId) return
    try {
      const res = await fetch('/api/market/quote/' + encodeURIComponent(symbolId))
      if (!res.ok) return
      const data = await res.json()
      setQuote(data)
    } catch {}
  }, [symbolId])

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/market/session')
      if (!res.ok) return
      const data = await res.json()
      setSession({
        isOpen: !!data.isOpen,
        sessionMessage: data.sessionMessage || '',
      })
    } catch {}
  }, [])

  useEffect(() => {
    refreshQuote()
    refreshSession()
    const id = setInterval(() => {
      refreshQuote()
      refreshSession()
    }, 2000)
    return () => clearInterval(id)
  }, [refreshQuote, refreshSession])

  const derived = useMemo(() => {
    const bid = Number(quote?.bid)
    const ask = Number(quote?.ask)

    const entryMarket = state.side === 'BUY' ? ask : bid

    const triggerPrice = clampNumber(state.pending.triggerPrice, { min: 0 })
    const limitPrice = clampNumber(state.pending.limitPrice, { min: 0 })

    const entryPending =
      state.orderType === 'LIMIT'
        ? limitPrice
        : state.orderType === 'STOP'
          ? triggerPrice
          : state.orderType === 'STOP_LIMIT'
            ? (limitPrice ?? triggerPrice)
            : null

    const entry = state.orderType === 'MARKET' ? entryMarket : entryPending

    const tpPrice =
      state.tp.enabled && Number.isFinite(entry)
        ? (state.side === 'BUY'
          ? entry + pipsToPriceDelta(state.tp.pips, pipSize)
          : entry - pipsToPriceDelta(state.tp.pips, pipSize))
        : null

    const slPrice =
      state.sl.enabled && Number.isFinite(entry)
        ? (state.side === 'BUY'
          ? entry - pipsToPriceDelta(state.sl.pips, pipSize)
          : entry + pipsToPriceDelta(state.sl.pips, pipSize))
        : null

    return {
      bid,
      ask,
      entry,
      tpPrice,
      slPrice,
      triggerPrice,
      limitPrice,
    }
  }, [quote?.bid, quote?.ask, pipSize, state.orderType, state.pending.limitPrice, state.pending.triggerPrice, state.side, state.sl.enabled, state.sl.pips, state.tp.enabled, state.tp.pips])

  const account = useMemo(() => {
    // OrderTicket doesn’t fetch account itself; the parent can set window.__account if desired.
    // Fallback: we can still estimate pct if equity is available on window.
    const a = globalThis?.__INVESTPOP_ACCOUNT
    return a && typeof a === 'object' ? a : null
  }, [])

  const pipValuePerUnit = 1

  const tpEst = useMemo(() => {
    if (!state.tp.enabled) return null
    const size = clampNumber(state.size, { min: 0 })
    if (!size) return null
    const gross = estimateGrossPnl({
      distancePips: clampNumber(state.tp.pips, { min: 0 }) || 0,
      pipValuePerUnit,
      size,
    })
    if (gross == null) return null
    const pct = estimateBalancePct({ grossPnl: gross, equity: account?.equity })
    return { gross, pct }
  }, [account?.equity, state.size, state.tp.enabled, state.tp.pips])

  const slEst = useMemo(() => {
    if (!state.sl.enabled) return null
    const size = clampNumber(state.size, { min: 0 })
    if (!size) return null
    const grossAbs = estimateGrossPnl({
      distancePips: clampNumber(state.sl.pips, { min: 0 }) || 0,
      pipValuePerUnit,
      size,
    })
    if (grossAbs == null) return null
    const gross = -Math.abs(grossAbs)
    const pct = estimateBalancePct({ grossPnl: gross, equity: account?.equity })
    return { gross, pct }
  }, [account?.equity, state.size, state.sl.enabled, state.sl.pips])

  const validation = useMemo(() => {
    const errors = []

    const size = clampNumber(state.size, { min: 0 })
    if (!size || size <= 0) errors.push('Size must be greater than 0')

    if (!ORDER_TYPES.includes(state.orderType)) errors.push('Invalid order type')

    if (!session.isOpen && state.orderType === 'MARKET') {
      errors.push('Market is closed for market orders')
    }

    if (state.orderType === 'LIMIT' && !derived.limitPrice) errors.push('Limit price is required')
    if (state.orderType === 'STOP' && !derived.triggerPrice) errors.push('Trigger price is required')
    if (state.orderType === 'STOP_LIMIT') {
      if (!derived.triggerPrice) errors.push('Trigger price is required')
      if (!derived.limitPrice) errors.push('Limit price is required')
    }

    if (state.tp.enabled && (!clampNumber(state.tp.pips, { min: 0 }) || Number(state.tp.pips) <= 0)) {
      errors.push('TP pips must be positive')
    }
    if (state.sl.enabled && (!clampNumber(state.sl.pips, { min: 0 }) || Number(state.sl.pips) <= 0)) {
      errors.push('SL pips must be positive')
    }

    if (state.marketRange.enabled && state.orderType === 'MARKET') {
      const tol = pipsToPriceDelta(state.marketRange.pips, pipSize)
      const ref = Number(state.entryRefPrice)
      if (Number.isFinite(ref) && tol > 0) {
        if (state.side === 'BUY') {
          const currentAsk = Number(quote?.ask)
          if (Number.isFinite(currentAsk) && currentAsk > ref + tol) {
            errors.push('Market moved beyond market range tolerance')
          }
        } else {
          const currentBid = Number(quote?.bid)
          if (Number.isFinite(currentBid) && currentBid < ref - tol) {
            errors.push('Market moved beyond market range tolerance')
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors }
  }, [derived.limitPrice, derived.triggerPrice, pipSize, quote?.ask, quote?.bid, session.isOpen, state.entryRefPrice, state.marketRange.enabled, state.marketRange.pips, state.orderType, state.side, state.size, state.sl.enabled, state.sl.pips, state.tp.enabled, state.tp.pips])

  const placeOrder = useCallback(async () => {
    setSubmitError('')

    if (!validation.isValid) {
      setSubmitError(validation.errors[0] || 'Invalid order')
      return
    }

    setSubmitting(true)
    try {
      const size = Number(state.size)

      if (state.orderType === 'MARKET') {
        const payload = {
          symbol: instrument.symbol,
          type: instrument.type,
          action: state.side,
          quantity: size,
          takeProfit: state.tp.enabled ? derived.tpPrice : null,
          stopLoss: state.sl.enabled ? derived.slPrice : null,
        }

        const res = await fetch('/api/trade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to execute trade')

        if (onExecuted) onExecuted({ type: 'MARKET', trade: data.trade, instrument })
        return
      }

      // Pending orders: map to existing limit-order endpoint.
      const pendingPrice =
        state.orderType === 'LIMIT'
          ? derived.limitPrice
          : state.orderType === 'STOP'
            ? derived.triggerPrice
            : derived.limitPrice

      const res = await fetch('/api/orders/limit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: instrument.symbol,
          type: instrument.type,
          action: state.side,
          quantity: size,
          limitPrice: pendingPrice,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create pending order')

      if (onExecuted) onExecuted({ type: state.orderType, order: data.order, instrument })
    } catch (e) {
      setSubmitError(e?.message || 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }, [derived.limitPrice, derived.slPrice, derived.tpPrice, derived.triggerPrice, instrument, onExecuted, state.orderType, state.side, state.size, state.sl.enabled, state.tp.enabled, validation.errors, validation.isValid])

  const showClosedBanner = !session.isOpen
  const disablePlace = submitting || !validation.isValid

  return (
    <div
      className={
        embedded
          ? 'dark bg-background text-foreground h-full flex flex-col'
          : 'fixed inset-0 z-50 dark bg-background text-foreground'
      }
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <div className="text-base font-semibold">Place order</div>
          <div className="w-14" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
          {/* Order type selector */}
          <Tabs value={state.orderType} onValueChange={(v) => dispatch({ type: 'setOrderType', value: v })}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="MARKET">Market</TabsTrigger>
              <TabsTrigger value="LIMIT">Limit</TabsTrigger>
              <TabsTrigger value="STOP">Stop</TabsTrigger>
              <TabsTrigger value="STOP_LIMIT">Stop-limit</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Market status banner */}
          {showClosedBanner && (
            <div className="rounded-md bg-orange-500/20 text-orange-200 px-3 py-2 text-sm">
              {session.sessionMessage || 'The market is closed. Only pending orders are accepted.'}
            </div>
          )}

          {/* Quote block */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className={"flex-1 mr-2 rounded-md border px-3 py-2 " + (state.side === 'SELL' ? 'border-orange-500/50' : 'border-border')}>
                <div className="text-xs text-muted-foreground">SELL</div>
                <div className="text-lg font-mono">{formatPrice(derived.bid, pipSize)}</div>
              </div>
              <div className={"flex-1 ml-2 rounded-md border px-3 py-2 " + (state.side === 'BUY' ? 'border-emerald-500/50' : 'border-border')}>
                <div className="text-xs text-muted-foreground">BUY</div>
                <div className="text-lg font-mono">{formatPrice(derived.ask, pipSize)}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
              <div>H: <span className="font-mono text-foreground">{formatPrice(quote?.high, pipSize)}</span></div>
              <div>L: <span className="font-mono text-foreground">{formatPrice(quote?.low, pipSize)}</span></div>
              <div>S: <span className="font-mono text-foreground">{formatPrice((derived.ask ?? 0) - (derived.bid ?? 0), pipSize)}</span></div>
            </div>
          </div>

          {/* Required prices for pending orders */}
          {state.orderType !== 'MARKET' && (
            <div className="rounded-lg bg-card border border-border p-3 space-y-3">
              {state.orderType !== 'LIMIT' && (
                <div>
                  <div className="text-sm text-foreground mb-1">Trigger</div>
                  <Input
                    value={state.pending.triggerPrice}
                    onChange={(e) => dispatch({ type: 'setTriggerPrice', value: e.target.value })}
                    inputMode="decimal"
                    className="font-mono"
                    placeholder="Trigger price"
                  />
                </div>
              )}
              {state.orderType !== 'STOP' && (
                <div>
                  <div className="text-sm text-foreground mb-1">Price</div>
                  <Input
                    value={state.pending.limitPrice}
                    onChange={(e) => dispatch({ type: 'setLimitPrice', value: e.target.value })}
                    inputMode="decimal"
                    className="font-mono"
                    placeholder={state.orderType === 'LIMIT' ? 'Limit price' : 'Limit price'}
                  />
                </div>
              )}
            </div>
          )}

          {/* Size */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-foreground">{getSizeLabel(instrument?.type)}</div>
              <div className="text-sm text-foreground">{instrument?.symbol}</div>
            </div>
            <Input
              value={state.size}
              onChange={(e) => dispatch({ type: 'setSize', value: e.target.value })}
              inputMode="decimal"
              className="font-mono"
              placeholder="1"
            />
          </div>

          {/* Market range */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Market range</div>
              <Switch checked={state.marketRange.enabled} onCheckedChange={(v) => dispatch({ type: 'setMarketRangeEnabled', value: v })} />
            </div>
            {state.marketRange.enabled && (
              <div className="mt-3">
                <div className="text-sm text-foreground mb-1">Pips</div>
                <Input
                  value={state.marketRange.pips}
                  onChange={(e) => dispatch({ type: 'setMarketRangePips', value: e.target.value })}
                  inputMode="decimal"
                  className="font-mono"
                />
              </div>
            )}
          </div>

          {/* Take profit */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Take profit</div>
              <Switch checked={state.tp.enabled} onCheckedChange={(v) => dispatch({ type: 'setTpEnabled', value: v })} />
            </div>
            {state.tp.enabled && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-foreground">Pips</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-8 w-10 rounded bg-muted hover:bg-muted/80"
                      onClick={() => dispatch({ type: 'setTpPips', value: Math.max(0, Number(state.tp.pips || 0) - 1) })}
                      type="button"
                    >−</button>
                    <Input
                      value={state.tp.pips}
                      onChange={(e) => dispatch({ type: 'setTpPips', value: e.target.value })}
                      inputMode="decimal"
                      className="h-8 w-24 font-mono text-center"
                    />
                    <button
                      className="h-8 w-10 rounded bg-muted hover:bg-muted/80"
                      onClick={() => dispatch({ type: 'setTpPips', value: Number(state.tp.pips || 0) + 1 })}
                      type="button"
                    >+</button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Price <span className="font-mono text-foreground">~ {formatPrice(derived.tpPrice, pipSize)}</span></div>
                {tpEst && (
                  <div className="text-xs text-muted-foreground">Balance: ~ {formatPctApprox(tpEst.pct)} ; Gross profit: ~ {formatMoneyApprox(tpEst.gross, account?.currency)}</div>
                )}
              </div>
            )}
          </div>

          {/* Stop loss */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Stop loss</div>
              <Switch checked={state.sl.enabled} onCheckedChange={(v) => dispatch({ type: 'setSlEnabled', value: v })} />
            </div>
            {state.sl.enabled && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-foreground">Pips</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-8 w-10 rounded bg-muted hover:bg-muted/80"
                      onClick={() => dispatch({ type: 'setSlPips', value: Math.max(0, Number(state.sl.pips || 0) - 1) })}
                      type="button"
                    >−</button>
                    <Input
                      value={state.sl.pips}
                      onChange={(e) => dispatch({ type: 'setSlPips', value: e.target.value })}
                      inputMode="decimal"
                      className="h-8 w-24 font-mono text-center"
                    />
                    <button
                      className="h-8 w-10 rounded bg-muted hover:bg-muted/80"
                      onClick={() => dispatch({ type: 'setSlPips', value: Number(state.sl.pips || 0) + 1 })}
                      type="button"
                    >+</button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Price <span className="font-mono text-foreground">~ {formatPrice(derived.slPrice, pipSize)}</span></div>
                {slEst && (
                  <div className="text-xs text-muted-foreground">Balance: ~ {formatPctApprox(slEst.pct)} ; Gross profit: ~ {formatMoneyApprox(slEst.gross, account?.currency)}</div>
                )}
              </div>
            )}
          </div>

          {/* Trigger basis */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Trigger</div>
              <div className="text-sm text-foreground">{state.triggerBasis === 'TRADE' ? 'Trade' : state.triggerBasis}</div>
            </div>
          </div>

          {/* Trailing stop */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Trailing stop loss</div>
              <Switch checked={state.trailing.enabled} onCheckedChange={(v) => dispatch({ type: 'setTrailingEnabled', value: v })} />
            </div>
          </div>

          {/* Comment */}
          <div className="rounded-lg bg-card border border-border p-3">
            <div className="text-sm text-foreground mb-2">Comment</div>
            <Input
              value={state.comment}
              onChange={(e) => dispatch({ type: 'setComment', value: e.target.value.slice(0, 100) })}
              placeholder=""
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{String(state.comment || '').length}/100</div>
          </div>

          {submitError && (
            <div className="rounded-md bg-red-500/10 text-red-300 px-3 py-2 text-sm">
              {submitError}
            </div>
          )}

          {!validation.isValid && !submitError && (
            <div className="rounded-md bg-muted/40 text-muted-foreground px-3 py-2 text-xs">
              {validation.errors[0]}
            </div>
          )}

          <Separator />

          <Button
            onClick={placeOrder}
            disabled={disablePlace}
            className="w-full h-12 text-base font-semibold disabled:opacity-40"
          >
            {submitting ? 'Placing…' : 'Place order'}
          </Button>
        </div>
      </div>
    </div>
  )
}
