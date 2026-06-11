import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { withdrawalDecisionEmail } from '@/lib/emailTemplates'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const auth = await requireAdminAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 })
    }

    const body = await request.json()
    const { withdrawalId, action, notes } = body

    if (!withdrawalId || !action || !['APPROVE', 'REJECT', 'PROCESSING'].includes(action)) {
      return NextResponse.json({ error: 'Valid withdrawalId and action required' }, { status: 400 })
    }

    // Get the withdrawal request
    const rows = await prisma.$queryRaw`
      SELECT * FROM withdrawal_requests WHERE id = ${withdrawalId}
    `

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 })
    }

    const withdrawal = rows[0]

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: 'Withdrawal request has already been processed' }, { status: 400 })
    }

    let newStatus = 'PENDING'
    if (action === 'APPROVE') newStatus = 'COMPLETED'
    else if (action === 'REJECT') newStatus = 'REJECTED'
    else if (action === 'PROCESSING') newStatus = 'PENDING' // Keep pending but mark as being processed

    // Update withdrawal request
    await prisma.$executeRaw`
      UPDATE withdrawal_requests
      SET status = ${newStatus},
          notes = ${notes || null},
          processed_by = ${auth.user.userId},
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${withdrawalId}
    `

    // If approved, deduct from user's real balance
    if (action === 'APPROVE') {
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET real_balance = GREATEST(0, real_balance - ${withdrawal.amount}),
            balance = CASE WHEN trading_mode = 'REAL' THEN GREATEST(0, balance - ${withdrawal.amount}) ELSE balance END,
            updated_at = NOW()
        WHERE user_id = ${withdrawal.user_id}
      `

      // Add ledger entry
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, created_at)
        VALUES (gen_random_uuid()::text, ${withdrawal.user_id}, 'WITHDRAWAL', ${-withdrawal.amount}, 0, 
                'Withdrawal approved: ' || ${withdrawal.method} || ' to ' || ${withdrawal.address}, NOW())
      `
    }

    // Send email notification
    const userRows = await prisma.$queryRaw`
      SELECT email FROM users WHERE id = ${withdrawal.user_id}
    `
    const email = userRows?.[0]?.email

    if (email) {
      try {
        await sendEmail(withdrawalDecisionEmail(email, withdrawal.amount, action === 'APPROVE', notes))
      } catch (e) {
        console.warn('[admin/withdrawals/action] email failed:', e.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${action.toLowerCase()}d successfully`
    })

  } catch (error) {
    console.error('[admin/withdrawals/action] error:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
