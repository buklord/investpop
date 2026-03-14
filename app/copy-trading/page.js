'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Users, TrendingUp, Copy, Pause, Play, XCircle, BarChart3, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function CopyTradingPage() {
  const { toast } = useToast()
  const [leaders, setLeaders] = useState([])
  const [following, setFollowing] = useState([])
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLeader, setSelectedLeader] = useState(null)
  const [copyRatio, setCopyRatio] = useState(1.0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
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
      setLoading(false)
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
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Copy Trading</h1>
          <p className="text-muted-foreground">
            Automatically copy trades from expert traders
          </p>
        </div>
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
          <Card>
            <CardHeader>
              <CardTitle>Expert Traders</CardTitle>
              <CardDescription>
                Browse and follow expert traders (Admins and Super Admins)
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
                      <Card key={leader.id} className="bg-muted/50">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Activity className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{leader.email}</h3>
                                  <Badge variant="secondary">{leader.role}</Badge>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mt-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Followers</p>
                                  <p className="text-lg font-semibold">{leader.follower_count || 0}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Total Volume</p>
                                  <p className="text-lg font-semibold">{formatCurrency(leader.total_volume || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Rating</p>
                                  <p className="text-lg font-semibold">{(leader.rating || 0).toFixed(1)} ⭐</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
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
                    <Card key={connection.id} className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Activity className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{connection.leader_email}</h3>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant={connection.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                    {connection.status}
                                  </Badge>
                                  <Badge variant="outline">{connection.copy_ratio}x Ratio</Badge>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mt-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Trades Copied</p>
                                <p className="text-lg font-semibold">{connection.total_trades_copied || 0}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Volume</p>
                                <p className="text-lg font-semibold">{formatCurrency(connection.total_copied_volume || 0)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Profit</p>
                                <p className={`text-lg font-semibold ${(connection.total_profit_from_copying || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {formatCurrency(connection.total_profit_from_copying || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Last Copy</p>
                                <p className="text-sm">
                                  {connection.last_copy_at ? formatDate(connection.last_copy_at) : 'Never'}
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
          <Card>
            <CardHeader>
              <CardTitle>Copy Trade History</CardTitle>
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
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant={trade.status === 'EXECUTED' ? 'default' : 'destructive'}>
                          {trade.status}
                        </Badge>
                        <div>
                          <p className="font-medium">
                            {trade.original_trade_data?.symbol} - {trade.original_trade_data?.action}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            From: {trade.leader_email}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(trade.copied_value)}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {parseFloat(trade.copied_quantity).toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(trade.created_at)}</p>
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
  )
}
