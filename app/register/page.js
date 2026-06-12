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
            /* Success state - completely replaces form */
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Verify Your Email</h2>
              <p className="text-white/60 text-sm mb-2">
                We sent a verification link to
              </p>
              <p className="text-white font-semibold text-base mb-6">{email}</p>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 mb-6 text-left">
                <h3 className="text-white/80 text-sm font-semibold mb-3">Next steps:</h3>
                <ol className="text-white/50 text-sm space-y-2 list-decimal list-inside">
                  <li>Open your email inbox</li>
                  <li>Find the email from Vaultquokka</li>
                  <li>Click the <strong className="text-emerald-400">Verify Email</strong> button</li>
                  <li>Come back here to log in</li>
                </ol>
              </div>

              <p className="text-white/40 text-xs mb-3">
                Did not receive it? Check your spam folder or{' '}
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
                <button className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors">
                  Go to Login
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight mb-1">Create your Vaultquokka account</h1>
                <p className="text-white/40 text-sm">Multi-asset crypto wallet with optional trading. No card required.</p>
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
