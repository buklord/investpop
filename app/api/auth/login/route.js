import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword, createSession, getSessionCookieOptions } from '@/lib/auth'
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

    // Find user
    const users = await prisma.$queryRaw`
      SELECT id, email, password_hash, first_name, last_name, role, email_verified, is_suspended
      FROM users
      WHERE email = ${email.toLowerCase()}
    `

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = users[0]

    // Check if suspended
    if (user.is_suspended) {
      return NextResponse.json({ error: 'Account is suspended. Please contact support.' }, { status: 403 })
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Check email verification
    if (!user.email_verified) {
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
    response.cookies.set(cookieOptions.name, session, cookieOptions)

    return response

  } catch (error) {
    console.error('[auth/login] error:', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
