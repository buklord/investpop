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

function createPrismaClient() {
  try {
    // Set a short connection timeout so paused Supabase projects fail fast
    // instead of hanging for 30+ seconds and causing browser "Network error".
    // The timeout is appended to DATABASE_URL only when not already present.
    const dbUrl = process.env.DATABASE_URL || ''
    const urlWithTimeout = dbUrl && !dbUrl.includes('connect_timeout')
      ? `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connect_timeout=10`
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
