import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = await rateLimit(ip, 'forgot-password', 3, 60 * 1000)
    if (rateLimitResult.limited) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // Ensure password_resets table exists
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS password_resets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          used BOOLEAN DEFAULT false
        )
      `
    } catch (e) {
      console.warn('[forgot-password] table creation skipped:', e.message)
    }

    // Find user (case-insensitive)
    const users = await prisma.$queryRaw`
      SELECT id, email FROM users WHERE LOWER(email) = ${email.toLowerCase()}
    `

    // Always return success to prevent email enumeration
    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' })
    }

    const user = users[0]

    // Delete old tokens for this user
    await prisma.$executeRaw`
      DELETE FROM password_resets WHERE user_id = ${user.id}
    `

    // Create new token
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.$executeRaw`
      INSERT INTO password_resets (id, user_id, token, expires_at, created_at, used)
      VALUES (gen_random_uuid()::text, ${user.id}, ${token}, ${expiresAt}, NOW(), false)
    `

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.vaultquokka.com'}/reset-password?token=${token}`
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Vaultquokka password',
        text: `Hi,\n\nYou requested a password reset for your Vaultquokka account.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #d4a017;">Reset your password</h1>
            <p>You requested a password reset for your Vaultquokka account.</p>
            <p>Click the button below to create a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#d4a017;color:#1a1200;text-decoration:none;border-radius:8px;margin: 16px 0;font-weight:bold;">Reset Password</a>
            <p style="color: #6b7280; font-size: 14px;">Or copy and paste this URL:</p>
            <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${resetUrl}</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you did not request this, please ignore this email.</p>
          </div>
        `
      })
    } catch (e) {
      console.warn('[forgot-password] email failed:', e.message)
    }

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' })

  } catch (error) {
    console.error('[forgot-password] error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
