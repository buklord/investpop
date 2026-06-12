import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createSession, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

async function getGoogleToken(code, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description || 'Google token exchange failed')
  }
  return res.json()
}

async function getGoogleUser(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Google user info')
  return res.json()
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      console.error('[google/callback] OAuth error:', error)
      return NextResponse.redirect(new URL('/login?error=google_denied', request.url))
    }
    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing_code', request.url))
    }

    // Use the actual request URL as redirect URI (must exactly match what Google received)
    const redirectUri = request.url.split('?')[0]

    // Exchange code for tokens
    const tokenData = await getGoogleToken(code, redirectUri)
    const googleUser = await getGoogleUser(tokenData.access_token)

    const email = googleUser.email?.toLowerCase()
    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url))
    }

    // Find or create user
    let users = await prisma.$queryRaw`
      SELECT id, email, first_name, last_name, role, email_verified, is_suspended
      FROM users
      WHERE LOWER(email) = ${email}
    `

    let user
    if (users && users.length > 0) {
      user = users[0]
      // Auto-verify Google OAuth users
      if (!user.email_verified) {
        await prisma.$executeRaw`
          UPDATE users SET email_verified = true WHERE id = ${user.id}
        `
        user.email_verified = true
      }
    } else {
      // Create new user from Google profile
      const userId = uuidv4()
      const firstName = googleUser.given_name || googleUser.name?.split(' ')[0] || null
      const lastName = googleUser.family_name || null

      // Use a random password hash (OAuth users don't need passwords)
      const dummyHash = 'GOOGLE_OAUTH_' + uuidv4()

      try {
        await prisma.$executeRaw`
          INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, is_suspended, created_at, updated_at)
          VALUES (${userId}, ${email}, ${dummyHash}, ${firstName}, ${lastName}, 'USER', true, false, NOW(), NOW())
        `
      } catch (dbErr) {
        const msg = String(dbErr?.message || dbErr).toLowerCase()
        if (msg.includes('email_verified') || msg.includes('is_suspended') || msg.includes('column') || msg.includes('does not exist')) {
          await prisma.$executeRaw`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
            VALUES (${userId}, ${email}, ${dummyHash}, ${firstName}, ${lastName}, 'USER', NOW(), NOW())
          `
        } else {
          throw dbErr
        }
      }

      // Create virtual account
      try {
        await prisma.$executeRaw`
          INSERT INTO virtual_accounts (id, user_id, balance, demo_balance, real_balance, trading_mode)
          VALUES (gen_random_uuid()::text, ${userId}, 0, 100000, 0, 'REAL')
        `
      } catch (dbErr) {
        const msg = String(dbErr?.message || dbErr).toLowerCase()
        if (msg.includes('demo_balance') || msg.includes('real_balance') || msg.includes('trading_mode') || msg.includes('column') || msg.includes('does not exist')) {
          await prisma.$executeRaw`
            INSERT INTO virtual_accounts (id, user_id, balance)
            VALUES (gen_random_uuid()::text, ${userId}, 0)
          `
        } else {
          throw dbErr
        }
      }

      user = { id: userId, email, first_name: firstName, last_name: lastName, role: 'USER', email_verified: true, is_suspended: false }
    }

    if (user.is_suspended) {
      return NextResponse.redirect(new URL('/login?error=suspended', request.url))
    }

    // Create session
    const session = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    })

    // Redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set(COOKIE_NAME, session, getSessionCookieOptions())

    return response

  } catch (err) {
    console.error('[google/callback] error:', err?.message || err)
    // Log the redirect URI that was used for debugging
    console.error('[google/callback] redirectUri used:', request.url.split('?')[0])
    return NextResponse.redirect(new URL('/login?error=google_failed', request.url))
  }
}
