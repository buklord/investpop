import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { hashPassword, createSession, getSessionCookieOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { verificationEmail } from '@/lib/emailTemplates'
import { v4 as uuidv4 } from 'uuid'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = await rateLimit(ip, 'register', 5, 60 * 1000)
    if (rateLimitResult.limited) {
      return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { email, password, firstName, lastName } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if user exists (case-insensitive)
    const existing = await prisma.$queryRaw`
      SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase()}
    `

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    // Hash password
    const passwordHash = await hashPassword(password)
    const userId = uuidv4()

    // Create user (backwards-compatible with old schema)
    try {
      await prisma.$executeRaw`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, is_suspended, created_at, updated_at)
        VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${firstName || null}, ${lastName || null}, 'USER', false, false, NOW(), NOW())
      `
    } catch (dbErr) {
      const msg = String(dbErr?.message || dbErr).toLowerCase()
      if (msg.includes('email_verified') || msg.includes('is_suspended') || msg.includes('column') || msg.includes('does not exist')) {
        await prisma.$executeRaw`
          INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
          VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${firstName || null}, ${lastName || null}, 'USER', NOW(), NOW())
        `
      } else {
        throw dbErr
      }
    }

    // Create virtual account (backwards-compatible with old schema)
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

    // Create email verification token (best-effort; skip if table doesn't exist yet)
    let token
    try {
      token = uuidv4()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await prisma.$executeRaw`
        INSERT INTO email_verifications (id, user_id, token, expires_at, created_at)
        VALUES (gen_random_uuid()::text, ${userId}, ${token}, ${expiresAt}, NOW())
      `
    } catch (e) {
      console.warn('[register] email_verifications table not ready:', e.message)
      token = null
    }

    // Send verification email (only if token was created)
    if (token) {
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.vaultquokka.com'}/verify-email?token=${token}`
      try {
        const template = verificationEmail({ verificationUrl, firstName, lastName })
        await sendEmail({
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html
        })
      } catch (e) {
        console.warn('[register] verification email failed:', e.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: token
        ? 'Account created successfully. Please check your email to verify your account.'
        : 'Account created successfully.',
      userId
    }, { status: 201 })

  } catch (error) {
    console.error('[auth/register] error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
