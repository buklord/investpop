'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Users, TrendingUp, Copy, Pause, Play, XCircle, BarChart3, Activity, Menu, RefreshCw, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import AppSidebar from '@/components/AppSidebar'

export default function CopyTradingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast } = useToast()
  const [leaders, setLeaders] = useState([])
  const [following, setFollowing] = useState([])
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLeader, setSelectedLeader] = useState(null)
  const [copyRatio, setCopyRatio] = useState(1.0)
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
    setRefreshing(true)
    try {
      const [leadersRes, followingRes, statsRes, historyRes] = await Promise.all([
        fetch('/api/copy-trading/leaders'),
        fetch('/api/copy-trading/following'),
        fetch('/api/copy-trading/stats'),
        fetch('/api/copy-trading/history?limit=20')
      ])

      if (leadersRes.ok) {
        const data = await leadersRes.json()
        setLeaders(data.leaders || [])
      }
      
      if (followingRes.ok) {
        const data = await followingRes.json()
        setFollowing(data.following || [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.history || [])
      }
    } catch (err) {
      console.error('Failed to load copy trading data:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleFollow = async (leaderId, ratio = 1.0) => {
    try {
      const res = await fetch('/api/copy-trading/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId, copyRatio: ratio })
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Started copying leader',
        })
        await loadData()
        setSelectedLeader(null)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to follow leader',
          variant: 'destructive'
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to follow leader',
        variant: 'destructive'
      })
    }
  }

  const handleUnfollow = async (leaderId) => {
    try {
      const res = await fetch('/api/copy-trading/unfollow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId })
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Stopped copying leader',
        })
        await loadData()
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to unfollow leader',
        variant: 'destructive'
      })
    }
  }

  const handleStatusChange = async (leaderId, status) => {
    try {
      const res = await fetch('/api/copy-trading/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderId, status })
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: status === 'ACTIVE' ? 'Resumed copying' : 'Paused copying',
        })
        await loadData()
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      })
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0)
  }

  const formatDisplayName = (user) => {
    // If first name and/or last name are available, use them
    if (user.first_name || user.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ')
    }
    // For following tab, check leader-specific fields
    if (user.leader_first_name || user.leader_last_name) {
      return [user.leader_first_name, user.leader_last_name].filter(Boolean).join(' ')
    }
    // Fall back to username or email
    return user.username || user.leader_username || user.email?.split('@')[0] || user.leader_email?.split('@')[0] || 'Unknown'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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
        currentPage="/copy-trading"
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-[#161b22] border-b border-slate-800 p-4 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-white">Copy Trading</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={refreshing}
            className="text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Copy Trading</h1>
              <p className="text-slate-400">
                Automatically copy trades from expert traders
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={refreshing}
              className="hidden lg:flex"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leaders Following</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.asFollower?.leaders_following || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trades Copied</CardTitle>
              <Copy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.asFollower?.total_trades || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.asFollower?.total_volume || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(stats.asFollower?.total_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(stats.asFollower?.total_profit || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="leaders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaders">Available Leaders</TabsTrigger>
          <TabsTrigger value="following">My Following</TabsTrigger>
          <TabsTrigger value="history">Copy History</TabsTrigger>
        </TabsList>

        {/* Available Leaders Tab */}
        <TabsContent value="leaders" className="space-y-4">
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Expert Traders</CardTitle>
              <CardDescription>
                Browse and follow experienced traders
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No leaders available at the moment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaders.map((leader) => {
                    const isFollowing = following.some(f => f.leader_id === leader.id)
                    
                    return (
                      <Card key={leader.id} className="bg-slate-900/50 border-slate-700">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                  <Activity className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-white">{formatDisplayName(leader)}</h3>
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active Leader</Badge>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                  <p className="text-sm text-slate-400">Followers</p>
                                  <p className="text-lg font-semibold text-white">{leader.follower_count || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-slate-400">Total Volume</p>
                                  <p className="text-lg font-semibold text-white">{formatCurrency(leader.total_volume || 0)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="ml-4">
                              {isFollowing ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Following
                                </Badge>
                              ) : selectedLeader === leader.id ? (
                                <div className="space-y-3 w-48">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                      Copy Ratio: {copyRatio.toFixed(1)}x
                                    </label>
                                    <Slider
                                      min={0.1}
                                      max={2.0}
                                      step={0.1}
                                      value={[copyRatio]}
                                      onValueChange={(val) => setCopyRatio(val[0])}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      {copyRatio < 1 ? 'Conservative' : copyRatio === 1 ? 'Standard' : 'Aggressive'}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleFollow(leader.id, copyRatio)}
                                      className="flex-1"
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedLeader(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button onClick={() => setSelectedLeader(leader.id)}>
                                  Follow
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Following Tab */}
        <TabsContent value="following" className="space-y-4">
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Active Connections</CardTitle>
              <CardDescription>
                Manage your copy trading connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {following.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>You're not following any leaders yet</p>
                  <Button className="mt-4" onClick={() => document.querySelector('[value="leaders"]')?.click()}>
                    Browse Leaders
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {following.map((connection) => (
                    <Card key={connection.id} className="bg-slate-900/50 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Activity className="h-5 w-5 text-emerald-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-white">{formatDisplayName(connection)}</h3>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant={connection.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                    {connection.status}
                                  </Badge>
                                  <Badge variant="outline">{connection.copy_ratio}x Ratio</Badge>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <div>
                                <p className="text-sm text-slate-400">Trades Copied</p>
                                <p className="text-lg font-semibold text-white">{connection.total_trades_copied || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-400">Volume</p>
                                <p className="text-lg font-semibold text-white">{formatCurrency(connection.total_copied_volume || 0)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-400">Profit</p>
                                <p className={`text-lg font-semibold ${(connection.total_profit_from_copying || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {formatCurrency(connection.total_profit_from_copying || 0)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="ml-4 flex flex-col gap-2">
                            {connection.status === 'ACTIVE' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(connection.leader_id, 'PAUSED')}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(connection.leader_id, 'ACTIVE')}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUnfollow(connection.leader_id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Unfollow
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-[#161b22] border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Copy Trade History</CardTitle>
              <CardDescription>
                View all trades that were copied to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No copy trades yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-900/50"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant={trade.status === 'EXECUTED' ? 'default' : 'destructive'}>
                          {trade.status}
                        </Badge>
                        <div>
                          <p className="font-medium text-white">
                            {trade.original_trade_data?.symbol} - {trade.original_trade_data?.action}
                          </p>
                          <p className="text-sm text-slate-400">
                            From: {trade.leader_username || trade.leader_email.split('@')[0]}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">{formatCurrency(trade.copied_value)}</p>
                        <p className="text-sm text-slate-400">
                          Qty: {parseFloat(trade.copied_quantity).toFixed(4)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(trade.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>
  )
}
