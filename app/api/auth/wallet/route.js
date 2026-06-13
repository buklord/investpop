import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createSession, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth'
import { verifyMessage } from 'viem'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request) {
  try {
    const body = await request.json()
    const { address, message, signature } = body

    if (!address || !message || !signature) {
      return NextResponse.json({ error: 'Address, message, and signature are required' }, { status: 400 })
    }

    // Normalize address (lowercase with 0x prefix)
    const walletAddress = address.toLowerCase().startsWith('0x') ? address.toLowerCase() : `0x${address.toLowerCase()}`

    // Verify signature using viem
    let isValid = false
    try {
      isValid = await verifyMessage({
        address: walletAddress,
        message,
        signature,
      })
    } catch (verifyErr) {
      console.error('[wallet/auth] signature verification error:', verifyErr.message)
      return NextResponse.json({ error: 'Invalid signature. Please try again.' }, { status: 401 })
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
    }

    // Check if wallet_address column exists by trying a query
    let hasWalletColumn = false
    try {
      await prisma.$queryRaw`SELECT wallet_address FROM users LIMIT 1`
      hasWalletColumn = true
    } catch {
      hasWalletColumn = false
    }

    let user
    if (hasWalletColumn) {
      // Look up user by wallet_address
      const users = await prisma.$queryRaw`
        SELECT id, email, first_name, last_name, role, email_verified, is_suspended, wallet_address
        FROM users
        WHERE wallet_address = ${walletAddress}
      `
      if (users && users.length > 0) {
        user = users[0]
      }
    } else {
      // Fallback: look up by generated email pattern
      const walletEmail = `${walletAddress}@wallet.vaultquokka.local`
      const users = await prisma.$queryRaw`
        SELECT id, email, first_name, last_name, role, email_verified, is_suspended
        FROM users
        WHERE LOWER(email) = ${walletEmail}
      `
      if (users && users.length > 0) {
        user = users[0]
      }
    }

    if (!user) {
      // Create new wallet user
      const userId = uuidv4()
      const walletEmail = `${walletAddress}@wallet.vaultquokka.local`
      const shortAddress = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)

      try {
        if (hasWalletColumn) {
          await prisma.$executeRaw`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, is_suspended, wallet_address, created_at, updated_at)
            VALUES (${userId}, ${walletEmail}, ${'WALLET_AUTH_' + uuidv4()}, ${shortAddress}, null, 'USER', true, false, ${walletAddress}, NOW(), NOW())
          `
        } else {
          await prisma.$executeRaw`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, is_suspended, created_at, updated_at)
            VALUES (${userId}, ${walletEmail}, ${'WALLET_AUTH_' + uuidv4()}, ${shortAddress}, null, 'USER', true, false, NOW(), NOW())
          `
        }
      } catch (dbErr) {
        const msg = String(dbErr?.message || dbErr).toLowerCase()
        if (msg.includes('email_verified') || msg.includes('is_suspended') || msg.includes('column') || msg.includes('does not exist')) {
          // Fallback without email_verified/is_suspended
          await prisma.$executeRaw`
            INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
            VALUES (${userId}, ${walletEmail}, ${'WALLET_AUTH_' + uuidv4()}, ${shortAddress}, null, 'USER', NOW(), NOW())
          `
        } else {
          throw dbErr
        }
      }

      // Create virtual account (backwards-compatible)
      try {
        await prisma.$executeRaw`
          INSERT INTO virtual_accounts (id, user_id, balance, demo_balance, real_balance, trading_mode)
          VALUES (gen_random_uuid()::text, ${userId}, 0, 100000, 0, 'REAL')
        `
      } catch (dbErr) {
        const msg = String(dbErr?.message || dbErr).toLowerCase()
        if (msg.includes('demo_balance') || msg.includes('real_balance') || msg.includes('trading_mode') || msg.includes('column') || msg.includes('does not exist')) {
          await prisma.$executeRaw`
            INSERT INTO virtual_accounts (id, user_id, balance)
            VALUES (gen_random_uuid()::text, ${userId}, 0)
          `
        } else {
          throw dbErr
        }
      }

      user = {
        id: userId,
        email: walletEmail,
        first_name: shortAddress,
        last_name: null,
        role: 'USER',
        email_verified: true,
        is_suspended: false,
      }
    }

    if (user.is_suspended) {
      return NextResponse.json({ error: 'Account is suspended. Contact support.' }, { status: 403 })
    }

    // Create session
    const session = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    })

    // Build response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      }
    })
    response.cookies.set(COOKIE_NAME, session, getSessionCookieOptions())

    return response

  } catch (err) {
    console.error('[wallet/auth] error:', err?.message || err)
    return NextResponse.json({ error: 'Wallet authentication failed' }, { status: 500 })
  }
}
