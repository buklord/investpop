'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Wallet, 
  LogOut, 
  Plus, 
  Trash2, 
  RefreshCw,
  Menu,
  X,
  Home,
  LineChart
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Data states
  const [assets, setAssets] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [quotes, setQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  
  // Modal states
  const [showAddWatchlist, setShowAddWatchlist] = useState(false)
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [positionQuantity, setPositionQuantity] = useState('')
  const [positionPrice, setPositionPrice] = useState('')
  const [positionDate, setPositionDate] = useState(new Date().toISOString().split('T')[0])

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
      // Seed assets if needed
      await fetch('/api/assets/seed', { method: 'POST' })
      
      const [assetsRes, watchlistRes, portfolioRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/watchlist'),
        fetch('/api/portfolio')
      ])
      
      const assetsData = await assetsRes.json()
      const watchlistData = await watchlistRes.json()
      const portfolioData = await portfolioRes.json()
      
      setAssets(assetsData.assets || [])
      setWatchlist(watchlistData.watchlist || [])
      setPortfolio(portfolioData.positions || [])
      
      // Fetch quotes for watchlist and portfolio
      const symbols = new Set()
      watchlistData.watchlist?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      portfolioData.positions?.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
      
      fetchQuotes(Array.from(symbols))
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  const fetchQuotes = async (symbolTypes) => {
    const newQuotes = {}
    for (const st of symbolTypes) {
      const [symbol, type] = st.split(':')
      try {
        const res = await fetch(`/api/quote?symbol=${symbol}&type=${type}`)
        if (res.ok) {
          const data = await res.json()
          newQuotes[symbol] = data
        }
      } catch (err) {
        console.error(`Failed to fetch quote for ${symbol}:`, err)
      }
    }
    setQuotes(prev => ({ ...prev, ...newQuotes }))
  }

  const refreshQuotes = async () => {
    setRefreshing(true)
    const symbols = new Set()
    watchlist.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
    portfolio.forEach(item => symbols.add(`${item.symbol}:${item.type}`))
    await fetchQuotes(Array.from(symbols))
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const addToWatchlist = async () => {
    if (!selectedAsset) return
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAsset })
      })
      if (res.ok) {
        setShowAddWatchlist(false)
        setSelectedAsset('')
        loadData()
      }
    } catch (err) {
      console.error('Failed to add to watchlist:', err)
    }
  }

  const removeFromWatchlist = async (id) => {
    try {
      await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
      setWatchlist(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      console.error('Failed to remove from watchlist:', err)
    }
  }

  const addPosition = async () => {
    if (!selectedAsset || !positionQuantity || !positionPrice) return
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset,
          quantity: parseFloat(positionQuantity),
          entryPrice: parseFloat(positionPrice),
          entryDate: positionDate
        })
      })
      if (res.ok) {
        setShowAddPosition(false)
        setSelectedAsset('')
        setPositionQuantity('')
        setPositionPrice('')
        setPositionDate(new Date().toISOString().split('T')[0])
        loadData()
      }
    } catch (err) {
      console.error('Failed to add position:', err)
    }
  }

  const deletePosition = async (id) => {
    try {
      await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
      setPortfolio(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      console.error('Failed to delete position:', err)
    }
  }

  const calculatePnL = (position) => {
    const quote = quotes[position.symbol]
    if (!quote) return { value: 0, percent: 0 }
    const currentValue = quote.price * position.quantity
    const costBasis = position.entry_price * position.quantity
    const pnl = currentValue - costBasis
    const pnlPercent = ((currentValue / costBasis) - 1) * 100
    return { value: pnl, percent: pnlPercent, currentValue }
  }

  const totalPortfolioValue = portfolio.reduce((sum, pos) => {
    const quote = quotes[pos.symbol]
    return sum + (quote ? quote.price * pos.quantity : pos.entry_price * pos.quantity)
  }, 0)

  const totalPnL = portfolio.reduce((sum, pos) => {
    const pnl = calculatePnL(pos)
    return sum + pnl.value
  }, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    )
  }

  const Sidebar = () => (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-white">InvestDash</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Home className="h-5 w-5" />
            Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('watchlist'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'watchlist' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="h-5 w-5" />
            Watchlist
          </button>
          <button
            onClick={() => { setActiveTab('portfolio'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'portfolio' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Wallet className="h-5 w-5" />
            Portfolio
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-700">
          <div className="text-sm text-slate-400 mb-2">{user?.email}</div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )

  const DashboardContent = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Portfolio Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Total P&L</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold flex items-center gap-2 ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              ${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Watching</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              <Eye className="h-6 w-6 text-blue-500" />
              {watchlist.length} assets
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Watchlist */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Watchlist</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshQuotes}
              disabled={refreshing}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No assets in watchlist. Add some to get started!</p>
          ) : (
            <div className="space-y-2">
              {watchlist.slice(0, 5).map(item => {
                const quote = quotes[item.symbol]
                return (
                  <Link 
                    key={item.id} 
                    href={`/asset/${item.symbol}?type=${item.type}`}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-white">{item.symbol}</div>
                      <div className="text-sm text-slate-400">{item.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">
                        ${quote?.price?.toFixed(2) || '—'}
                      </div>
                      <div className={`text-sm ${(quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {(quote?.changePercent || 0) >= 0 ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}%
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Portfolio */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No positions yet. Add your first investment!</p>
          ) : (
            <div className="space-y-2">
              {portfolio.slice(0, 5).map(pos => {
                const pnl = calculatePnL(pos)
                return (
                  <div key={pos.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{pos.symbol}</div>
                      <div className="text-sm text-slate-400">{pos.quantity} units @ ${pos.entry_price}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${pnl.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pnl.value >= 0 ? '+' : ''}${pnl.value.toFixed(2)}
                      </div>
                      <div className={`text-sm ${pnl.percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pnl.percent >= 0 ? '+' : ''}{pnl.percent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const WatchlistContent = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Watchlist</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshQuotes}
            disabled={refreshing}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={showAddWatchlist} onOpenChange={setShowAddWatchlist}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add to Watchlist</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Select an asset to add to your watchlist
                </DialogDescription>
              </DialogHeader>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {assets
                    .filter(a => !watchlist.some(w => w.asset_id === a.id))
                    .map(asset => (
                      <SelectItem key={asset.id} value={asset.id} className="text-white hover:bg-slate-600">
                        {asset.symbol} - {asset.name} ({asset.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button onClick={addToWatchlist} className="bg-emerald-600 hover:bg-emerald-700">
                  Add to Watchlist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center">
            <Eye className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Your watchlist is empty. Add some assets to start tracking!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {watchlist.map(item => {
            const quote = quotes[item.symbol]
            return (
              <Card key={item.id} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/asset/${item.symbol}?type=${item.type}`} className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          item.type === 'crypto' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {item.type === 'crypto' ? '₿' : <LineChart className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-lg">{item.symbol}</div>
                          <div className="text-sm text-slate-400">{item.name}</div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-semibold text-white text-xl">
                          ${quote?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '—'}
                        </div>
                        <div className={`text-sm flex items-center justify-end gap-1 ${
                          (quote?.changePercent || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {(quote?.changePercent || 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {(quote?.changePercent || 0) >= 0 ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}%
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromWatchlist(item.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  const PortfolioContent = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Portfolio</h2>
        <Dialog open={showAddPosition} onOpenChange={setShowAddPosition}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Add Position</DialogTitle>
              <DialogDescription className="text-slate-400">
                Enter your position details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300">Asset</label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {assets.map(asset => (
                      <SelectItem key={asset.id} value={asset.id} className="text-white hover:bg-slate-600">
                        {asset.symbol} - {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-300">Quantity</label>
                <Input
                  type="number"
                  step="any"
                  value={positionQuantity}
                  onChange={(e) => setPositionQuantity(e.target.value)}
                  placeholder="e.g., 10"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Entry Price ($)</label>
                <Input
                  type="number"
                  step="any"
                  value={positionPrice}
                  onChange={(e) => setPositionPrice(e.target.value)}
                  placeholder="e.g., 150.00"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Entry Date</label>
                <Input
                  type="date"
                  value={positionDate}
                  onChange={(e) => setPositionDate(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addPosition} className="bg-emerald-600 hover:bg-emerald-700">
                Add Position
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Total Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Unrealized P&L</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold flex items-center gap-2 ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positions List */}
      {portfolio.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No positions yet. Add your first investment to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {portfolio.map(pos => {
            const pnl = calculatePnL(pos)
            const quote = quotes[pos.symbol]
            return (
              <Card key={pos.id} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        pos.type === 'crypto' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {pos.type === 'crypto' ? '₿' : <LineChart className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-lg">{pos.symbol}</div>
                        <div className="text-sm text-slate-400">{pos.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {pos.quantity} units @ ${pos.entry_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Current Value</div>
                        <div className="font-semibold text-white">
                          ${(pnl.currentValue || pos.entry_price * pos.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">P&L</div>
                        <div className={`font-semibold ${pnl.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pnl.value >= 0 ? '+' : ''}${pnl.value.toFixed(2)}
                        </div>
                        <div className={`text-sm ${pnl.percent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ({pnl.percent >= 0 ? '+' : ''}{pnl.percent.toFixed(2)}%)
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePosition(pos.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 lg:ml-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-500" />
            <span className="font-bold text-white">InvestDash</span>
          </div>
          <div className="w-6" />
        </div>
        
        {/* Page content */}
        <div className="p-4 lg:p-8">
          {activeTab === 'dashboard' && <DashboardContent />}
          {activeTab === 'watchlist' && <WatchlistContent />}
          {activeTab === 'portfolio' && <PortfolioContent />}
        </div>
      </div>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
