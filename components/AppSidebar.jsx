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
  ArrowDownUp,
  Send,
  ArrowDownToLine,
  Sun,
  Moon,
  BookOpen,
  Trophy,
  Users,
  Bot,
  Bell,
  Gift,
  CreditCard,
  ArrowUpFromLine,
  Sparkles,
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

// Binance-style hybrid IA: Wallet is the front door, Trade keeps the existing
// trading platform, Rewards + Account round it out.
const navGroups = [
  {
    id: 'wallet',
    label: 'Wallet',
    icon: Wallet,
    items: [
      { href: '/wallet',          label: 'Overview', icon: Wallet           },
      { href: '/wallet/deposit',  label: 'Deposit',  icon: CreditCard       },
      { href: '/wallet/withdraw', label: 'Withdraw', icon: ArrowUpFromLine  },
      { href: '/wallet/convert',  label: 'Convert',  icon: ArrowDownUp      },
      { href: '/wallet/send',     label: 'Send',     icon: Send             },
      { href: '/wallet/receive',  label: 'Receive',  icon: ArrowDownToLine  },
      { href: '/wallet/history',  label: 'History',  icon: History          },
    ],
  },
  {
    id: 'trade',
    label: 'Trade',
    icon: Activity,
    items: [
      { href: '/dashboard',    label: 'Dashboard',    icon: Home     },
      { href: '/markets',      label: 'Markets',      icon: Activity },
      { href: '/bots',         label: 'AI Bots',      icon: Bot      },
      { href: '/copy-trading', label: 'Copy Trading', icon: Users    },
      { href: '/history',      label: 'Analytics',    icon: History  },
      { href: '/journal',      label: 'Journal',      icon: BookOpen },
    ],
  },
  {
    id: 'earn',
    label: 'Earn',
    icon: Sparkles,
    items: [
      { href: '/wallet',      label: 'Simple Earn', icon: Sparkles, soon: true },
    ],
  },
  {
    id: 'rewards',
    label: 'Rewards',
    icon: Gift,
    items: [
      { href: '/leaderboard',  label: 'Leaderboard',  icon: Trophy   },
      { href: '/referral',     label: 'Referral',     icon: Gift     },
      { href: '/alerts',       label: 'Alerts',       icon: Bell     },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: Settings,
    items: [{ href: '/settings', label: 'Preferences', icon: Settings }],
  },
]

export default function AppSidebar({ user, sidebarOpen, setSidebarOpen, account: accountProp }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState({ wallet: true, trade: true, earn: false, rewards: false, account: false, help: false })
  const [pendingDeposits, setPendingDeposits] = useState(0)
  const [selfAccount, setSelfAccount] = useState(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [spotBalances, setSpotBalances] = useState(null)
  const [spotLoading, setSpotLoading] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
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

  // Fetch spot wallet balances
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchSpot = async () => {
      setSpotLoading(true)
      try {
        const res = await fetch('/api/wallet/balances', { cache: 'no-store' })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSpotBalances(data.balances || [])
        }
      } catch (_) {}
      if (!cancelled) setSpotLoading(false)
    }
    fetchSpot()
    return () => { cancelled = true }
  }, [user])

  // Fetch active price alert count
  useEffect(() => {
    if (!user) return
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts/active-count')
        if (res.ok) setAlertCount((await res.json()).count || 0)
      } catch (_) {}
    }
    fetchAlerts()
    const id = setInterval(fetchAlerts, 30000)
    return () => clearInterval(id)
  }, [user])

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

  // Calculate total spot wallet value (sum of all asset balances in USD)
  const spotTotal = spotBalances?.reduce((sum, b) => sum + (b.usdValue || 0), 0) || 0
  const totalBalance = (spotTotal || 0) + (equity || 0)

  const fmt = (v) => v != null
    ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'

  const email = user?.email || ''
  
  // Use firstName/lastName if available, otherwise derive from email
  const displayName = (() => {
    const first = user?.firstName
    const last = user?.lastName
    if (first || last) {
      return [first, last].filter(Boolean).join(' ')
    }
    // Fall back to formatted email username
    return email
      ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Account'
  })()

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  // Modern nav item: icon sits in a rounded badge, active state is a gradient
  // gold pill with a glowing left accent bar. Always rendered "expanded" — the
  // collapsed rail uses RailIcon instead.
  const NavLink = ({ href, label, icon: Icon, badge = 0, soon = false }) => {
    const active = isActive(href) && !soon
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`group/nav relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-emerald-400/25 via-emerald-400/10 to-transparent font-medium text-emerald-300'
            : 'text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
        }`}
      >
        {active && (
          <span className="absolute -left-2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(240,185,11,0.55)]" />
        )}
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
            active
              ? 'bg-emerald-400/20 text-emerald-300'
              : 'bg-sidebar-accent/40 text-sidebar-foreground/60 group-hover/nav:text-sidebar-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        {soon && (
          <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">Soon</span>
        )}
        {badge > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </Link>
    )
  }

  // Collapsed icon-rail button with a floating label chip on hover.
  const RailIcon = ({ href, label, icon: Icon, badge = 0, soon = false, onClick }) => {
    const active = href ? isActive(href) && !soon : false
    const inner = (
      <>
        <Icon className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
        )}
        {/* hover label chip */}
        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1 text-xs text-sidebar-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover/rail:opacity-100">
          {label}
        </span>
      </>
    )
    const cls = `group/rail relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
      active
        ? 'bg-emerald-400/20 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(240,185,11,0.3)]'
        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    }`
    return href ? (
      <Link href={href} className={cls} onClick={() => setSidebarOpen(false)}>{inner}</Link>
    ) : (
      <button type="button" className={cls} onClick={onClick}>{inner}</button>
    )
  }

  const currentTheme = (resolvedTheme || theme) === 'light' ? 'light' : 'dark'
  const toggleTheme = () => setTheme(currentTheme === 'dark' ? 'light' : 'dark')

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-sidebar border-r border-sidebar-border transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-all duration-200 flex-shrink-0`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-300 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(240,185,11,0.45)]">
                <span className="text-black font-black text-lg leading-none">K</span>
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

              <div className="mt-3 rounded-xl border border-sidebar-border bg-gradient-to-br from-emerald-400/10 via-sidebar-accent/40 to-transparent p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Total Balance</span>
                  <span className="text-sidebar-foreground font-mono font-semibold">{fmt(totalBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Spot Wallet</span>
                  <span className="text-sidebar-foreground font-mono">{fmt(spotTotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Trading</span>
                  <span className={`font-mono ${equity != null && equity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(equity)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => router.push('/wallet/deposit')}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-300 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-emerald-400"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Deposit
                  </button>
                  <button
                    onClick={() => router.push('/wallet')}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-sidebar-accent py-1.5 text-xs font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Wallet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 p-2 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              {navGroups.map((group, gi) => (
                <div key={group.id} className="flex flex-col items-center gap-1">
                  {group.items.map((item) => (
                    <RailIcon key={item.href} {...item} badge={item.href === '/markets' ? alertCount : 0} />
                  ))}
                  {gi < navGroups.length - 1 && <span className="my-1 h-px w-6 bg-sidebar-border" />}
                </div>
              ))}
              <span className="my-1 h-px w-6 bg-sidebar-border" />
              <RailIcon label="Live Support" icon={MessageCircle} onClick={openTawk} />
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`group/rail relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'bg-amber-600/20 text-amber-400'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  {pendingDeposits > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {pendingDeposits > 9 ? '9+' : pendingDeposits}
                    </span>
                  )}
                  <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1 text-xs text-sidebar-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover/rail:opacity-100">
                    {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                  </span>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {navGroups.map((group) => {
                const GroupIcon = group.icon
                const groupActive = group.items.some(i => isActive(i.href) && !i.soon)
                return (
                <Collapsible
                  key={group.id}
                  open={!!openGroups[group.id]}
                  onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [group.id]: open }))}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="group/hdr flex items-center gap-2 px-2 py-2 transition-colors">
                      {GroupIcon && (
                        <GroupIcon className={`h-3.5 w-3.5 ${groupActive ? 'text-emerald-400' : 'text-muted-foreground group-hover/hdr:text-sidebar-foreground'}`} />
                      )}
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${groupActive ? 'text-emerald-300' : 'text-muted-foreground group-hover/hdr:text-sidebar-foreground'}`}>{group.label}</span>
                      <span className="mx-1 h-px flex-1 bg-gradient-to-r from-sidebar-border to-transparent" />
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openGroups[group.id] ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 pb-1 pl-1">
                    {group.items.map((item) => (
                      <NavLink key={item.href} {...item} badge={item.href === '/markets' ? alertCount : 0} />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )})}

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
