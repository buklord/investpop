'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Bot, BarChart3, PieChart, Wallet, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'

function StatCard({ label, value, sub, icon: Icon, accent, positive }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className={`w-4 h-4 ${accent || 'text-muted-foreground'}`} />}
        </div>
        <div className={`text-2xl font-bold ${positive === true ? 'text-green-500' : positive === false ? 'text-red-500' : ''}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export default function PortfolioPage() {
  const [positionData, setPositionData] = useState(null)
  const [botData, setBotData] = useState(null)
  const [accountData, setAccountData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [posRes, botRes, accRes] = await Promise.all([
        fetch('/api/positions?status=OPEN'),
        fetch('/api/bots/analytics'),
        fetch('/api/account'),
      ])
      const [pos, bots, acc] = await Promise.all([posRes.json(), botRes.json(), accRes.json()])
      if (posRes.ok) setPositionData(pos)
      if (botRes.ok) setBotData(bots)
      if (accRes.ok) setAccountData(acc)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const positions = positionData?.positions || []
  const openPnl = positions.reduce((s, p) => s + (Number(p.unrealized_pnl) || 0), 0)

  const botSubs = botData?.subscriptions?.filter(b => b.status === 'ACTIVE') || []
  const totalBotPnl = botData?.summary?.totalPnl || 0
  const totalBotAlloc = botData?.summary?.totalAllocated || 0

  const demoBalance = accountData?.virtual_account?.demo_balance || 0

  const totalPortfolioValue = demoBalance + openPnl + totalBotAlloc + totalBotPnl

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-10 w-48 bg-muted/40 animate-pulse rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-xl" />)}
          </div>
          <div className="h-64 bg-muted/40 animate-pulse rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <PieChart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Portfolio</h1>
            <p className="text-sm text-muted-foreground">Your complete investment overview</p>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Portfolio Value"
            value={`$${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={Wallet}
            accent="text-primary"
          />
          <StatCard
            label="Demo Balance"
            value={`$${demoBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={BarChart3}
          />
          <StatCard
            label="Open P&L"
            value={`${openPnl >= 0 ? '+' : ''}$${openPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={Activity}
            positive={openPnl > 0 ? true : openPnl < 0 ? false : undefined}
            sub={`${positions.length} open position${positions.length !== 1 ? 's' : ''}`}
          />
          <StatCard
            label="Bot Portfolio P&L"
            value={`${totalBotPnl >= 0 ? '+' : ''}$${totalBotPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={Bot}
            positive={totalBotPnl > 0 ? true : totalBotPnl < 0 ? false : undefined}
            sub={`${botSubs.length} active bot${botSubs.length !== 1 ? 's' : ''}`}
          />
        </div>

        <Tabs defaultValue="positions">
          <TabsList className="grid grid-cols-2 w-60">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="bots">AI Bots</TabsTrigger>
          </TabsList>

          {/* OPEN POSITIONS */}
          <TabsContent value="positions" className="mt-4 space-y-3">
            {positions.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No open positions</p>
                  <Link href="/trade">
                    <Button className="mt-4" variant="outline">Start Trading</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              positions.map(pos => {
                const pnl = Number(pos.unrealized_pnl) || 0
                const pnlPct = Number(pos.unrealized_pnl_pct) || 0
                return (
                  <Card key={pos.id} className="border-border/50">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-10 rounded-full ${pos.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{pos.symbol}</span>
                              <Badge variant="outline" className="text-xs">{pos.side}</Badge>
                              <Badge variant="secondary" className="text-xs">{pos.account_type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Number(pos.quantity)} @ ${Number(pos.entry_price).toFixed(5)} · ×{pos.leverage || 1}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                          <div className={`text-xs ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>

          {/* BOT PORTFOLIO */}
          <TabsContent value="bots" className="mt-4 space-y-3">
            {botSubs.length > 0 && totalBotAlloc > 0 && (
              <Card className="border-border/50">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Allocation Breakdown</span>
                    <span className="font-bold">${totalBotAlloc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="space-y-2">
                    {botSubs.map(bot => {
                      const pct = totalBotAlloc > 0 ? (bot.allocated_amount / totalBotAlloc) * 100 : 0
                      return (
                        <div key={bot.bot_id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{bot.bot_emoji} {bot.bot_name}</span>
                            <span>${bot.allocated_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pct.toFixed(0)}%)</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {botSubs.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-16 text-center">
                  <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">No active bots</p>
                  <Link href="/ai-bots">
                    <Button className="mt-4" variant="outline">Browse AI Bots</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              botSubs.map(bot => (
                <Card key={bot.bot_id} className="border-border/50">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{bot.bot_emoji}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{bot.bot_name}</span>
                            <Badge variant="outline" className={`text-xs ${bot.risk_level === 'HIGH' ? 'text-red-500 border-red-500/30' : bot.risk_level === 'LOW' ? 'text-green-500 border-green-500/30' : 'text-yellow-500 border-yellow-500/30'}`}>
                              {bot.risk_level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${bot.allocated_amount.toLocaleString()} allocated · {bot.days_active}d active
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${bot.cumulative_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {bot.cumulative_pnl >= 0 ? '+' : ''}${bot.cumulative_pnl.toFixed(2)}
                        </div>
                        <div className={`text-xs ${bot.pnl_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {bot.pnl_pct >= 0 ? '+' : ''}{bot.pnl_pct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/history"><Button variant="outline" size="sm">View Analytics</Button></Link>
          <Link href="/trade"><Button variant="outline" size="sm">Open Trade</Button></Link>
          <Link href="/ai-bots"><Button variant="outline" size="sm">AI Bots</Button></Link>
        </div>
      </div>
    </div>
  )
}

