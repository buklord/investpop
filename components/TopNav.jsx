'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Menu,
  Wallet,
  ArrowDownUp,
  Send,
  ArrowDownToLine,
  History as HistoryIcon,
  ChevronDown,
  Activity,
  Bot,
  Users,
  Sun,
  Moon,
  Settings,
  LogOut,
  Plus,
  User as UserIcon,
} from 'lucide-react'

// Binance-style global top navigation bar. Lives at the top of the content
// column on app pages (hybrid shell: works alongside the existing sidebar).
export default function TopNav({ user, setSidebarOpen }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const currentTheme = (resolvedTheme || theme) === 'light' ? 'light' : 'dark'
  const toggleTheme = () => setTheme(currentTheme === 'dark' ? 'light' : 'dark')

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const email = user?.email || ''
  const displayName = (() => {
    const first = user?.firstName
    const last = user?.lastName
    if (first || last) return [first, last].filter(Boolean).join(' ')
    return email
      ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Account'
  })()

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const linkCls = (href) =>
    `text-sm font-medium transition-colors whitespace-nowrap ${
      isActive(href) ? 'text-emerald-400' : 'text-foreground/70 hover:text-foreground'
    }`

  const tradeItems = [
    { href: '/markets',      label: 'Markets',      icon: Activity },
    { href: '/bots',         label: 'AI Bots',      icon: Bot },
    { href: '/copy-trading', label: 'Copy Trading', icon: Users },
  ]
  const walletItems = [
    { href: '/wallet',         label: 'Overview', icon: Wallet },
    { href: '/wallet/convert', label: 'Convert',  icon: ArrowDownUp },
    { href: '/wallet/send',    label: 'Send',     icon: Send },
    { href: '/wallet/receive', label: 'Receive',  icon: ArrowDownToLine },
    { href: '/wallet/history', label: 'History',  icon: HistoryIcon },
  ]

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-sidebar-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80">
      <div className="flex h-full items-center gap-2 px-3 sm:px-4">
        {/* Mobile: hamburger + logo */}
        <button
          onClick={() => setSidebarOpen?.(true)}
          className="lg:hidden text-muted-foreground hover:text-foreground p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="lg:hidden flex items-center gap-1.5">
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-300 to-emerald-500 rounded-md flex items-center justify-center">
            <span className="text-black font-black text-base leading-none">K</span>
          </div>
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden lg:flex items-center gap-6 ml-1">
          <Link href="/dashboard" className={linkCls('/dashboard')}>Dashboard</Link>
          <Link href="/markets" className={linkCls('/markets')}>Markets</Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-foreground/70 hover:text-foreground outline-none">
              Trade <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {tradeItems.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4 text-emerald-400" /> {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/wallet/convert" className={linkCls('/wallet/convert')}>Convert</Link>

          <span className="flex items-center gap-1 text-sm font-medium text-foreground/40 cursor-default">
            Earn
            <span className="text-[9px] font-bold uppercase bg-emerald-400/15 text-emerald-400 rounded px-1 py-0.5">Soon</span>
          </span>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          <Button
            asChild
            className="h-9 bg-emerald-300 hover:bg-emerald-400 text-black font-semibold px-3 sm:px-4 text-sm"
          >
            <Link href="/wallet/deposit" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Deposit</span>
            </Link>
          </Button>

          {/* Wallet dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 h-9 px-2.5 rounded-md text-sm font-medium text-foreground/80 hover:bg-sidebar-accent outline-none">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Spot Wallet</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {walletItems.map(({ href, label, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4 text-emerald-400" /> {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={toggleTheme}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Toggle theme"
          >
            {mounted && currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Avatar className="h-9 w-9 border border-sidebar-border">
                <AvatarFallback className="bg-emerald-300 text-black text-sm font-bold">
                  {(email || 'A').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{displayName}</div>
                  <div className="truncate text-xs text-muted-foreground font-normal">{email || '—'}</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/wallet" className="flex items-center gap-2 cursor-pointer">
                  <Wallet className="h-4 w-4" /> Wallet Overview
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme} className="sm:hidden flex items-center gap-2 cursor-pointer">
                {mounted && currentTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-red-400 focus:text-red-400">
                <LogOut className="h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
