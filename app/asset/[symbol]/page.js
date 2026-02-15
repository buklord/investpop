'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react'
import Script from 'next/script'

export default function AssetPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const symbol = params.symbol
  const type = searchParams.get('type') || 'stock'
  
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && symbol) {
      fetchQuote()
    }
  }, [user, symbol])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        router.push('/')
        return
      }
      const data = await res.json()
      setUser(data.user)
    } catch (err) {
      router.push('/')
    }
  }

  const fetchQuote = async () => {
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setQuote(data)
      }
    } catch (err) {
      console.error('Failed to fetch quote:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshQuote = async () => {
    setRefreshing(true)
    await fetchQuote()
    setRefreshing(false)
  }

  // Get TradingView symbol format
  const getTradingViewSymbol = () => {
    if (type === 'crypto') {
      // Convert BTCUSD to BINANCE:BTCUSDT or similar
      const base = symbol.replace(/USD$/, '')
      return `BINANCE:${base}USDT`
    }
    return `NASDAQ:${symbol}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-emerald-500" />
                <span className="font-bold text-white">InvestDash</span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={refreshQuote}
              disabled={refreshing}
              className="text-slate-300 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Asset Info */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
              type === 'crypto' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
            }`}>
              {type === 'crypto' ? '₿' : symbol.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{symbol}</h1>
              <p className="text-slate-400">{quote?.name || symbol}</p>
              <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                type === 'crypto' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
              }`}>
                {type === 'crypto' ? 'Cryptocurrency' : 'Stock'}
              </span>
            </div>
          </div>
        </div>

        {/* Quote Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-400 text-sm font-normal">Current Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">
                ${quote?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '—'}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-400 text-sm font-normal">Daily Change</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold flex items-center gap-2 ${
                (quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {(quote?.changePercent || 0) >= 0 ? 
                  <TrendingUp className="h-8 w-8" /> : 
                  <TrendingDown className="h-8 w-8" />
                }
                {(quote?.changePercent || 0) >= 0 ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}%
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-400 text-sm font-normal">Last Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl text-white">
                {quote?.timestamp ? new Date(quote.timestamp).toLocaleString() : '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TradingView Chart */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tradingview-widget-container" style={{ height: '500px' }}>
              <div id="tradingview-widget" style={{ height: '100%' }} />
              <Script
                src="https://s3.tradingview.com/tv.js"
                strategy="afterInteractive"
                onLoad={() => {
                  if (typeof window !== 'undefined' && window.TradingView) {
                    new window.TradingView.widget({
                      width: '100%',
                      height: 500,
                      symbol: getTradingViewSymbol(),
                      interval: 'D',
                      timezone: 'Etc/UTC',
                      theme: 'dark',
                      style: '1',
                      locale: 'en',
                      toolbar_bg: '#1e293b',
                      enable_publishing: false,
                      hide_side_toolbar: false,
                      allow_symbol_change: true,
                      container_id: 'tradingview-widget',
                      backgroundColor: '#1e293b',
                      gridColor: '#334155'
                    })
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
