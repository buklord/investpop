import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(request) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'Valid token and password (min 8 chars) are required' }, { status: 400 })
    }

    // Find valid token
    const rows = await prisma.$queryRaw`
      SELECT user_id, expires_at, used FROM password_resets WHERE token = ${token} LIMIT 1
    `

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })
    }

    const reset = rows[0]

    if (reset.used) {
      return NextResponse.json({ error: 'This reset link has already been used.' }, { status: 400 })
    }

    if (new Date(reset.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(password)
    await prisma.$executeRaw`
      UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${reset.user_id}
    `

    // Mark token as used
    await prisma.$executeRaw`
      UPDATE password_resets SET used = true WHERE token = ${token}
    `

    return NextResponse.json({ message: 'Password updated successfully.' })

  } catch (error) {
    console.error('[reset-password] error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
