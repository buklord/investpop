import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Custom error thrown when the Prisma client can't initialise (e.g. DATABASE_URL not set)
export class DatabaseConfigError extends Error {
  constructor(cause) {
    super('Database not configured. Check DATABASE_URL in your .env file.')
    this.name = 'DatabaseConfigError'
    // Log the original cause server-side only — never sent to clients
    this._cause = cause
  }
}

// ─── Connection-error detection ───────────────────────────────────────────────
// Supabase free-tier projects pause after 1 week of inactivity and need up to
// 30 s to cold-start.  These error codes / messages signal that the DB is
// unreachable / waking up — they are safe to retry.
const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])

export function isConnectionError(err) {
  if (!err) return false
  if (err instanceof DatabaseConfigError) return false
  const msg = (err.message || '').toLowerCase()
  const code = err.code || ''
  return (
    RETRYABLE_PRISMA_CODES.has(code) ||
    msg.includes('connect timeout') ||
    msg.includes('connection timeout') ||
    msg.includes('connection timed out') ||
    msg.includes('connection pool timed out') ||
    msg.includes('econnrefused') ||
    msg.includes('connection refused') ||
    msg.includes('connection reset') ||
    msg.includes('etimedout') ||
    msg.includes('server closed the connection') ||
    msg.includes("can't reach database") ||
    msg.includes('database server is unreachable') ||
    msg.includes('socket hang up')
  )
}

// ─── withRetry ────────────────────────────────────────────────────────────────
// Wraps a DB callback.  On a transient connection error it disconnects Prisma
// (forcing a fresh pool on the next call), waits, and retries up to `retries`
// times.  This allows the app to survive a Supabase cold-start without the
// user seeing an error.
export async function withRetry(fn, retries = 3) {
  const delays = [3000, 8000, 15000]
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isLast = attempt === retries
      if (!isConnectionError(err) || isLast) throw err
      const wait = delays[attempt] ?? 15000
      console.warn(
        `[db] Connection error — attempt ${attempt + 1}/${retries}, retrying in ${wait / 1000}s...`,
        err.message
      )
      // Disconnect so Prisma creates a fresh connection pool on the next call
      try { await getPrisma().$disconnect() } catch (_) {}
      // Also reset the cached client so we get a brand-new instance
      globalForPrisma.prisma = createPrismaClient()
      await new Promise(r => setTimeout(r, wait))
    }
  }
}

function createPrismaClient() {
  try {
    // Give Supabase 30 s to cold-start.  Prisma's default is only a few seconds
    // which is too short for a paused free-tier project.
    const dbUrl = process.env.DATABASE_URL || ''
    const urlWithTimeout = dbUrl && !dbUrl.includes('connect_timeout')
      ? `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connect_timeout=30`
      : dbUrl
    return new PrismaClient({
      datasources: dbUrl ? { db: { url: urlWithTimeout } } : undefined,
    })
  } catch (err) {
    console.error('[db] PrismaClient failed to initialise:', err.message)
    console.error('[db] Make sure DATABASE_URL is set and correctly formatted in your .env file.')
    // Return a proxy so the module loads without crashing. Any method call
    // throws a DatabaseConfigError that the route handler can catch cleanly.
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return undefined // not a Promise
        return () => { throw new DatabaseConfigError(err) }
      }
    })
  }
}

// Use a getter so callers always get the current (possibly reset) instance
export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = globalForPrisma.prisma ?? prisma

export default prisma
