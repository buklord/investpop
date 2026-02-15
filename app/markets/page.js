'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Search,
  Star,
  StarOff,
  Menu,
  X,
  Home,
  Activity,
  PieChart,
  LogOut,
  RefreshCw
} from 'lucide-react'

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
      await fetch('/api/assets/seed', { method: 'POST' })
      
      const [assetsRes, watchlistRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/watchlist')
      ])
      
      const assetsData = await assetsRes.json()
      const watchlistData = await watchlistRes.json()
      
      setAssets(assetsData.assets || [])
      setWatchlist(watchlistData.watchlist || [])
      
      // Fetch quotes for all assets
      fetchQuotesForAssets(assetsData.assets || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  const fetchQuotesForAssets = async (assetList) => {
    const newQuotes = {}
    for (const asset of assetList) {
      try {
        const res = await fetch(`/api/quote?symbol=${asset.symbol}&type=${asset.type}`)
        if (res.ok) {
          const data = await res.json()
          newQuotes[asset.symbol] = data
        }
      } catch (err) {
        console.error(`Failed to fetch quote for ${asset.symbol}:`, err)
      }
    }
    setQuotes(newQuotes)
  }

  const refreshQuotes = async () => {
    setRefreshing(true)
    await fetchQuotesForAssets(assets)
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const formatCurrency = (value) => {
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(value)
    }
    return `$${value.toFixed(6)}`
  }

  const formatPercent = (value) => {
    const prefix = value >= 0 ? '+' : ''
    return `${prefix}${value.toFixed(2)}%`
  }

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'stocks' && asset.type === 'stock') ||
                       (activeTab === 'crypto' && asset.type === 'crypto') ||
                       (activeTab === 'watchlist' && watchlist.some(w => w.asset_id === asset.id))
    return matchesSearch && matchesTab
  })

  // Sort by change percent for top movers
  const topMovers = [...filteredAssets].sort((a, b) => {
    const aChange = Math.abs(quotes[a.symbol]?.changePercent || 0)
    const bChange = Math.abs(quotes[b.symbol]?.changePercent || 0)
    return bChange - aChange
  }).slice(0, 5)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  const Sidebar = () => (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">PaperTrade</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 px-2 py-1 bg-emerald-500/10 rounded text-emerald-400 text-xs text-center">
            Paper Trading (Simulation)
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/markets"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-600/20 text-emerald-400"
          >
            <Activity className="h-5 w-5" />
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <PieChart className="h-5 w-5" />
            Portfolio
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="text-sm text-slate-400 mb-2 truncate">{user?.email}</div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <Sidebar />
      
      <div className="flex-1">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Markets</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshQuotes}
            disabled={refreshing}
            className="text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Markets</h1>
              <p className="text-slate-400">Browse and trade stocks & crypto</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1 lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                variant="ghost"
                onClick={refreshQuotes}
                disabled={refreshing}
                className="hidden lg:flex text-slate-400 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="bg-slate-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600">All</TabsTrigger>
              <TabsTrigger value="stocks" className="data-[state=active]:bg-emerald-600">Stocks</TabsTrigger>
              <TabsTrigger value="crypto" className="data-[state=active]:bg-emerald-600">Crypto</TabsTrigger>
              <TabsTrigger value="watchlist" className="data-[state=active]:bg-emerald-600">
                <Star className="h-4 w-4 mr-1" />
                Watchlist
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Top Movers */}
          {activeTab === 'all' && topMovers.length > 0 && (
            <Card className="bg-[#161b22] border-slate-800 mb-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Top Movers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {topMovers.map(asset => {
                    const quote = quotes[asset.symbol]
                    const isPositive = (quote?.changePercent || 0) >= 0
                    
                    return (
                      <Link
                        key={asset.id}
                        href={`/asset/${asset.symbol}?type=${asset.type}`}
                        className="flex-shrink-0 w-40 p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            asset.type === 'crypto' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {asset.type === 'crypto' ? '₿' : asset.symbol.charAt(0)}
                          </div>
                          <span className="font-medium text-white">{asset.symbol}</span>
                        </div>
                        <div className="text-lg font-bold text-white">
                          {quote ? formatCurrency(quote.price) : '—'}
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPercent(quote?.changePercent || 0)}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assets Table */}
          <Card className="bg-[#161b22] border-slate-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                              {quote ? formatCurrency(quote.price) : '—'}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                              {formatPercent(quote?.changePercent || 0)}
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
                
                {filteredAssets.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No assets found</p>
                  </div>
                )}
              </div>
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
