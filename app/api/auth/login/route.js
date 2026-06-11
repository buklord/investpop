import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword, createSession, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = await rateLimit(ip, 'login', 10, 60 * 1000)
    if (rateLimitResult.limited) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user (backwards-compatible with old schema)
    let users
    try {
      users = await prisma.$queryRaw`
        SELECT id, email, password_hash, first_name, last_name, role, email_verified, is_suspended
        FROM users
        WHERE LOWER(email) = ${email.toLowerCase()}
      `
    } catch (dbErr) {
      const msg = String(dbErr?.message || dbErr).toLowerCase()
      if (msg.includes('email_verified') || msg.includes('column') || msg.includes('does not exist')) {
        users = await prisma.$queryRaw`
          SELECT id, email, password_hash, first_name, last_name, role, is_suspended
          FROM users
          WHERE LOWER(email) = ${email.toLowerCase()}
        `
        if (users?.[0]) users[0].email_verified = true
      } else {
        throw dbErr
      }
    }

    if (!users || users.length === 0) {
      console.log('[auth/login] user not found for email:', email.toLowerCase())
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = users[0]

    // Check if suspended
    if (user.is_suspended) {
      return NextResponse.json({ error: 'Account is suspended. Please contact support.' }, { status: 403 })
    }

    // Verify password
    console.log('[auth/login] attempting password verify for user:', user.email, 'hash length:', String(user.password_hash || '').length)
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      console.log('[auth/login] password verification failed for user:', user.email, 'hash starts with:', String(user.password_hash || '').substring(0, 7))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Check email verification (treat NULL as verified for backwards compatibility)
    if (user.email_verified === false || user.email_verified === 0) {
      return NextResponse.json({
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        needsVerification: true,
        email: user.email
      }, { status: 403 })
    }

    // Create session
    const session = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    })

    // Set session cookie
    const cookieOptions = getSessionCookieOptions()
    console.log('[auth/login] setting cookie', COOKIE_NAME, 'with options:', JSON.stringify(cookieOptions))
    response.cookies.set(COOKIE_NAME, session, cookieOptions)

    return response

  } catch (error) {
    console.error('[auth/login] error:', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
