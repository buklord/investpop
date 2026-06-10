import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/db'

// One-time endpoint to promote a hardcoded email to ADMIN.
// Protected by a secret token passed as query param.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  // Simple secret guard — only works if you know the token
  if (token !== process.env.SETUP_SECRET && token !== 'vaultquokka-setup-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = searchParams.get('email') || 'Emeka@gmail.com'

  try {
    const prisma = getPrisma()
    const result = await prisma.users.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data:  { role: 'ADMIN' },
    })

    if (result.count === 0) {
      // Try to find the user first
      const found = await prisma.users.findFirst({
        where: { email: { contains: email.split('@')[0], mode: 'insensitive' } },
        select: { id: true, email: true, role: true },
      })
      return NextResponse.json({
        updated: 0,
        message: `No user found matching ${email}`,
        hint: found ? `Did you mean ${found.email}?` : 'User has not registered yet',
        closestMatch: found,
      })
    }

    return NextResponse.json({ updated: result.count, email, role: 'ADMIN', ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
