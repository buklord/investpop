'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Loader2, RefreshCw, BookOpen } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function JournalPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ symbol: '', setupTag: '', mood: '', note: '' })

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (user) loadEntries() }, [user])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/'); return }
      const data = await res.json()
      setUser(data.user)
    } catch (_) {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadEntries = async () => {
    try {
      const res = await fetch('/api/journal?limit=100')
      if (!res.ok) return
      const data = await res.json()
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (_) {}
  }

  const saveEntry = async () => {
    if (!form.note.trim() && !form.setupTag.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setForm({ symbol: '', setupTag: '', mood: '', note: '' })
        await loadEntries()
      }
    } catch (_) {}
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/journal" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 min-w-0">
        <div className="lg:hidden bg-card border-b border-border p-3 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-foreground text-sm">Journal</span>
          <Button variant="ghost" size="sm" onClick={loadEntries} className="text-muted-foreground p-1">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-400" /> Trade Journal
              </h1>
              <p className="text-muted-foreground text-sm">Capture setup, mindset, and lessons after each trade.</p>
            </div>
            <Button variant="ghost" onClick={loadEntries} className="hidden lg:inline-flex">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>

          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-base">New Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Input placeholder="Symbol (e.g. BTCUSD)" value={form.symbol} onChange={(e) => setForm(p => ({ ...p, symbol: e.target.value }))} />
                <Input placeholder="Setup tag (e.g. breakout)" value={form.setupTag} onChange={(e) => setForm(p => ({ ...p, setupTag: e.target.value }))} />
                <Input placeholder="Mood (e.g. calm)" value={form.mood} onChange={(e) => setForm(p => ({ ...p, mood: e.target.value }))} />
              </div>
              <textarea
                className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="What was your thesis, execution quality, and lesson?"
                value={form.note}
                onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
              />
              <div className="flex justify-end">
                <Button onClick={saveEntry} disabled={saving || (!form.note.trim() && !form.setupTag.trim())}>
                  {saving ? 'Saving…' : 'Save Entry'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No journal entries yet.</div>
              ) : (
                <div className="space-y-3">
                  {entries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-3 bg-muted/20">
                      <div className="flex flex-wrap gap-2 text-xs mb-1">
                        {e.symbol && <span className="px-2 py-0.5 rounded bg-muted">{e.symbol}</span>}
                        {e.setup_tag && <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{e.setup_tag}</span>}
                        {e.mood && <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">{e.mood}</span>}
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap">{e.note || 'No note'}</div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
