import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const withdrawals = await prisma.$queryRaw`
      SELECT id, amount, method, address, status, notes, created_at, updated_at
      FROM withdrawal_requests
      WHERE user_id = ${auth.user.userId}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ withdrawals: withdrawals || [] })

  } catch (error) {
    console.error('[withdrawal/list] error:', error)
    return NextResponse.json({ error: 'Failed to fetch withdrawal history' }, { status: 500 })
  }
}
