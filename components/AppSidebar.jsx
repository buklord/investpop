'use client'

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
  LogOut
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/markets', label: 'Markets', icon: Activity },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function AppSidebar({ currentPage, user, sidebarOpen, setSidebarOpen }) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">InvestPop</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 px-2 py-1 bg-emerald-500/10 rounded text-emerald-400 text-xs text-center">
            Live Trading
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === href
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === '/admin'
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Shield className="h-5 w-5" />
              Admin
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-sm text-slate-400 mb-1 truncate">{user?.email}</div>
          {user?.role === 'ADMIN' && (
            <div className="text-xs text-amber-400 mb-2">● ADMIN</div>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
