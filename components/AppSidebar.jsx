'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  X,
  Home,
  Activity,
  PieChart,
  Wallet,
  History,
  Settings,
  Shield,
  LogOut,
  ChevronLeft
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/markets',   label: 'Markets',   icon: Activity },
  { href: '/portfolio', label: 'Portfolio',  icon: PieChart },
  { href: '/wallet',    label: 'Wallet',     icon: Wallet },
  { href: '/history',   label: 'History',    icon: History },
  { href: '/settings',  label: 'Settings',   icon: Settings },
]

export default function AppSidebar({ currentPage, user, sidebarOpen, setSidebarOpen }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [pendingDeposits, setPendingDeposits] = useState(0)

  // Poll for pending deposit count (admins only)
  useEffect(() => {
    if (user?.role !== 'ADMIN') return
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
    const interval = setInterval(fetchCount, 60000)  // poll every 60s
    return () => clearInterval(interval)
  }, [user?.role])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64 bg-[#161b22] border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-all duration-200 flex-shrink-0`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              {!collapsed && <span className="text-xl font-bold text-white truncate">InvestPop</span>}
            </Link>
            {/* Mobile close */}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 ml-auto">
              <X className="h-5 w-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="hidden lg:block text-slate-500 hover:text-slate-300 ml-auto transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {!collapsed && (
            <div className="mt-2 px-2 py-1 bg-emerald-500/10 rounded text-emerald-400 text-xs text-center">
              Live Trading
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-colors ${
                currentPage === href
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              title={collapsed ? 'Admin' : undefined}
              className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-colors relative ${
                currentPage === '/admin'
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Shield className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>Admin</span>}
              {pendingDeposits > 0 && (
                <span className={`bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}`}>
                  {pendingDeposits > 9 ? '9+' : pendingDeposits}
                </span>
              )}
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800">
          {!collapsed && (
            <>
              <div className="text-xs text-slate-400 mb-1 truncate px-1">{user?.email}</div>
              {user?.role === 'ADMIN' && (
                <div className="text-xs text-amber-400 mb-2 px-1">● ADMIN</div>
              )}
            </>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full ${collapsed ? 'justify-center px-2' : 'justify-start'} text-slate-300 hover:text-white hover:bg-slate-800`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </div>
    </div>
  )
}
