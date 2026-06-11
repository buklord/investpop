import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    // Find the verification record
    const rows = await prisma.$queryRaw`
      SELECT * FROM email_verifications WHERE token = ${token}
    `

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 })
    }

    const verification = rows[0]

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification token has expired. Please request a new one.' }, { status: 400 })
    }

    // Mark user as verified
    await prisma.$executeRaw`
      UPDATE users SET email_verified = true WHERE id = ${verification.user_id}
    `

    // Delete the verification token
    await prisma.$executeRaw`
      DELETE FROM email_verifications WHERE id = ${verification.id}
    `

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    })

  } catch (error) {
    console.error('[verify-email] error:', error)
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
  }
}
