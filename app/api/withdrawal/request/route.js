import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { withdrawalRequestReceivedEmail } from '@/lib/emailTemplates'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request) {
  try {
    const auth = await requireAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { amount, method, address } = body

    // Validation
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Valid withdrawal amount is required' }, { status: 400 })
    }
    if (!method || !['BTC', 'USDT', 'USDC'].includes(method)) {
      return NextResponse.json({ error: 'Valid withdrawal method is required (BTC, USDT, or USDC)' }, { status: 400 })
    }
    if (!address || address.trim().length < 10) {
      return NextResponse.json({ error: 'Valid withdrawal address is required' }, { status: 400 })
    }

    const numAmount = parseFloat(amount)

    // Check user has sufficient real balance
    const accountRows = await prisma.$queryRaw`
      SELECT real_balance FROM virtual_accounts WHERE user_id = ${auth.user.userId}
    `
    const realBalance = parseFloat(accountRows?.[0]?.real_balance) || 0

    if (realBalance < numAmount) {
      return NextResponse.json({ error: 'Insufficient real balance for withdrawal' }, { status: 400 })
    }

    // Create withdrawal request
    const id = uuidv4()
    await prisma.$executeRaw`
      INSERT INTO withdrawal_requests (id, user_id, amount, method, address, status, created_at, updated_at)
      VALUES (${id}, ${auth.user.userId}, ${numAmount}, ${method}, ${address.trim()}, 'PENDING', NOW(), NOW())
    `

    // Get user email for notification
    const userRows = await prisma.$queryRaw`
      SELECT email FROM users WHERE id = ${auth.user.userId}
    `
    const email = userRows?.[0]?.email

    // Send email notification (best effort)
    if (email) {
      try {
        await sendEmail(withdrawalRequestReceivedEmail(email, numAmount, method))
      } catch (e) {
        console.warn('[withdrawal] email failed:', e.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted successfully. It will be processed within 24 hours.',
      requestId: id
    })

  } catch (error) {
    console.error('[withdrawal/request] error:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal request' }, { status: 500 })
  }
}
