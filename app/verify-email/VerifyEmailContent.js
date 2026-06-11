'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link. No token provided.')
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await res.json()

        if (res.ok) {
          setStatus('success')
          setMessage(data.message || 'Email verified successfully!')
        } else {
          setStatus('error')
          setMessage(data.error || 'Failed to verify email.')
        }
      } catch {
        setStatus('error')
        setMessage('Network error. Please try again.')
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Verifying your email...</h1>
            <p className="text-muted-foreground text-sm">Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Email Verified!</h1>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link href="/login">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
                Go to Login
              </button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Verification Failed</h1>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link href="/login">
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
                Go to Login
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
