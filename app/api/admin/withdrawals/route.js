import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { withdrawalDecisionEmail } from '@/lib/emailTemplates'

export const dynamic = 'force-dynamic'

// GET /api/admin/withdrawals - List all withdrawal requests
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 })
    }

    const withdrawals = await prisma.$queryRaw`
      SELECT 
        wr.id,
        wr.user_id,
        wr.amount,
        wr.method,
        wr.address,
        wr.status,
        wr.notes,
        wr.processed_by,
        wr.processed_at,
        wr.created_at,
        wr.updated_at,
        u.email,
        u.first_name,
        u.last_name
      FROM withdrawal_requests wr
      JOIN users u ON wr.user_id = u.id
      ORDER BY 
        CASE wr.status WHEN 'PENDING' THEN 0 ELSE 1 END,
        wr.created_at DESC
    `

    return NextResponse.json({ withdrawals: withdrawals || [] })

  } catch (error) {
    console.error('[admin/withdrawals] error:', error)
    return NextResponse.json({ error: 'Failed to fetch withdrawals' }, { status: 500 })
  }
}

// POST /api/admin/withdrawals - Approve or reject a withdrawal
export async function POST(request) {
  try {
    const auth = await requireAdminAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 })
    }

    const body = await request.json()
    const { requestId, action, notes } = body

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid requestId and action (approve/reject) required' }, { status: 400 })
    }

    // Get the withdrawal request
    const rows = await prisma.$queryRaw`
      SELECT * FROM withdrawal_requests WHERE id = ${requestId}
    `

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 })
    }

    const withdrawal = rows[0]

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: 'Withdrawal request has already been processed' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'COMPLETED' : 'REJECTED'

    // Update withdrawal request
    await prisma.$executeRaw`
      UPDATE withdrawal_requests
      SET status = ${newStatus},
          notes = ${notes || null},
          processed_by = ${auth.user.userId},
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${requestId}
    `

    // If approved, deduct from user's real balance
    if (action === 'approve') {
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
        await sendEmail(withdrawalDecisionEmail(email, withdrawal.amount, action === 'approve', notes))
      } catch (e) {
        console.warn('[admin/withdrawals] email failed:', e.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    })

  } catch (error) {
    console.error('[admin/withdrawals] error:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}
