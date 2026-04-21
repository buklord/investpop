'use client'

import { useMemo, useState } from 'react'
import { formatPrice, getPipSize } from '@/lib/trading/pips'

// ── Timeframe config ─────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '1m',  tv: '1'   },
  { label: '5m',  tv: '5'   },
  { label: '15m', tv: '15'  },
  { label: '1H',  tv: '60'  },
  { label: '4H',  tv: '240' },
  { label: '1D',  tv: 'D'   },
  { label: '1W',  tv: 'W'   },
]

// ── Internal symbol → TradingView symbol ─────────────────────────────────────
const TV_SYMBOL_MAP = {
  // Forex
  EURUSD: 'FX:EURUSD',   GBPUSD: 'FX:GBPUSD',   USDJPY: 'FX:USDJPY',
  USDCHF: 'FX:USDCHF',   USDCAD: 'FX:USDCAD',   AUDUSD: 'FX:AUDUSD',
  NZDUSD: 'FX:NZDUSD',   EURGBP: 'FX:EURGBP',   EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  // Indices
  US30:   'TVC:DJI',        US100:  'NASDAQ:NDX',     SPX500: 'SP:SPX',
  GER40:  'XETR:DAX',       UK100:  'TVC:UKX',        FRA40:  'EURONEXT:CAC40',
  JPN225: 'TVC:NI225',      AUS200: 'ASX:XJO',        HK50:   'TVC:HSI',
  CHN50:  'SSE:000001',
  // Stocks
  AAPL:  'NASDAQ:AAPL',  MSFT:  'NASDAQ:MSFT',  GOOGL: 'NASDAQ:GOOGL',
  AMZN:  'NASDAQ:AMZN',  TSLA:  'NASDAQ:TSLA',  NVDA:  'NASDAQ:NVDA',
  META:  'NASDAQ:META',  JPM:   'NYSE:JPM',      NFLX:  'NASDAQ:NFLX',
  AMD:   'NASDAQ:AMD',
  // Crypto
  BTCUSD:  'BINANCE:BTCUSDT',  ETHUSD:  'BINANCE:ETHUSDT',  BNBUSD:  'BINANCE:BNBUSDT',
  SOLUSD:  'BINANCE:SOLUSDT',  XRPUSD:  'BINANCE:XRPUSDT',  ADAUSD:  'BINANCE:ADAUSDT',
  DOGEUSD: 'BINANCE:DOGEUSDT', AVAXUSD: 'BINANCE:AVAXUSDT', DOTUSD:  'BINANCE:DOTUSDT',
  LTCUSD:  'BINANCE:LTCUSDT',
  // Commodities
  XAUUSD: 'TVC:GOLD',     XAGUSD: 'TVC:SILVER',  USOIL:  'TVC:USOIL',
  XPTUSD: 'TVC:PLATINUM', NATGAS: 'TVC:NATURALGAS',
}

function toTVSymbol(symbol) {
  return TV_SYMBOL_MAP[String(symbol || '').toUpperCase()] || String(symbol || '').toUpperCase()
}

export default function InstrumentChart({ instrument, quote, onBuy, onSell }) {
  const [tfIdx, setTfIdx] = useState(3) // default 1H

  const pipSize = useMemo(
    () => getPipSize({ symbolId: instrument?.symbol, type: instrument?.type }),
    [instrument?.symbol, instrument?.type]
  )

  const bid          = quote?.bid
  const ask          = quote?.ask
  const quoteLoading = quote == null
  const spread       = (Number.isFinite(Number(bid)) && Number.isFinite(Number(ask)))
    ? formatPrice(Math.abs(Number(ask) - Number(bid)), pipSize)
    : null

  const tvSymbol   = toTVSymbol(instrument?.symbol)
  const tvInterval = TIMEFRAMES[tfIdx].tv

  const iframeSrc = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=${tvInterval}&theme=dark&style=1&locale=en&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&hide_top_toolbar=1&withdateranges=0`

  return (
    <div className="flex flex-col h-full bg-[#0e1117] select-none">

      {/* ── Header: Sell / Buy / Spread ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0 gap-2 min-w-0">

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

        {/* Instrument name */}
        <div className="text-right min-w-0 flex-shrink-0">
          <div className="text-white font-semibold text-sm truncate max-w-[120px] sm:max-w-none">
            {instrument?.name || instrument?.symbol || '—'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{instrument?.symbol}</div>
        </div>
      </div>

      {/* ── TradingView chart ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <iframe
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-0"
          allowTransparency="true"
          scrolling="no"
          allow="autoplay; encrypted-media"
        />

      </div>

      {/* ── Timeframe bar ── */}
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
      </div>
    </div>
  )
}
