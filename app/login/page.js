'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 90000)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Login failed. Check your email and password.'); return }
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(t)
      setError(err?.name === 'AbortError' ? 'Server timeout — try again.' : 'Network error. Check your connection.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <nav className="border-b border-border/50 px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-base leading-none">V</span>
          </div>
          <span className="text-sm font-bold">Vaultquokka</span>
        </Link>
        <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">Cancel</Link>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
            <p className="text-white/40 text-sm">Sign in to your Vaultquokka account</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" aria-hidden="true" /> Signing in&hellip;</>
                : <>Sign in <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
              }
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            No account yet?{' '}
            <Link href="/#hero-form" className="text-emerald-400 hover:text-emerald-300 underline">
              Create a free demo account
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-border/40">
            <p className="text-center text-xs text-white/20 leading-relaxed">
              By signing in you agree to our{' '}
              <Link href="/terms" className="text-white/35 hover:text-white underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/risk-disclosure" className="text-white/35 hover:text-white underline">Risk Disclosure</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
