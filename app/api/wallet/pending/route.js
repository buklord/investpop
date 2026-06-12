import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const user = await requireAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Pending deposits
    const deposits = await prisma.$queryRaw`
      SELECT id, amount, method, status, created_at, 'DEPOSIT' as type
      FROM deposit_requests
      WHERE user_id = ${user.id} AND status IN ('PENDING', 'PROCESSING')
      ORDER BY created_at DESC
    `.catch(() => [])

    // Pending withdrawals
    const withdrawals = await prisma.$queryRaw`
      SELECT id, amount, method, status, created_at, 'WITHDRAWAL' as type
      FROM withdrawal_requests
      WHERE user_id = ${user.id} AND status = 'PENDING'
      ORDER BY created_at DESC
    `.catch(() => [])

    const all = [...(deposits || []), ...(withdrawals || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)

    return NextResponse.json({ pending: all })

  } catch (error) {
    console.error('[wallet/pending] error:', error)
    return NextResponse.json({ pending: [] })
  }
}
