'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Loader2, RefreshCw, BookOpen, Sparkles, TrendingUp, Brain, Target, Filter } from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ── Client-side AI pattern analysis ──────────────────────────────────────────
function buildWeeklySummary(entries) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const week = entries.filter(e => new Date(e.created_at).getTime() >= cutoff)
  if (week.length === 0) return null

  // Top setups
  const setupCounts = {}
  week.forEach(e => { if (e.setup_tag) setupCounts[e.setup_tag] = (setupCounts[e.setup_tag] || 0) + 1 })
  const topSetups = Object.entries(setupCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Mood analysis
  const moodCounts = {}
  week.forEach(e => { if (e.mood) moodCounts[e.mood.toLowerCase()] = (moodCounts[e.mood.toLowerCase()] || 0) + 1 })
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Symbols
  const symbolCounts = {}
  week.forEach(e => { if (e.symbol) symbolCounts[e.symbol] = (symbolCounts[e.symbol] || 0) + 1 })
  const topSymbols = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

  // Streak
  const days = new Set(week.map(e => new Date(e.created_at).toDateString()))
  const streak = days.size

  // Mood -> insight
  const moodInsight = {
    calm: 'Your trading mindset was calm and measured this week — a great foundation for disciplined execution.',
    fearful: 'Some fearful sessions detected. Consider reducing size when confidence is low.',
    greedy: 'Watch for overtrading signals. Greed can widen stop-losses or push you into low-conviction trades.',
    anxious: 'Multiple anxious sessions. Pre-session routines and smaller positions may help.',
    confident: 'Confidence was high this week. Make sure this doesn\'t bleed into overtrading.',
    excited: 'High excitement — channel it into preparation, not impulsive entries.',
  }
  const moodMsg = (dominantMood && moodInsight[dominantMood]) || 'Journaling consistently helps reinforce good habits.'

  // Setup insight
  const setupMsg = topSetups.length > 0
    ? `Your most journaled setup was "${topSetups[0][0]}" (${topSetups[0][1]}x this week). ${topSetups.length > 1 ? `You also worked "${topSetups[1][0]}".` : ''}`
    : 'No recurring setup tags found. Tagging setups consistently helps you spot which patterns work best.'

  return { entries: week.length, streak, topSetups, topSymbols, dominantMood, moodMsg, setupMsg }
}

export default function JournalPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ symbol: '', setupTag: '', mood: '', note: '' })
  const [filterTag, setFilterTag] = useState('')
  const [filterSymbol, setFilterSymbol] = useState('')

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
      const res = await fetch('/api/journal?limit=200')
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

  const summary = useMemo(() => buildWeeklySummary(entries), [entries])

  const allTags = useMemo(() => [...new Set(entries.map(e => e.setup_tag).filter(Boolean))], [entries])
  const allSymbols = useMemo(() => [...new Set(entries.map(e => e.symbol).filter(Boolean))], [entries])

  const filtered = useMemo(() => entries.filter(e => {
    if (filterTag && e.setup_tag !== filterTag) return false
    if (filterSymbol && e.symbol !== filterSymbol) return false
    return true
  }), [entries, filterTag, filterSymbol])

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

          {/* ── AI Weekly Summary ──────────────────────────── */}
          {summary && (
            <Card className="bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/20 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  AI Weekly Summary
                  <Badge variant="secondary" className="text-xs ml-auto">{summary.entries} entries this week</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-muted/40 px-4 py-3 flex items-center gap-3">
                    <Target className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Active Days</div>
                      <div className="font-bold text-lg">{summary.streak}/7</div>
                    </div>
                  </div>
                  {summary.dominantMood && (
                    <div className="rounded-xl bg-muted/40 px-4 py-3 flex items-center gap-3">
                      <Brain className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Dominant Mood</div>
                        <div className="font-bold text-lg capitalize">{summary.dominantMood}</div>
                      </div>
                    </div>
                  )}
                  {summary.topSymbols.length > 0 && (
                    <div className="rounded-xl bg-muted/40 px-4 py-3 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Top Symbols</div>
                        <div className="font-bold text-sm">{summary.topSymbols.join(', ')}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-foreground leading-relaxed">
                    <span className="font-medium text-emerald-400">Setup Pattern: </span>
                    {summary.setupMsg}
                  </p>
                  <p className="text-foreground leading-relaxed">
                    <span className="font-medium text-blue-400">Mindset: </span>
                    {summary.moodMsg}
                  </p>
                  {summary.topSetups.length > 1 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {summary.topSetups.map(([tag, count]) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-400">
                          {tag} ×{count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── New Entry ───────────────────────────────────── */}
          <Card className="bg-card border-border mb-6">
            <CardHeader>
              <CardTitle className="text-base">New Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Symbol (e.g. BTCUSD)"
                  value={form.symbol}
                  list="symbol-suggestions"
                  onChange={(e) => setForm(p => ({ ...p, symbol: e.target.value }))}
                />
                <datalist id="symbol-suggestions">
                  {allSymbols.map(s => <option key={s} value={s} />)}
                </datalist>
                <Input
                  placeholder="Setup tag (e.g. breakout)"
                  value={form.setupTag}
                  list="tag-suggestions"
                  onChange={(e) => setForm(p => ({ ...p, setupTag: e.target.value }))}
                />
                <datalist id="tag-suggestions">
                  {allTags.map(t => <option key={t} value={t} />)}
                </datalist>
                <Input
                  placeholder="Mood (e.g. calm)"
                  value={form.mood}
                  list="mood-suggestions"
                  onChange={(e) => setForm(p => ({ ...p, mood: e.target.value }))}
                />
                <datalist id="mood-suggestions">
                  {['calm', 'confident', 'anxious', 'fearful', 'greedy', 'excited', 'frustrated', 'neutral'].map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <textarea
                className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
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

          {/* ── Filters + Entry List ──────────────────────── */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Entries <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span>
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <select
                    className="text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                  >
                    <option value="">All setups</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    className="text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                    value={filterSymbol}
                    onChange={e => setFilterSymbol(e.target.value)}
                  >
                    <option value="">All symbols</option>
                    {allSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {(filterTag || filterSymbol) && (
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => { setFilterTag(''); setFilterSymbol('') }}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  {entries.length === 0 ? 'No journal entries yet.' : 'No entries match the current filter.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-wrap gap-2 text-xs mb-1">
                        {e.symbol && <span className="px-2 py-0.5 rounded bg-muted font-mono">{e.symbol}</span>}
                        {e.setup_tag && <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{e.setup_tag}</span>}
                        {e.mood && <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 capitalize">{e.mood}</span>}
                        <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{e.note || 'No note'}</div>
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

