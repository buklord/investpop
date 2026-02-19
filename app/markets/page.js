'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  Search,
  Star,
  StarOff,
  Menu,
  RefreshCw,
  Loader2
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'

export default function MarketsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const [assets, setAssets] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [quotes, setQuotes] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [quotesLoading, setQuotesLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

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
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      // Fire seed in background (don't block on it)
      fetch('/api/assets/seed', { method: 'POST' }).catch(() => {})
      
      const [assetsRes, watchlistRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/watchlist')
      ])
      
      const assetsData = await assetsRes.json()
      const watchlistData = await watchlistRes.json()
      
      setAssets(assetsData.assets || [])
      setWatchlist(watchlistData.watchlist || [])
      
      // Fetch quotes in parallel batches for speed
      fetchQuotesParallel(assetsData.assets || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  // Fetch quotes in parallel for much faster loading
  const fetchQuotesParallel = async (assetList) => {
    setQuotesLoading(true)
    const newQuotes = {}
    
    // Fetch all quotes in parallel
    const promises = assetList.map(async (asset) => {
      try {
        const res = await fetch(`/api/quote?symbol=${asset.symbol}&type=${asset.type}`)
        if (res.ok) {
          const data = await res.json()
          return { symbol: asset.symbol, data }
        }
      } catch (err) {
        console.error(`Failed to fetch quote for ${asset.symbol}:`, err)
      }
      return null
    })

    const results = await Promise.all(promises)
    results.forEach(result => {
      if (result) {
        newQuotes[result.symbol] = result.data
      }
    })
    
    setQuotes(newQuotes)
    setQuotesLoading(false)
  }

  const refreshQuotes = async () => {
    setRefreshing(true)
    await fetchQuotesParallel(assets)
    setRefreshing(false)
  }

  const toggleWatchlist = async (assetId, isWatched) => {
    try {
      if (isWatched) {
        const item = watchlist.find(w => w.asset_id === assetId)
        if (item) {
          await fetch(`/api/watchlist/${item.id}`, { method: 'DELETE' })
          setWatchlist(prev => prev.filter(w => w.id !== item.id))
        }
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId })
        })
        if (res.ok) {
          const data = await res.json()
          const asset = assets.find(a => a.id === assetId)
          setWatchlist(prev => [...prev, { id: data.id, asset_id: assetId, symbol: asset.symbol, name: asset.name, type: asset.type }])
        }
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err)
    }
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '—'
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)
    }
    return `$${value.toFixed(4)}`
  }

  const formatPercent = (value) => {
    if (!value && value !== 0) return '—'
    const prefix = value >= 0 ? '+' : ''
    return `${prefix}${value.toFixed(2)}%`
  }

  // Filter and sort assets with memoization for performance
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            asset.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTab = activeTab === 'all' || 
                         (activeTab === 'stocks' && asset.type === 'stock') ||
                         (activeTab === 'crypto' && asset.type === 'crypto') ||
                         (activeTab === 'watchlist' && watchlist.some(w => w.asset_id === asset.id))
      return matchesSearch && matchesTab
    })
  }, [assets, searchQuery, activeTab, watchlist])

  // Top movers with memoization
  const topMovers = useMemo(() => {
    return [...filteredAssets]
      .filter(a => quotes[a.symbol]?.changePercent !== undefined)
      .sort((a, b) => {
        const aChange = Math.abs(quotes[a.symbol]?.changePercent || 0)
        const bChange = Math.abs(quotes[b.symbol]?.changePercent || 0)
        return bChange - aChange
      })
      .slice(0, 5)
  }, [filteredAssets, quotes])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <AppSidebar
        currentPage="/markets"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Markets</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshQuotes}
            disabled={refreshing}
            className="text-slate-400 p-1"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Markets</h1>
              <p className="text-slate-400 text-sm">Browse and trade stocks & crypto</p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative flex-1 sm:w-64 lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-10"
                />
              </div>
              <Button
                variant="ghost"
                onClick={refreshQuotes}
                disabled={refreshing}
                className="hidden sm:flex text-slate-400 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Tabs - Scrollable on mobile */}
          <div className="mb-4 sm:mb-6 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-800 inline-flex min-w-max">
                <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600 text-sm px-4">All</TabsTrigger>
                <TabsTrigger value="stocks" className="data-[state=active]:bg-emerald-600 text-sm px-4">Stocks</TabsTrigger>
                <TabsTrigger value="crypto" className="data-[state=active]:bg-emerald-600 text-sm px-4">Crypto</TabsTrigger>
                <TabsTrigger value="watchlist" className="data-[state=active]:bg-emerald-600 text-sm px-4">
                  <Star className="h-3.5 w-3.5 mr-1" />
                  Watchlist
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Loading State */}
          {quotesLoading && Object.keys(quotes).length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mr-3" />
              <span className="text-slate-400">Loading market data...</span>
            </div>
          )}

          {/* Top Movers - Horizontal scroll on mobile */}
          {!quotesLoading && activeTab === 'all' && topMovers.length > 0 && (
            <Card className="bg-[#161b22] border-slate-800 mb-4 sm:mb-6">
              <CardHeader className="py-3 sm:py-4">
                <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Top Movers
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 sm:pb-4">
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                  {topMovers.map(asset => {
                    const quote = quotes[asset.symbol]
                    const isPositive = (quote?.changePercent || 0) >= 0
                    
                    return (
                      <Link
                        key={asset.id}
                        href={`/asset/${asset.symbol}?type=${asset.type}`}
                        className="flex-shrink-0 w-32 sm:w-40 p-3 sm:p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors snap-start"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                            asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {asset.type === 'crypto' ? '₿' : asset.symbol.charAt(0)}
                          </div>
                          <span className="font-medium text-white text-sm">{asset.symbol}</span>
                        </div>
                        <div className="text-base sm:text-lg font-bold text-white truncate">
                          {formatCurrency(quote?.price)}
                        </div>
                        <div className={`text-xs sm:text-sm flex items-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPercent(quote?.changePercent)}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assets List - Card view on mobile, table on desktop */}
          <Card className="bg-[#161b22] border-slate-800">
            <CardContent className="p-0">
              {/* Mobile Card View */}
              <div className="block sm:hidden divide-y divide-slate-800">
                {filteredAssets.map(asset => {
                  const quote = quotes[asset.symbol]
                  const isWatched = watchlist.some(w => w.asset_id === asset.id)
                  const isPositive = (quote?.changePercent || 0) >= 0
                  
                  return (
                    <div key={asset.id} className="p-3 flex items-center gap-3">
                      <Link href={`/asset/${asset.symbol}?type=${asset.type}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {asset.type === 'crypto' ? '₿' : asset.symbol.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white">{asset.symbol}</div>
                          <div className="text-xs text-slate-500 truncate">{asset.name}</div>
                        </div>
                      </Link>
                      <div className="text-right flex-shrink-0">
                        <div className="font-medium text-white text-sm">
                          {quotesLoading && !quote ? <Loader2 className="h-4 w-4 animate-spin inline" /> : formatCurrency(quote?.price)}
                        </div>
                        <div className={`text-xs flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPercent(quote?.changePercent)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); toggleWatchlist(asset.id, isWatched); }}
                          className={`p-1.5 ${isWatched ? 'text-yellow-500' : 'text-slate-500'}`}
                        >
                          {isWatched ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                        </Button>
                        <Link href={`/asset/${asset.symbol}?type=${asset.type}`}>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs">
                            Trade
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-500 text-sm border-b border-slate-800">
                      <th className="text-left p-4">Asset</th>
                      <th className="text-right p-4">Price</th>
                      <th className="text-right p-4">Change</th>
                      <th className="text-right p-4">Type</th>
                      <th className="text-center p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map(asset => {
                      const quote = quotes[asset.symbol]
                      const isWatched = watchlist.some(w => w.asset_id === asset.id)
                      const isPositive = (quote?.changePercent || 0) >= 0
                      
                      return (
                        <tr key={asset.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-4">
                            <Link href={`/asset/${asset.symbol}?type=${asset.type}`} className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                              }`}>
                                {asset.type === 'crypto' ? '₿' : asset.symbol.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-white">{asset.symbol}</div>
                                <div className="text-sm text-slate-500">{asset.name}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-4 text-right">
                            <div className="font-medium text-white">
                              {quotesLoading && !quote ? <Loader2 className="h-4 w-4 animate-spin inline" /> : formatCurrency(quote?.price)}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              {formatPercent(quote?.changePercent)}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs ${
                              asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {asset.type}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleWatchlist(asset.id, isWatched)}
                                className={isWatched ? 'text-yellow-500' : 'text-slate-500 hover:text-yellow-500'}
                              >
                                {isWatched ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                              </Button>
                              <Link href={`/asset/${asset.symbol}?type=${asset.type}`}>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                  Trade
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {filteredAssets.length === 0 && !quotesLoading && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No assets found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
