import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production'
)

const COOKIE_NAME = 'session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword)
}

export async function createSession(userId, email, role = 'USER') {
  // Support both positional args and object syntax
  if (typeof userId === 'object' && userId !== null) {
    const obj = userId
    userId = obj.userId
    email = obj.email
    role = obj.role || 'USER'
  }
  const token = await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY)

  return token
}

/**
 * Require authentication. Returns { user } on success or { error, status } on failure.
 */
export async function requireAuth() {
  const session = await getSessionFromCookies()
  if (!session) {
    return { error: 'Unauthorized', status: 401 }
  }
  return { user: session }
}

/**
 * Server-side admin guard. Returns { user } on success or { error, status } on failure.
 * Uses the role embedded in the JWT — no DB round-trip required.
 */
export async function requireAdmin() {
  const session = await getSessionFromCookies()
  if (!session) {
    return { error: 'Unauthorized', status: 401 }
  }
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  return { user: session }
}

/**
 * Require admin authentication with DB role verification.
 * Returns { user } on success or { error, status } on failure.
 */
export async function requireAdminAuth() {
  const auth = await requireAuth()
  if (auth.error) return auth
  if (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN') {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  return auth
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload
  } catch (error) {
    return null
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE_NAME)

  if (!sessionCookie) {
    console.log('[auth] no session cookie found')
    return null
  }

  console.log('[auth] session cookie found, verifying...')
  const session = await verifySession(sessionCookie.value)
  if (!session) {
    console.log('[auth] session verification failed (invalid or expired)')
  } else {
    console.log('[auth] session verified for user:', session.email || session.userId)
  }
  return session
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  }
}

export { COOKIE_NAME }
