import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { verificationEmail } from '@/lib/emailTemplates'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find user
    const users = await prisma.$queryRaw`
      SELECT id, email_verified FROM users WHERE email = ${email}
    `

    if (!users || users.length === 0) {
      // Don't reveal if user exists
      return NextResponse.json({ message: 'If the email exists, a verification link has been sent.' })
    }

    const user = users[0]

    if (user.email_verified) {
      return NextResponse.json({ message: 'Email is already verified.' })
    }

    // Delete old tokens
    await prisma.$executeRaw`
      DELETE FROM email_verifications WHERE user_id = ${user.id}
    `

    // Create new token
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.$executeRaw`
      INSERT INTO email_verifications (id, user_id, token, expires_at, created_at)
      VALUES (gen_random_uuid()::text, ${user.id}, ${token}, ${expiresAt}, NOW())
    `

    // Send email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.vaultquokka.com'}/verify-email?token=${token}`
    
    try {
      const template = verificationEmail({ verificationUrl })
      await sendEmail({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html
      })
    } catch (e) {
      console.warn('[resend-verification] email failed:', e.message)
    }

    return NextResponse.json({ message: 'Verification email sent. Please check your inbox.' })

  } catch (error) {
    console.error('[resend-verification] error:', error)
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }
}
