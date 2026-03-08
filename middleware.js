import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const rawSecret = process.env.SESSION_SECRET
const SECRET_KEY = new TextEncoder().encode(
  rawSecret || 'fallback-secret-key-change-in-production'
)

const COOKIE_NAME = 'session'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Only protect /admin/* page routes (not /api — those are handled by requireAdminAuth())
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)

  // Not logged in at all → back to home/login
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Verify JWT and check role
  try {
    const { payload } = await jwtVerify(sessionCookie.value, SECRET_KEY)

    if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      // Logged in but not admin → dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Admin — allow through
    return NextResponse.next()
  } catch {
    // Invalid / expired token
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
