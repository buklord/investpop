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
    return new PrismaClient()
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
