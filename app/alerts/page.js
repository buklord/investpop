'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Trash2, Plus, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Menu, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import AppSidebar from '@/components/AppSidebar'

export default function AlertsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
  }, [router])

  const [form, setForm] = useState({
    symbol: '',
    alert_type: 'PRICE_ABOVE',
    threshold: '',
    note: '',
  })

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts')
      const data = await res.json()
      if (res.ok) setAlerts(data.alerts || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadAlerts()
    const iv = setInterval(loadAlerts, 30000)
    return () => clearInterval(iv)
  }, [loadAlerts])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.symbol || !form.threshold) return
    setCreating(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, threshold: parseFloat(form.threshold) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'Alert created', description: `Watching ${form.symbol} — threshold ${parseFloat(form.threshold).toLocaleString()}` })
      setForm({ symbol: '', alert_type: 'PRICE_ABOVE', threshold: '', note: '' })
      setOpen(false)
      loadAlerts()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setCreating(false) }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast({ title: 'Alert removed' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setDeletingId(null) }
  }

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE')
  const triggeredAlerts = alerts.filter(a => a.status === 'TRIGGERED')

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/alerts" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-foreground text-sm">Price Alerts</span>
          <Button variant="ghost" size="sm" onClick={loadAlerts} className="text-muted-foreground p-1">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Price Alerts</h1>
              <p className="text-sm text-muted-foreground">Get notified when assets hit your targets</p>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create Price Alert</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Symbol</Label>
                  <Input
                    placeholder="e.g. AAPL, BTC"
                    value={form.symbol}
                    onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select value={form.alert_type} onValueChange={v => setForm(f => ({ ...f, alert_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICE_ABOVE">Price rises above</SelectItem>
                      <SelectItem value="PRICE_BELOW">Price falls below</SelectItem>
                      <SelectItem value="PERCENT_CHANGE_UP">% change up ≥</SelectItem>
                      <SelectItem value="PERCENT_CHANGE_DOWN">% change down ≥</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder={form.alert_type.includes('PERCENT') ? 'e.g. 5' : 'e.g. 180.00'}
                    value={form.threshold}
                    onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Note <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    placeholder="Reminder for yourself..."
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Alert'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Alerts', value: alerts.length, icon: Bell },
            { label: 'Active', value: activeAlerts.length, icon: BellRing, accent: 'text-blue-500' },
            { label: 'Triggered', value: triggeredAlerts.length, icon: CheckCircle2, accent: 'text-green-500' },
            { label: 'Cancelled', value: alerts.filter(a => a.status === 'CANCELLED').length, icon: AlertCircle, accent: 'text-muted-foreground' },
          ].map(({ label, value, icon: Icon, accent }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Icon className={`w-4 h-4 ${accent || 'text-muted-foreground'}`} />
                </div>
                <div className="text-2xl font-bold mt-1">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No alerts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first price alert above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => {
              const isAbove = alert.alert_type === 'PRICE_ABOVE' || alert.alert_type === 'PERCENT_CHANGE_UP'
              const isTriggered = alert.status === 'TRIGGERED'
              const isCancelled = alert.status === 'CANCELLED'
              return (
                <Card key={alert.id} className={`border-border/50 transition-all ${isTriggered ? 'ring-1 ring-green-500/30 bg-green-500/5' : ''} ${isCancelled ? 'opacity-50' : ''}`}>
                  <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isAbove ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {isAbove
                          ? <TrendingUp className="w-4 h-4 text-green-500" />
                          : <TrendingDown className="w-4 h-4 text-red-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{alert.symbol}</span>
                          <Badge variant={isTriggered ? 'default' : isCancelled ? 'outline' : 'secondary'} className="text-xs">
                            {alert.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {alert.alert_type.replace(/_/g, ' ')} {Number(alert.threshold).toLocaleString(undefined, { maximumFractionDigits: 5 })}
                          {alert.alert_type.includes('PERCENT') ? '%' : ''}
                          {alert.note ? ` — ${alert.note}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isTriggered && alert.triggered_at
                            ? `Triggered ${new Date(alert.triggered_at).toLocaleString()}`
                            : `Created ${new Date(alert.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    {!isCancelled && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  )
}
