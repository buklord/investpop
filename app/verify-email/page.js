import { Suspense } from 'react'
import VerifyEmailContent from './VerifyEmailContent'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Verifying your email...</h1>
          <p className="text-muted-foreground text-sm">Please wait while we verify your email address.</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
