'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error')
    if (urlError === 'google_denied') setError('Google sign-in was cancelled.')
    else if (urlError === 'google_failed') setError('Google sign-in failed. Please try again.')
    else if (urlError === 'suspended') setError('Account is suspended. Contact support.')
    else if (urlError === 'no_email') setError('Could not retrieve email from Google. Please try again.')
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setNeedsVerification(false)
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
      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true)
        }
        setError(data.error || 'Login failed. Check your email and password.')
        return
      }
      router.push('/dashboard')
    } catch (err) {
      clearTimeout(t)
      setError(err?.name === 'AbortError' ? 'Server timeout — try again.' : 'Network error. Check your connection.')
    } finally { setSubmitting(false) }
  }

  const handleWalletLogin = async () => {
    setError('')
    setSubmitting(true)
    try {
      console.log('[login] wallet login clicked')
      // Dynamically import WalletConnect utility (lazy-load)
      const { connectWallet, signMessage } = await import('@/lib/walletConnect')
      console.log('[login] walletConnect module loaded')

      // Open WalletConnect QR modal (or use injected wallet if available)
      let connected
      try {
        console.log('[login] calling connectWallet()...')
        connected = await connectWallet()
        console.log('[login] connectWallet() returned:', connected)
      } catch (connErr) {
        console.error('[login] wallet connect error:', connErr)
        const msg = connErr?.message || String(connErr)
        setError('Wallet error: ' + msg)
        setSubmitting(false)
        return
      }

      const { address, provider } = connected

      // Generate nonce message
      const nonce = Date.now().toString()
      const message = `Sign in to VaultQuokka:\nWallet: ${address}\nNonce: ${nonce}\n\nThis proves you own this wallet. No transaction will be charged.`

      // Request signature
      let signature
      try {
        const signed = await signMessage(message, provider)
        signature = signed.signature
      } catch (signErr) {
        setError('Signature rejected. You must sign the message to log in.')
        setSubmitting(false)
        return
      }

      // Send to backend
      const res = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, message, signature }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Wallet authentication failed.')
        setSubmitting(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      console.error('[wallet/login]', err)
      setError('Wallet connection failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  const handleResendVerification = async () => {
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.ok) {
        setError('Verification email resent. Please check your inbox.')
        setNeedsVerification(false)
      } else {
        setError('Failed to resend verification email. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
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

          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => {
              const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
              if (!clientId) {
                setError('Google sign-in is not configured. Contact support.')
                return
              }
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
              const redirectUri = `${baseUrl}/api/auth/google/callback`
              const scope = 'openid email profile'
              const state = btoa(Math.random().toString()).slice(0, 16)
              sessionStorage.setItem('google_oauth_state', state)
              const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(clientId)}` +
                `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                `&response_type=code` +
                `&scope=${encodeURIComponent(scope)}` +
                `&state=${state}` +
                `&prompt=select_account`
              window.location.href = url
            }}
            className="w-full h-11 rounded-lg bg-white text-gray-900 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={handleWalletLogin}
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 hover:from-orange-600 hover:to-amber-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
              <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
            </svg>
            Connect Wallet
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.12]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-background text-white/30">or</span>
            </div>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-white/40" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 underline">
                  Forgot password?
                </Link>
              </div>
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
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p>{error}</p>
                {needsVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-emerald-400 hover:text-emerald-300 underline mt-1"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
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
              Create an account
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
