'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Loader2, ArrowLeft, BookUser, Plus, Trash2, Send, Download, Upload,
  User, Search, Pencil, Save, X
} from 'lucide-react'
import AppSidebar from '@/components/AppSidebar'
import TopNav from '@/components/TopNav'

export default function ContactsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newNote, setNewNote] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setUser(d.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vq_contacts')
      if (raw) setContacts(JSON.parse(raw))
      else {
        // Migrate from old savedRecipients format
        const oldRaw = localStorage.getItem('vq_savedRecipients')
        if (oldRaw) {
          const oldEmails = JSON.parse(oldRaw)
          const migrated = oldEmails.map((email, i) => ({ id: Date.now() + i, name: '', email, note: '' }))
          setContacts(migrated)
          localStorage.setItem('vq_contacts', JSON.stringify(migrated))
        }
      }
    } catch {}
  }, [])

  const saveContacts = (next) => {
    setContacts(next)
    localStorage.setItem('vq_contacts', JSON.stringify(next))
    // Also sync emails to vq_savedRecipients for send page compatibility
    const emails = next.map(c => c.email)
    localStorage.setItem('vq_savedRecipients', JSON.stringify([...new Set(emails)]))
  }

  const addContact = () => {
    if (!newEmail.includes('@')) return
    const next = [...contacts, { id: Date.now(), name: newName, email: newEmail, note: newNote }]
    saveContacts(next)
    setNewName(''); setNewEmail(''); setNewNote(''); setShowAdd(false)
  }

  const deleteContact = (id) => saveContacts(contacts.filter(c => c.id !== id))

  const startEdit = (c) => { setEditingId(c.id); setNewName(c.name); setNewEmail(c.email); setNewNote(c.note) }
  const saveEdit = () => {
    saveContacts(contacts.map(c => c.id === editingId ? { ...c, name: newName, email: newEmail, note: newNote } : c))
    setEditingId(null); setNewName(''); setNewEmail(''); setNewNote('')
  }

  const exportContacts = () => {
    const csv = ['Name,Email,Note', ...contacts.map(c => `"${c.name || ''}","${c.email}","${c.note || ''}"`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'vaultquokka-contacts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const importContacts = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].toLowerCase().split(',')
      const nameIdx = headers.indexOf('name')
      const emailIdx = headers.indexOf('email')
      const noteIdx = headers.indexOf('note')
      const imported = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, ''))
        const email = cols[emailIdx >= 0 ? emailIdx : 1]?.trim()
        if (email?.includes('@') && !contacts.some(c => c.email === email)) {
          imported.push({
            id: Date.now() + i,
            name: cols[nameIdx >= 0 ? nameIdx : 0]?.trim() || '',
            email,
            note: cols[noteIdx >= 0 ? noteIdx : 2]?.trim() || '',
          })
        }
      }
      if (imported.length) saveContacts([...contacts, ...imported])
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const filtered = contacts.filter(c =>
    `${c.name} ${c.email} ${c.note}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar currentPage="/wallet/send" user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav user={user} setSidebarOpen={setSidebarOpen} />

        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full">
          <button onClick={() => router.push('/wallet')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Wallet
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Address Book</h1>
              <p className="text-muted-foreground text-sm">Manage your saved contacts for quick transfers.</p>
            </div>
          </div>

          {/* Actions bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button onClick={() => setShowAdd(!showAdd)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Add Contact
            </Button>
            <Button variant="outline" onClick={exportContacts} disabled={!contacts.length} size="sm" className="border-border text-muted-foreground">
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" onChange={importContacts} className="hidden" />
              <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
                <Upload className="h-4 w-4 mr-1.5" /> Import
              </span>
            </label>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border text-foreground"
            />
          </div>

          {/* Add form */}
          {showAdd && (
            <Card className="bg-card border-border mb-4">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name (optional)" value={newName} onChange={e => setNewName(e.target.value)} />
                  <Input placeholder="Email *" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <Input placeholder="Note (optional)" value={newNote} onChange={e => setNewNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => setShowAdd(false)} variant="outline" size="sm" className="flex-1 border-border">Cancel</Button>
                  <Button onClick={addContact} size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">Save</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact list */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <BookUser className="h-4 w-4 text-emerald-400" /> Contacts ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {contacts.length === 0 ? 'No contacts yet. Add one or import from CSV.' : 'No matching contacts.'}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filtered.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-emerald-400" />
                      </div>
                      {editingId === c.id ? (
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input size="sm" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" />
                            <Input size="sm" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" />
                          </div>
                          <Input size="sm" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Note" />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                            <button onClick={saveEdit} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                              <Save className="h-3 w-3" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">{c.name || c.email}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                          {c.note && <div className="text-[10px] text-muted-foreground mt-0.5">{c.note}</div>}
                        </div>
                      )}
                      {editingId !== c.id && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => router.push(`/wallet/send?to=${encodeURIComponent(c.email)}`)}
                            className="p-1.5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Send"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => startEdit(c)}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteContact(c.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
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
