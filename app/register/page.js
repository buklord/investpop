'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [firstName, setFirstName] = useState('')
  const [step, setStep]           = useState(1)
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)

  const handleStep1 = (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError('')
    setSubmitting(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 90000)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
        return
      }
      setRegistered(true)
    } catch (err) {
      clearTimeout(t)
      setError(
        err?.name === 'AbortError'
          ? 'Server is waking up — please try again in a moment.'
          : 'Network error. Check your connection.'
      )
    } finally {
      setSubmitting(false)
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

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {registered ? (
            /* Full-screen success overlay */
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#0c1220] p-8 text-center shadow-2xl shadow-emerald-500/10">
                <div className="w-24 h-24 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/10">
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                </div>

                <h2 className="text-3xl font-extrabold text-white mb-2">Account Created!</h2>
                <p className="text-emerald-400 font-semibold text-sm mb-6 uppercase tracking-wide">
                  One last step
                </p>

                <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5 mb-6 text-left">
                  <p className="text-white/70 text-sm mb-4 text-center">
                    We sent a verification link to<br />
                    <span className="text-white font-bold text-base">{email}</span>
                  </p>
                  <div className="border-t border-white/[0.08] pt-4">
                    <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3 text-center">What to do next</h3>
                    <ol className="text-white/50 text-sm space-y-3 list-decimal list-inside">
                      <li>Open your email inbox</li>
                      <li>Find the email from <strong className="text-emerald-400">Vaultquokka</strong></li>
                      <li>Click the <strong className="text-emerald-400">Verify Email</strong> button</li>
                      <li>Return here and log in</li>
                    </ol>
                  </div>
                </div>

                <p className="text-white/30 text-xs mb-4">
                  Did not receive it? Check spam or{' '}
                  <button
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/resend-verification', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email })
                        })
                        alert('Verification email resent!')
                      } catch {
                        alert('Failed to resend. Please try again.')
                      }
                    }}
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    resend it
                  </button>
                </p>

                <Link href="/login">
                  <button className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors">
                    Go to Login
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight mb-1">Create your Vaultquokka account</h1>
                <p className="text-white/40 text-sm">Multi-asset crypto wallet with optional trading. No card required.</p>
              </div>

              {/* Google Sign Up */}
              <button
                type="button"
                onClick={() => {
                  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
                  if (!clientId) {
                    alert('Google sign-up is not configured yet. Use email/password instead.')
                    return
                  }
                  const redirectUri = `${window.location.origin}/api/auth/google/callback`
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
                className="w-full h-11 rounded-lg bg-white text-gray-900 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.12]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-background text-white/30">or use email</span>
                </div>
              </div>

              {/* Trust signals */}
              <div className="mb-8 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 grid grid-cols-2 gap-3">
                {[
                  '$100,000 virtual funds',
                  'No card required',
                  'Live market conditions',
                  'Upgrade to live after KYC',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500/70 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-white/50 text-xs leading-snug">{item}</span>
                  </div>
                ))}
              </div>

              {/* Form */}
              {step === 1 ? (
                <form onSubmit={handleStep1} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5" htmlFor="email">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError('') }}
                      className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                  </div>
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    type="submit"
                    className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Confirmed email row */}
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <span className="text-white/60 text-sm flex-1 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-white/30 hover:text-white/60 text-xs underline transition-colors flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-white/40 mb-1.5" htmlFor="firstName">
                      First name <span className="text-white/20">(optional)</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="Your first name"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/40 mb-1.5" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      className="w-full h-11 px-4 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-emerald-500/60 transition-colors"
                    />
                  </div>

                  {error && <p className="text-red-400 text-xs">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <span
                          className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                          aria-hidden="true"
                        />
                        Creating your account&hellip;
                      </>
                    ) : (
                      <>
                        Create demo account <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </>
                    )}
                  </button>

                  <p className="text-white/20 text-xs text-center">
                    By registering you agree to our{' '}
                    <Link href="/terms" className="underline hover:text-white/40 transition-colors">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link href="/risk-disclosure" className="underline hover:text-white/40 transition-colors">
                      Risk Disclosure
                    </Link>
                    .
                  </p>
                </form>
              )}

              <p className="mt-6 text-center text-xs text-white/25">
                Already have an account?{' '}
                <Link href="/login" className="text-emerald-400 hover:text-emerald-300 underline transition-colors">
                  Log in
                </Link>
              </p>

              {/* Fine print */}
              <p className="mt-8 text-center text-[11px] text-white/15 leading-relaxed">
                Virtual accounts use virtual funds only. No real money is involved until you choose
                to open a live account after completing identity verification.
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
