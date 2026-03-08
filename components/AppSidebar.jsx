'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import {
  X,
  Home,
  Activity,
  Wallet,
  History,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronDown,
  MessageCircle,
  Briefcase,
  Sun,
  Moon,
  BookOpen,
  Trophy,
} from 'lucide-react'

// Opens the Tawk.to chat with retry (safe — no-ops if Tawk is not loaded)
function openTawk() {
  if (typeof window === 'undefined') return
  let attempts = 0
  const tryOpen = () => {
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.maximize()
    } else if (++attempts < 10) {
      setTimeout(tryOpen, 400)
    } else {
      console.warn('[Tawk] Widget not ready after 10 attempts')
    }
  }
  tryOpen()
}

const navGroups = [
  {
    id: 'trade',
    label: 'Trade',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: Home },
      { href: '/markets', label: 'Markets', icon: Activity },
      { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
      { href: '/history', label: 'Analytics', icon: History },
      { href: '/journal', label: 'Journal', icon: BookOpen },
      { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    id: 'funds',
    label: 'Funds',
    items: [{ href: '/wallet', label: 'Wallet', icon: Wallet }],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [{ href: '/settings', label: 'Preferences', icon: Settings }],
  },
]

export default function AppSidebar({ user, sidebarOpen, setSidebarOpen, account: accountProp }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState({ trade: true, funds: true, settings: false, help: false })
  const [pendingDeposits, setPendingDeposits] = useState(0)
  const [selfAccount, setSelfAccount] = useState(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    setThemeMounted(true)
  }, [])

  // If parent didn't pass account data (non-dashboard pages), fetch it ourselves
  useEffect(() => {
    if (accountProp != null) return  // parent already provided it — no need to fetch
    let cancelled = false
    const fetchAccount = async () => {
      setAccountLoading(true)
      try {
        const res = await fetch('/api/account', { cache: 'no-store' })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSelfAccount(data)
        }
      } catch (_) {}
      if (!cancelled) setAccountLoading(false)
    }
    fetchAccount()
    // Re-fetch whenever pathname changes (user navigated to a new page)
    return () => { cancelled = true }
  }, [pathname, accountProp])

  // Poll for pending deposit count (admins only)
  useEffect(() => {
    if (!isAdmin) return
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/admin/deposits/count')
        if (res.ok) {
          const data = await res.json()
          setPendingDeposits(data.count || 0)
        }
      } catch (_) {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [isAdmin, user?.role])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  // Use prop if provided (dashboard passes it), otherwise use self-fetched data
  const account = accountProp ?? selfAccount

  const tradingMode = accountLoading ? null : (account?.tradingMode ?? account?.trading_mode ?? null)
  const available   = account?.available ?? account?.balance ?? null
  const equity      = account != null
    ? (account.balance || 0) + (account.openPnl || 0)
    : null

  const fmt = (v) => v != null
    ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

  const email = user?.email || ''
  const displayName = email
    ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Account'

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const NavLink = ({ href, label, icon: Icon }) => (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-lg transition-colors ${
        isActive(href)
          ? 'bg-emerald-600/20 text-emerald-400'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      }`}
      onClick={() => setSidebarOpen(false)}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
  )

  const currentTheme = (resolvedTheme || theme) === 'light' ? 'light' : 'dark'
  const toggleTheme = () => setTheme(currentTheme === 'dark' ? 'light' : 'dark')

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-sidebar border-r border-sidebar-border transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-all duration-200 flex-shrink-0`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-lg leading-none">K</span>
              </div>
              {!collapsed && <span className="text-xl font-bold text-sidebar-foreground truncate">Kartomtrades</span>}
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground ml-auto">
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="hidden lg:block text-muted-foreground hover:text-foreground ml-2 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {!collapsed && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                    {(email || 'A').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sidebar-foreground font-semibold truncate">{displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">{email || '—'}</div>
                </div>
              </div>

              <div className="mt-3 bg-sidebar-accent/60 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mode</span>
                  {accountLoading || tradingMode === null ? (
                    <span className="text-muted-foreground text-xs italic">Loading…</span>
                  ) : (
                    <span className={`font-semibold px-1.5 py-0.5 rounded text-xs ${tradingMode === 'REAL' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>
                      {tradingMode === 'REAL' ? 'Real' : 'Demo'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Available</span>
                  <span className="text-sidebar-foreground font-mono">{fmt(available)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Equity</span>
                  <span className={`font-mono ${equity != null && equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(equity)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {collapsed ? (
            <div className="space-y-0.5">
              {navGroups.flatMap(g => g.items).map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
              <button
                onClick={openTawk}
                title="Live Support"
                className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
              </button>
              {isAdmin && (
                <Link
                  href="/admin"
                  title={user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                  className={`flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors relative ${
                    pathname.startsWith('/admin')
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
                >
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  {pendingDeposits > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {pendingDeposits > 9 ? '9+' : pendingDeposits}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {navGroups.map((group) => (
                <Collapsible
                  key={group.id}
                  open={!!openGroups[group.id]}
                  onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [group.id]: open }))}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground transition-colors">
                      <span>{group.label}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openGroups[group.id] ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink key={item.href} {...item} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              <Separator className="my-2 bg-sidebar-border" />

              <Collapsible
                open={!!openGroups.help}
                onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, help: open }))}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground transition-colors">
                    <span>Help</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.help ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5">
                  <button
                    onClick={openTawk}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Live Support</span>
                  </button>
                </CollapsibleContent>
              </Collapsible>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    pathname.startsWith('/admin')
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
                >
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>
                  {pendingDeposits > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {pendingDeposits > 9 ? '9+' : pendingDeposits}
                    </span>
                  )}
                </Link>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          {!collapsed && isAdmin && (
            <div className="text-xs text-amber-400 mb-2 px-1">● {user?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}</div>
          )}

          <Button
            variant="ghost"
            onClick={toggleTheme}
            title={collapsed ? (themeMounted ? `Theme: ${currentTheme === 'dark' ? 'Dark' : 'Light'}` : 'Toggle theme') : undefined}
            className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start'} text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent mb-1`}
          >
            {themeMounted && currentTheme === 'dark' ? (
              <Sun className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Moon className="h-4 w-4 flex-shrink-0" />
            )}
            {!collapsed && <span className="ml-2">Theme</span>}
          </Button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start'} text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </div>
    </div>
  )
}
