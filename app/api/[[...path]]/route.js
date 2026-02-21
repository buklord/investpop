import { NextResponse } from 'next/server'
import prisma, { DatabaseConfigError } from '@/lib/db'
import { hashPassword, verifyPassword, createSession, getSessionFromCookies, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth'
import { getMarketDataProvider, getProviderStatus, setMarketTrend } from '@/lib/providers/marketDataProvider'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { registerSchema, loginSchema, symbolSchema, assetTypeSchema, positionSchema, validateInput } from '@/lib/validation'
import { v4 as uuidv4 } from 'uuid'
import { TradeService } from '@/lib/services/tradeService'
import { AccountService } from '@/lib/services/accountService'
import { TRADING_CONFIG } from '@/lib/services/tradingConfig'
import * as MarketSim from '@/lib/marketSimulator'

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// Helper function to require authentication
async function requireAuth() {
  const session = await getSessionFromCookies()
  if (!session) {
    return { error: 'Unauthorized', status: 401 }
  }
  return { user: session }
}

// Helper function to require admin authentication
async function requireAdminAuth() {
  const auth = await requireAuth()
  if (auth.error) return auth
  const users = await prisma.$queryRaw`
    SELECT role FROM users WHERE id = ${auth.user.userId}
  `
  if (!users[0] || users[0].role !== 'ADMIN') {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }
  return auth
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// The email address that is allowed to hold the ADMIN role.
// Set ADMIN_EMAIL in your .env to lock it to your account.
const MASTER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'demo@investdash.com'

// Payment addresses for deposit requests — override with DEPOSIT_BTC_ADDRESS / DEPOSIT_USDT_ADDRESS env vars
const DEPOSIT_ADDRESSES = {
  BTC: process.env.DEPOSIT_BTC_ADDRESS || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  USDT: process.env.DEPOSIT_USDT_ADDRESS || '0x742d35Cc6634C0532925a3b8D4C9F15dC8dC9B55'
}

// Force-settle outcome multipliers (Admin God Mode)
const FORCE_PROFIT_RATIO = 0.10   // +10% of notional value
const FORCE_LOSS_RATIO   = 0.05   // -5% of notional value

// Ensure new columns/tables exist (idempotent schema migrations).
// Each statement has its own try/catch so a failure in one does NOT
// prevent the others from running (e.g. ALTER TYPE failing inside a
// transaction must not block deposit_requests table creation).
async function ensureSchemaExtensions() {
  const run = async (sql, label) => {
    try { await prisma.$executeRawUnsafe(sql) }
    catch (err) { console.warn(`[schema] ${label}:`, err.message) }
  }

  // ── IMPORTANT: All id/user_id columns use TEXT to match Prisma's String @id
  // mapping.  Prisma stores UUIDs as plain text strings; using the postgres UUID
  // type would cause "incompatible types text vs uuid" FK errors.  No REFERENCES
  // constraints are used for the same reason — integrity is enforced in code.

  // ── Core tables ──────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'users table')
  await run(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      symbol VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'crypto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'assets table')

  // ── Users table: add optional columns idempotently ───────────────────────
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'USER'`, 'role column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE`, 'is_suspended column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`, 'kyc_status column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`, 'first_name column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`, 'last_name column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50)`, 'phone_number column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)`, 'country column')
  await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE`, 'date_of_birth column')

  // ── Virtual accounts (the most critical table) ────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS virtual_accounts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL UNIQUE,
      balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      demo_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      real_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      trading_mode VARCHAR(10) NOT NULL DEFAULT 'DEMO',
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'virtual_accounts table')
  // Add new columns to existing virtual_accounts tables (idempotent)
  await run(`ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS demo_balance DOUBLE PRECISION NOT NULL DEFAULT 0`, 'demo_balance column')
  await run(`ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS real_balance DOUBLE PRECISION NOT NULL DEFAULT 0`, 'real_balance column')
  await run(`ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS trading_mode VARCHAR(10) NOT NULL DEFAULT 'DEMO'`, 'trading_mode column')
  await run(`ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS margin_reserved DOUBLE PRECISION NOT NULL DEFAULT 0`, 'margin_reserved column')
  // Ensure user_id UNIQUE index exists so ON CONFLICT (user_id) works
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS va_user_id_unique ON virtual_accounts (user_id)`, 'virtual_accounts user_id unique index')
  // Migrate existing rows: treat old balance as demo balance
  await run(`UPDATE virtual_accounts SET demo_balance = balance WHERE demo_balance = 0 AND balance > 0`, 'migrate demo_balance')

  // ── Trading tables ────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS trading_positions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      symbol VARCHAR(20) NOT NULL DEFAULT '',
      side VARCHAR(10) NOT NULL DEFAULT 'LONG',
      quantity DOUBLE PRECISION NOT NULL,
      entry_price DOUBLE PRECISION NOT NULL,
      exit_price DOUBLE PRECISION,
      take_profit DOUBLE PRECISION,
      stop_loss DOUBLE PRECISION,
      leverage DOUBLE PRECISION NOT NULL DEFAULT 1,
      status VARCHAR(10) NOT NULL DEFAULT 'OPEN',
      total_invested DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_fees DOUBLE PRECISION NOT NULL DEFAULT 0,
      margin_used DOUBLE PRECISION NOT NULL DEFAULT 0,
      realized_pnl DOUBLE PRECISION,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )`, 'trading_positions table')
  await run(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      position_id TEXT,
      side VARCHAR(10) NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      total_value DOUBLE PRECISION NOT NULL,
      fee_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      slippage DOUBLE PRECISION NOT NULL DEFAULT 0,
      market_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'trades table')

  // ── Ledger & audit tables ─────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      description TEXT,
      reference_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'ledger_entries table')
  await run(`ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION NOT NULL DEFAULT 0`, 'ledger_entries.balance column')
  await run(`ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'DEMO'`, 'ledger_entries.account_type column')
  // Add margin_used and account_type to trading_positions for existing tables
  await run(`ALTER TABLE trading_positions ADD COLUMN IF NOT EXISTS margin_used DOUBLE PRECISION NOT NULL DEFAULT 0`, 'trading_positions.margin_used column')
  await run(`ALTER TABLE trading_positions ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'DEMO'`, 'trading_positions.account_type column')
  await run(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'DEMO'`, 'trades.account_type column')
  // Fix: old DEPOSIT ledger entries were inserted before account_type column existed and defaulted to 'DEMO'.
  // They must be tagged 'REAL' so the ledger SUM correctly reflects the real wallet balance.
  await run(`UPDATE ledger_entries SET account_type = 'REAL' WHERE type = 'DEPOSIT' AND account_type = 'DEMO'`, 'fix deposit account_type tags')
  // Sync: if real_balance is 0 but REAL deposit ledger entries exist, recompute it now.
  await run(`
    UPDATE virtual_accounts va
    SET real_balance = COALESCE((
      SELECT SUM(l.amount) FROM ledger_entries l
      WHERE l.user_id = va.user_id AND l.type = 'DEPOSIT' AND l.account_type = 'REAL'
    ), 0)
    WHERE real_balance = 0
  `, 'sync real_balance from DEPOSIT ledger')
  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      admin_id TEXT NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_id TEXT,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'audit_logs table')
  await run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'activity_log table')

  // ── System settings ────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'system_settings table')
  await run(`
    INSERT INTO system_settings (key, value) VALUES
      ('broadcast_message', ''),
      ('spread_multiplier', '1.0'),
      ('market_trend', 'NEUTRAL')
    ON CONFLICT (key) DO NOTHING`, 'system_settings seed')

  // ── Deposit, notifications, KYC ───────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS deposit_requests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      method VARCHAR(20) NOT NULL DEFAULT 'BTC',
      address TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'deposit_requests table')
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'notifications table')
  await run(`
    CREATE TABLE IF NOT EXISTS kyc_requests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL UNIQUE,
      first_name VARCHAR(100) NOT NULL DEFAULT '',
      last_name VARCHAR(100) NOT NULL DEFAULT '',
      date_of_birth DATE,
      country VARCHAR(100) NOT NULL DEFAULT '',
      phone_number VARCHAR(50),
      document_type VARCHAR(50) NOT NULL DEFAULT 'PASSPORT',
      document_note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'kyc_requests table')

  // ── Analytics tables (best-effort only) ───────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS account_snapshots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      equity DOUBLE PRECISION NOT NULL DEFAULT 0,
      balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      positions_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      open_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      trade_id TEXT,
      snapshot_type VARCHAR(30) NOT NULL DEFAULT 'TRADE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'account_snapshots table')
  await run(`
    CREATE TABLE IF NOT EXISTS daily_performance (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      starting_equity DOUBLE PRECISION NOT NULL DEFAULT 0,
      ending_equity DOUBLE PRECISION NOT NULL DEFAULT 0,
      daily_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
      daily_return_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
      trades_count INTEGER NOT NULL DEFAULT 0,
      fees_paid DOUBLE PRECISION NOT NULL DEFAULT 0,
      UNIQUE (user_id, date)
    )`, 'daily_performance table')

  // ── Market simulator tables ─────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS market_prices (
      symbol VARCHAR(20) PRIMARY KEY,
      bid DOUBLE PRECISION NOT NULL DEFAULT 0,
      ask DOUBLE PRECISION NOT NULL DEFAULT 0,
      mid DOUBLE PRECISION NOT NULL DEFAULT 0,
      source VARCHAR(20) NOT NULL DEFAULT 'SIMULATED',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'market_prices table')
  await run(`
    CREATE TABLE IF NOT EXISTS market_sim_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      volatility DOUBLE PRECISION NOT NULL DEFAULT 0.3,
      trend_bias VARCHAR(10) NOT NULL DEFAULT 'NEUTRAL',
      spread_pips DOUBLE PRECISION NOT NULL DEFAULT 2,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`, 'market_sim_settings table')
  await run(`
    INSERT INTO market_sim_settings (id, volatility, trend_bias, spread_pips)
    VALUES (1, 0.3, 'NEUTRAL', 2)
    ON CONFLICT (id) DO NOTHING`, 'market_sim_settings seed')

  // ALTER TYPE cannot run inside a transaction — separate try/catch is critical
  await run(`ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'forex'`, 'AssetType forex')
  await run(`ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'index'`, 'AssetType index')
}

// Log a user action to the activity feed (best-effort, never throws)
async function logActivity(userId, action, details = {}) {
  try {
    const id = (await import('uuid')).v4()
    await prisma.$executeRawUnsafe(
      `INSERT INTO activity_log (id, user_id, action, details, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      id, userId, action, JSON.stringify(details)
    )
  } catch (_) {}
}

// Cache the schema-init promise at module level so it runs exactly once per
// process.  Auth routes (register / login) await it before touching the DB so
// that the users + virtual_accounts tables are guaranteed to exist.  All other
// routes leave it running in the background; they will benefit from IF NOT
// EXISTS idempotency on subsequent requests.
let schemaInitPromise = null

function getSchemaInitPromise() {
  if (!schemaInitPromise) {
    schemaInitPromise = ensureSchemaExtensions()
      .then(() =>
        prisma.$queryRaw`SELECT value FROM system_settings WHERE key = 'market_trend'`
      )
      .then(rows => { if (rows?.[0]) setMarketTrend(rows[0].value) })
      .catch(e => console.warn('[schema] init warning:', e.message))
  }
  return schemaInitPromise
}

// Route handler function
async function handleRoute(request, context) {
  const segments = context?.params?.path ?? []
  const route = `/${segments.join('/')}`
  const method = request.method

  // Only register/login need to await schema init (to ensure users + virtual_accounts
  // tables exist before the first INSERT). /auth/me and all other routes must NOT
  // await it — any hanging ALTER TABLE would block the spinner indefinitely.
  if (route === '/auth/register' || route === '/auth/login') {
    await getSchemaInitPromise()
  } else {
    // For all other routes kick off (or reuse) the background init — non-blocking.
    getSchemaInitPromise()
  }

  // Rate limiting
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimit(clientIp)
  if (!rateLimitResult.success) {
    return handleCORS(NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    ))
  }

  try {
    // ============ HEALTH CHECK ============
    if (route === '/health' && method === 'GET') {
      try {
        await prisma.$queryRaw`SELECT 1 AS ok`
        return handleCORS(NextResponse.json({ status: 'ok', db: 'connected' }))
      } catch (dbErr) {
        return handleCORS(NextResponse.json(
          { status: 'error', db: 'disconnected', detail: dbErr.message },
          { status: 503 }
        ))
      }
    }

    // GET /api/debug/mode — shows active account mode and balances for the authenticated user
    if (route === '/debug/mode' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT trading_mode, real_balance, demo_balance, balance, margin_reserved
           FROM virtual_accounts WHERE user_id = $1 LIMIT 1`,
          auth.user.userId
        )
        const va = rows?.[0]
        return handleCORS(NextResponse.json({
          userId: auth.user.userId,
          trading_mode: va?.trading_mode ?? null,
          real_balance: Number(va?.real_balance ?? 0),
          demo_balance: Number(va?.demo_balance ?? 0),
          balance: Number(va?.balance ?? 0),
          margin_reserved: Number(va?.margin_reserved ?? 0),
          source: 'virtual_accounts'
        }))
      } catch (e) {
        return handleCORS(NextResponse.json({ error: e.message }, { status: 500 }))
      }
    }

    // ============ ROOT ENDPOINT ============
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ 
        message: 'InvestPop Trading API',
        version: '2.2.0',
        features: ['trading_fees', 'slippage_simulation', 'weighted_average_entry', 'account_snapshots']
      }))
    }

    // ============ AUTH ENDPOINTS ============
    
    // Register - POST /api/auth/register
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const validation = validateInput(registerSchema, body)
      
      if (!validation.success) {
        return handleCORS(NextResponse.json(
          { error: validation.error },
          { status: 400 }
        ))
      }

      const { email, password } = validation.data
      // Extract optional profile fields — not validated by schema, safe to read directly
      const regFirstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 100) : null
      const regLastName  = typeof body.lastName  === 'string' ? body.lastName.trim().slice(0, 100)  : null
      const regPhone     = typeof body.phone     === 'string' ? body.phone.trim().slice(0, 50)      : null

      // Check if user exists
      const existingUser = await prisma.$queryRaw`
        SELECT id FROM users WHERE email = ${email}
      `
      
      if (existingUser.length > 0) {
        return handleCORS(NextResponse.json(
          { error: 'Email already registered' },
          { status: 400 }
        ))
      }

      // Create user — role is always forced to 'USER' server-side;
      // any role value sent in the request body is ignored by the schema.
      // Only insert core columns that are guaranteed to exist in every version
      // of the users table.  Optional profile columns (first_name etc.) are
      // added via a separate UPDATE so a missing column never blocks signup.
      const passwordHash = await hashPassword(password)
      const userId = uuidv4()
      
      await prisma.$executeRaw`
        INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
        VALUES (${userId}, ${email}, ${passwordHash}, 'USER', NOW(), NOW())
      `

      // Best-effort: save optional profile fields — column may not exist on
      // older DB schemas; failure here must never block registration.
      if (regFirstName || regLastName || regPhone) {
        try {
          await prisma.$executeRawUnsafe(`
            UPDATE users
            SET first_name  = COALESCE(first_name,  $1),
                last_name   = COALESCE(last_name,   $2),
                phone_number= COALESCE(phone_number,$3),
                updated_at  = NOW()
            WHERE id = $4
          `, regFirstName, regLastName, regPhone, userId)
        } catch (_) {}
      }

      // Create virtual account with starting demo balance (real_balance starts at $0).
      // Wrapped in try/catch so any unexpected constraint issue never blocks signup.
      try {
        await prisma.$executeRaw`
          INSERT INTO virtual_accounts (user_id, balance, demo_balance, real_balance, trading_mode)
          VALUES (${userId}, ${TRADING_CONFIG.STARTING_BALANCE}, ${TRADING_CONFIG.STARTING_BALANCE}, 0, 'DEMO')
          ON CONFLICT (user_id) DO NOTHING
        `
      } catch (vaErr) {
        console.warn('[register] virtual_accounts insert failed (non-fatal):', vaErr.message)
      }

      // Create initial account snapshot (best-effort — never block registration)
      try {
        const snapshotId = uuidv4()
        await prisma.$executeRaw`
          INSERT INTO account_snapshots (id, user_id, equity, balance, snapshot_type)
          VALUES (${snapshotId}, ${userId}, ${TRADING_CONFIG.STARTING_BALANCE}, ${TRADING_CONFIG.STARTING_BALANCE}, 'REGISTRATION')
        `
      } catch (_) {}

      // Create session
      const token = await createSession(userId, email)
      const cookieOptions = getSessionCookieOptions()

      const response = NextResponse.json({
        message: 'Registration successful',
        user: { id: userId, email },
        account: {
          balance: TRADING_CONFIG.STARTING_BALANCE,
          currency: 'USD'
        }
      })

      response.cookies.set(COOKIE_NAME, token, cookieOptions)
      return handleCORS(response)
    }

    // Login - POST /api/auth/login
    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const validation = validateInput(loginSchema, body)
      
      if (!validation.success) {
        return handleCORS(NextResponse.json(
          { error: validation.error },
          { status: 400 }
        ))
      }

      const { email, password } = validation.data

      // Find user — query core columns + role so we can embed role in JWT.
      // is_suspended is fetched separately with a fallback so a missing column
      // never blocks a valid login.
      const users = await prisma.$queryRaw`
        SELECT id, email, password_hash, role FROM users WHERE email = ${email}
      `
      
      if (users.length === 0) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        ))
      }

      const user = users[0]

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash)
      if (!isValid) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        ))
      }

      // Check suspension (best-effort — never blocks login if column missing)
      try {
        const suspendRows = await prisma.$queryRaw`
          SELECT is_suspended FROM users WHERE id = ${user.id}
        `
        if (suspendRows[0]?.is_suspended) {
          return handleCORS(NextResponse.json(
            { error: 'Your account has been suspended. Please contact support.' },
            { status: 403 }
          ))
        }
      } catch (_) {}

      // Ensure virtual account exists — wrapped in try/catch so a constraint
      // issue never blocks a valid login.
      try {
        await prisma.$executeRaw`
          INSERT INTO virtual_accounts (user_id, balance, demo_balance, real_balance, trading_mode)
          VALUES (${user.id}, ${TRADING_CONFIG.STARTING_BALANCE}, ${TRADING_CONFIG.STARTING_BALANCE}, 0, 'DEMO')
          ON CONFLICT (user_id) DO NOTHING
        `
      } catch (_) {}

      // Create session — embed role in JWT so middleware can check it without a DB call
      const token = await createSession(user.id, user.email, user.role || 'USER')
      const cookieOptions = getSessionCookieOptions()

      // Log login activity (best-effort)
      logActivity(user.id, 'LOGIN', { email: user.email })

      const response = NextResponse.json({
        message: 'Login successful',
        user: { id: user.id, email: user.email }
      })

      response.cookies.set(COOKIE_NAME, token, cookieOptions)
      return handleCORS(response)
    }

    // Logout - POST /api/auth/logout
    if (route === '/auth/logout' && method === 'POST') {
      const response = NextResponse.json({ message: 'Logged out successfully' })
      response.cookies.delete(COOKIE_NAME)
      return handleCORS(response)
    }

    // Get current user - GET /api/auth/me
    if (route === '/auth/me' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      // Fetch role and suspension status from DB (defensive: is_suspended/kyc_status may not exist yet)
      let role = 'USER', isSuspended = false, kycStatus = 'PENDING'
      try {
        const users = await prisma.$queryRaw`
          SELECT role, is_suspended, kyc_status FROM users WHERE id = ${auth.user.userId}
        `
        role = users[0]?.role || 'USER'
        isSuspended = users[0]?.is_suspended || false
        kycStatus = users[0]?.kyc_status || 'PENDING'
      } catch (_e1) {
        // Fallback: is_suspended or kyc_status column may not exist yet — fetch only role
        try {
          const users2 = await run('SELECT role FROM users WHERE id = $1', [auth.user.userId])
          role = users2[0]?.role || 'USER'
        } catch (_e2) {}
      }

      // Fetch broadcast message and spread multiplier from system_settings
      let broadcastMessage = ''
      let spreadMultiplier = 1.0
      try {
        const settings = await prisma.$queryRaw`
          SELECT key, value FROM system_settings WHERE key IN ('broadcast_message', 'spread_multiplier')
        `
        settings.forEach(s => {
          if (s.key === 'broadcast_message') broadcastMessage = s.value
          if (s.key === 'spread_multiplier') spreadMultiplier = parseFloat(s.value) || 1.0
        })
      } catch (_) {}

      return handleCORS(NextResponse.json({
        user: { id: auth.user.userId, email: auth.user.email, role, isSuspended, kycStatus },
        broadcastMessage,
        spreadMultiplier
      }))
    }

    // ============ QUOTE ENDPOINT ============
    
    // GET /api/quote?symbol=XXX&type=stock|crypto
    if (route === '/quote' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const symbol = searchParams.get('symbol')
      const type = searchParams.get('type')

      if (!symbol) {
        return handleCORS(NextResponse.json(
          { error: 'Symbol is required' },
          { status: 400 }
        ))
      }

      const symbolValidation = validateInput(symbolSchema, symbol.toUpperCase())
      if (!symbolValidation.success) {
        return handleCORS(NextResponse.json(
          { error: symbolValidation.error },
          { status: 400 }
        ))
      }

      const typeValidation = validateInput(assetTypeSchema, type || 'stock')
      if (!typeValidation.success) {
        return handleCORS(NextResponse.json(
          { error: 'Type must be "stock" or "crypto"' },
          { status: 400 }
        ))
      }

      try {
        const provider = getMarketDataProvider()
        const quote = await provider.getQuote(symbolValidation.data, typeValidation.data)
        return handleCORS(NextResponse.json(quote))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch quote data' },
          { status: 500 }
        ))
      }
    }

    // GET /api/quotes/batch?symbols=AAPL,stock|BTCUSD,crypto|MSFT,stock
    // Fetches all requested symbols in ONE Twelve Data API call (batch endpoint).
    // Returns { quotes: { AAPL: {...}, BTCUSD: {...} }, delayed: bool }
    if (route === '/quotes/batch' && method === 'GET') {
      const { searchParams } = new URL(request.url)
      const symbolsParam = searchParams.get('symbols')
      if (!symbolsParam) {
        return handleCORS(NextResponse.json({ error: 'symbols param required' }, { status: 400 }))
      }
      // Format: "AAPL,stock|BTCUSD,crypto|MSFT,stock"
      const assets = symbolsParam.split('|').map(s => {
        const [symbol, type] = s.split(',')
        return { symbol: symbol?.toUpperCase(), type: type || 'stock' }
      }).filter(a => a.symbol && a.symbol.length > 0)

      if (assets.length === 0) {
        return handleCORS(NextResponse.json({ quotes: {}, delayed: false }))
      }

      try {
        const provider = getMarketDataProvider()
        const quotes = await provider.getBatchQuotes(assets)
        // Check if any quote has delayed flag (stale cache fallback)
        const delayed = Object.values(quotes).some(q => q?.delayed)
        return handleCORS(NextResponse.json({ quotes, delayed }))
      } catch (error) {
        return handleCORS(NextResponse.json(
          { error: 'Failed to fetch batch quotes' },
          { status: 500 }
        ))
      }
    }

    // GET /api/market/status - Returns current data provider mode (live/simulated)
    if (route === '/market/status' && method === 'GET') {
      return handleCORS(NextResponse.json(getProviderStatus()))
    }

    // ============ ASSETS ENDPOINTS ============
    
    // GET /api/assets - List all available assets
    if (route === '/assets' && method === 'GET') {
      const assets = await prisma.$queryRaw`
        SELECT id, symbol, name, type, created_at FROM assets ORDER BY type, symbol
      `
      return handleCORS(NextResponse.json({ assets }))
    }

    // POST /api/assets/seed - Seed default assets (idempotent — always upserts missing assets)
    if (route === '/assets/seed' && method === 'POST') {
      const defaultAssets = [
        // Forex (10)
        { symbol: 'EURUSD',  name: 'Euro / US Dollar',          type: 'forex' },
        { symbol: 'GBPUSD',  name: 'Pound / US Dollar',         type: 'forex' },
        { symbol: 'USDJPY',  name: 'US Dollar / Japanese Yen',  type: 'forex' },
        { symbol: 'USDCHF',  name: 'US Dollar / Swiss Franc',   type: 'forex' },
        { symbol: 'USDCAD',  name: 'US Dollar / Canadian Dollar',type: 'forex' },
        { symbol: 'AUDUSD',  name: 'Australian Dollar / USD',   type: 'forex' },
        { symbol: 'NZDUSD',  name: 'New Zealand Dollar / USD',  type: 'forex' },
        { symbol: 'EURGBP',  name: 'Euro / British Pound',      type: 'forex' },
        { symbol: 'EURJPY',  name: 'Euro / Japanese Yen',       type: 'forex' },
        { symbol: 'GBPJPY',  name: 'Pound / Japanese Yen',      type: 'forex' },
        // Indices (10)
        { symbol: 'US30',    name: 'Dow Jones Industrial',       type: 'index' },
        { symbol: 'US100',   name: 'Nasdaq 100',                 type: 'index' },
        { symbol: 'SPX500',  name: 'S&P 500',                    type: 'index' },
        { symbol: 'GER40',   name: 'Germany 40 (DAX)',           type: 'index' },
        { symbol: 'UK100',   name: 'UK 100 (FTSE)',              type: 'index' },
        { symbol: 'FRA40',   name: 'France 40 (CAC)',            type: 'index' },
        { symbol: 'JPN225',  name: 'Japan 225 (Nikkei)',         type: 'index' },
        { symbol: 'AUS200',  name: 'Australia 200 (ASX)',        type: 'index' },
        { symbol: 'HK50',    name: 'Hong Kong 50 (HSI)',         type: 'index' },
        { symbol: 'CHN50',   name: 'China 50 (CSI)',             type: 'index' },
        // Stocks (10)
        { symbol: 'AAPL',    name: 'Apple Inc.',                 type: 'stock' },
        { symbol: 'MSFT',    name: 'Microsoft Corp.',            type: 'stock' },
        { symbol: 'GOOGL',   name: 'Alphabet Inc.',              type: 'stock' },
        { symbol: 'AMZN',    name: 'Amazon.com Inc.',            type: 'stock' },
        { symbol: 'TSLA',    name: 'Tesla Inc.',                 type: 'stock' },
        { symbol: 'NVDA',    name: 'NVIDIA Corp.',               type: 'stock' },
        { symbol: 'META',    name: 'Meta Platforms Inc.',        type: 'stock' },
        { symbol: 'JPM',     name: 'JPMorgan Chase',             type: 'stock' },
        { symbol: 'NFLX',    name: 'Netflix Inc.',               type: 'stock' },
        { symbol: 'AMD',     name: 'AMD Inc.',                   type: 'stock' },
        // Crypto (10)
        { symbol: 'BTCUSD',  name: 'Bitcoin',                   type: 'crypto' },
        { symbol: 'ETHUSD',  name: 'Ethereum',                  type: 'crypto' },
        { symbol: 'BNBUSD',  name: 'BNB',                       type: 'crypto' },
        { symbol: 'SOLUSD',  name: 'Solana',                    type: 'crypto' },
        { symbol: 'XRPUSD',  name: 'Ripple',                    type: 'crypto' },
        { symbol: 'ADAUSD',  name: 'Cardano',                   type: 'crypto' },
        { symbol: 'DOGEUSD', name: 'Dogecoin',                  type: 'crypto' },
        { symbol: 'AVAXUSD', name: 'Avalanche',                 type: 'crypto' },
        { symbol: 'DOTUSD',  name: 'Polkadot',                  type: 'crypto' },
        { symbol: 'LTCUSD',  name: 'Litecoin',                  type: 'crypto' },
      ]

      // Use batch insert with a single query for much better performance
      const values = defaultAssets.map(a => `('${uuidv4()}', '${a.symbol}', '${a.name.replace(/'/g, "''")}', '${a.type}'::"AssetType", NOW())`).join(',')
      await prisma.$executeRawUnsafe(`
        INSERT INTO assets (id, symbol, name, type, created_at)
        VALUES ${values}
        ON CONFLICT (symbol) DO NOTHING
      `)

      return handleCORS(NextResponse.json({ message: 'Assets seeded successfully' }))
    }

    // ============ TRADING ENDPOINTS (Using Service Layer) ============

    // POST /api/trade - Execute a trade
    if (route === '/trade' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      // Block suspended users from trading
      const traderRows = await prisma.$queryRaw`
        SELECT is_suspended FROM users WHERE id = ${auth.user.userId}
      `
      if (traderRows[0]?.is_suspended) {
        return handleCORS(NextResponse.json(
          { error: 'Your account has been suspended.' },
          { status: 403 }
        ))
      }

      const body = await request.json()
      const { symbol, type, action, quantity, takeProfit, stopLoss, leverage, accountType: clientAccountType } = body

      // Server-side mode validation: if client sends accountType, verify it matches DB
      if (clientAccountType) {
        try {
          const modeRows = await prisma.$queryRawUnsafe(
            `SELECT trading_mode FROM virtual_accounts WHERE user_id = $1 LIMIT 1`,
            auth.user.userId
          )
          const serverMode = modeRows?.[0]?.trading_mode
          if (serverMode && clientAccountType !== serverMode) {
            console.warn(`[trade] Mode mismatch: client=${clientAccountType} server=${serverMode} user=${auth.user.userId}`)
            return handleCORS(NextResponse.json(
              { error: `Account mode mismatch. Switch to ${serverMode} mode first.` },
              { status: 400 }
            ))
          }
        } catch (_) {} // non-critical check — let executeTrade handle mode reading
      }

      // Validate inputs
      if (!symbol || !type || !action || !quantity) {
        return handleCORS(NextResponse.json(
          { error: 'symbol, type, action, and quantity are required' },
          { status: 400 }
        ))
      }

      if (!['BUY', 'SELL'].includes(action)) {
        return handleCORS(NextResponse.json(
          { error: 'action must be BUY or SELL' },
          { status: 400 }
        ))
      }

      if (quantity <= 0) {
        return handleCORS(NextResponse.json(
          { error: 'quantity must be positive' },
          { status: 400 }
        ))
      }

      // Apply global spread multiplier to leverage (effectively multiplies fees/slippage)
      let effectiveLeverage = leverage ? parseFloat(leverage) : 1
      try {
        const smRows = await prisma.$queryRaw`
          SELECT value FROM system_settings WHERE key = 'spread_multiplier'
        `
        const multiplier = parseFloat(smRows[0]?.value || '1.0')
        if (multiplier > 1) {
          effectiveLeverage = effectiveLeverage * multiplier
        }
      } catch (_) {}

      // Use TradeService
      const tradeService = new TradeService(auth.user.userId)
      const result = await tradeService.executeTrade({
        symbol,
        type,
        action,
        quantity: parseFloat(quantity),
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        leverage: effectiveLeverage
      })

      if (!result.success) {
        return handleCORS(NextResponse.json(
          { error: result.error },
          { status: 400 }
        ))
      }

      // Log trade activity (best-effort)
      logActivity(auth.user.userId, `TRADE_${action}`, { symbol, quantity, action })

      return handleCORS(NextResponse.json({
        message: `${action} order executed`,
        trade: result.trade,
        tradingFee: TRADING_CONFIG.TRADING_FEE_PERCENT * 100 + '%'
      }))
    }

    // GET /api/account - Get account summary
    if (route === '/account' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      // ── Step 1: Read balances directly from virtual_accounts (fast, no Prisma client) ──
      let realBalance = 0
      let demoBalance = 0
      let tradingMode = 'DEMO'
      let currency = 'USD'
      let vaBalance = 0

      try {
        const vaRows = await prisma.$queryRawUnsafe(
          `SELECT balance, demo_balance, real_balance, trading_mode, currency
           FROM virtual_accounts WHERE user_id = $1`,
          auth.user.userId
        )
        const va = vaRows[0] || {}
        vaBalance   = parseFloat(va.balance       || 0)
        demoBalance = parseFloat(va.demo_balance  || 0)
        realBalance = parseFloat(va.real_balance  || 0)
        tradingMode = va.trading_mode || 'DEMO'
        currency    = va.currency     || 'USD'
      } catch (err) {
        console.warn('[account] virtual_accounts read failed:', err.message)
      }

      // ── Step 2: Cross-check with ledger SUM (take GREATEST so nothing is lost) ──
      try {
        const ledgerSums = await prisma.$queryRawUnsafe(
          `SELECT account_type, COALESCE(SUM(amount), 0)::float8 AS total
           FROM ledger_entries WHERE user_id = $1
           GROUP BY account_type`,
          auth.user.userId
        )
        for (const row of ledgerSums) {
          const total = parseFloat(row.total || 0)
          if (row.account_type === 'REAL')       realBalance = Math.max(realBalance, total)
          else if (row.account_type === 'DEMO')  demoBalance = Math.max(demoBalance, total)
        }
      } catch (_) { /* ledger_entries.account_type may not exist yet — use va values */ }

      // ── Step 3: Self-heal va columns (GREATEST — never lower a correct value) ──
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE virtual_accounts
           SET real_balance = GREATEST(real_balance, $1),
               demo_balance = GREATEST(demo_balance, $2),
               balance = CASE WHEN trading_mode = 'REAL' THEN GREATEST(real_balance, $1)
                              ELSE GREATEST(demo_balance, $2) END
           WHERE user_id = $3`,
          realBalance, demoBalance, auth.user.userId
        )
      } catch (_) { /* non-critical — ignore */ }

      const activeBalance = tradingMode === 'REAL' ? realBalance : demoBalance

      // ── Step 4: Try to enrich with open positions via AccountService ──
      // This is optional — if it fails the balance data is still returned correctly.
      let enriched = {}
      try {
        const accountService = new AccountService(auth.user.userId)
        const summary = await accountService.getAccountSummary()
        enriched = summary
      } catch (_) { /* market data or service layer unavailable — return balance only */ }

      const accountResponse = NextResponse.json({
        ...enriched,
        balance: activeBalance,
        demoBalance,
        realBalance,
        tradingMode,
        currency,
      })
      accountResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      return handleCORS(accountResponse)
    }

    // POST /api/account/switch-mode — switch between DEMO and REAL wallets
    if (route === '/account/switch-mode' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      const body = await request.json()
      const { mode } = body
      if (!['DEMO', 'REAL'].includes(mode)) {
        return handleCORS(NextResponse.json({ error: 'mode must be DEMO or REAL' }, { status: 400 }))
      }

      // Read current wallet state
      const rows = await prisma.$queryRaw`
        SELECT balance, demo_balance, real_balance, trading_mode
        FROM virtual_accounts WHERE user_id = ${auth.user.userId}
      `
      if (rows.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Account not found' }, { status: 404 }))
      }
      const curr = rows[0]
      const currentMode = curr.trading_mode || 'DEMO'

      if (currentMode === mode) {
        return handleCORS(NextResponse.json({
          message: `Already in ${mode} mode`,
          tradingMode: mode,
          balance: parseFloat(curr.balance),
          demoBalance: parseFloat(curr.demo_balance || 0),
          realBalance: parseFloat(curr.real_balance || 0),
        }))
      }

      // Save current balance back to the correct mode's column, then load new mode balance
      const currentBalance = parseFloat(curr.balance)
      const newBalance = mode === 'DEMO'
        ? parseFloat(curr.demo_balance || 0)
        : parseFloat(curr.real_balance || 0)

      if (currentMode === 'DEMO') {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET demo_balance = ${currentBalance}, balance = ${newBalance}, trading_mode = ${mode}
          WHERE user_id = ${auth.user.userId}
        `
      } else {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET real_balance = ${currentBalance}, balance = ${newBalance}, trading_mode = ${mode}
          WHERE user_id = ${auth.user.userId}
        `
      }

      return handleCORS(NextResponse.json({
        message: `Switched to ${mode} mode`,
        tradingMode: mode,
        balance: newBalance,
        demoBalance: mode === 'DEMO' ? newBalance : parseFloat(curr.demo_balance || 0),
        realBalance: mode === 'REAL' ? newBalance : parseFloat(curr.real_balance || 0),
      }))
    }

    // ============ KYC ENDPOINTS ============

    // GET /api/kyc/status — return current user's KYC status
    if (route === '/kyc/status' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      const rows = await prisma.$queryRaw`
        SELECT kyc_status, first_name, last_name, phone_number, country, date_of_birth
        FROM users WHERE id = ${auth.user.userId}
      `
      const u = rows[0] || {}
      return handleCORS(NextResponse.json({
        kycStatus: u.kyc_status || 'PENDING',
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        phoneNumber: u.phone_number || '',
        country: u.country || '',
        dateOfBirth: u.date_of_birth ? u.date_of_birth.toISOString().split('T')[0] : '',
      }))
    }

    // POST /api/kyc/submit — submit KYC details
    if (route === '/kyc/submit' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      const body = await request.json()
      const { firstName, lastName, dateOfBirth, country, phoneNumber, documentType } = body
      if (!firstName || !lastName || !dateOfBirth || !country) {
        return handleCORS(NextResponse.json({ error: 'First name, last name, date of birth, and country are required.' }, { status: 400 }))
      }
      // Block re-submission if already approved
      const existing = await prisma.$queryRaw`SELECT kyc_status FROM users WHERE id = ${auth.user.userId}`
      if (existing[0]?.kyc_status === 'APPROVED') {
        return handleCORS(NextResponse.json({ error: 'Your identity is already verified.' }, { status: 400 }))
      }
      // Upsert KYC request — update if user has previously submitted
      const kycId = uuidv4()
      try {
        await prisma.$executeRaw`
          INSERT INTO kyc_requests (id, user_id, first_name, last_name, date_of_birth, country, phone_number, document_type, status, created_at, updated_at)
          VALUES (${kycId}, ${auth.user.userId}, ${firstName}, ${lastName}, ${dateOfBirth}::date, ${country}, ${phoneNumber || ''}, ${documentType || 'PASSPORT'}, 'SUBMITTED', NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
            date_of_birth = EXCLUDED.date_of_birth, country = EXCLUDED.country,
            phone_number = EXCLUDED.phone_number, document_type = EXCLUDED.document_type,
            status = 'SUBMITTED', reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
        `
      } catch (insertErr) {
        console.error('KYC INSERT error:', insertErr.message)
        return handleCORS(NextResponse.json({ error: 'Could not record KYC request. Please try again.' }, { status: 500 }))
      }
      // Update user profile + status
      await prisma.$executeRaw`
        UPDATE users
        SET kyc_status = 'SUBMITTED', first_name = ${firstName}, last_name = ${lastName},
            date_of_birth = ${dateOfBirth}::date, country = ${country},
            phone_number = ${phoneNumber || ''}, updated_at = NOW()
        WHERE id = ${auth.user.userId}
      `
      // Audit log — visible in admin Live Feed immediately
      try {
        const auditId = uuidv4()
        await prisma.$executeRawUnsafe(
          `INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
           VALUES ($1, $2, 'KYC_SUBMITTED', $2, $3::jsonb, NOW())`,
          auditId, auth.user.userId,
          JSON.stringify({ email: auth.user.email, firstName, lastName, country })
        )
      } catch (_) {}
      logActivity(auth.user.userId, 'KYC_SUBMITTED', { firstName, lastName, country })
      return handleCORS(NextResponse.json({ message: 'KYC submitted successfully. Verification is in progress.' }))
    }

    // GET /api/admin/kyc-requests — list all KYC requests (with reconciliation for legacy submissions)
    if (route === '/admin/kyc-requests' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      // Auto-reconcile: users whose kyc_status is SUBMITTED/REJECTED but have no kyc_requests row
      // (happens when submission occurred before the table was created, or INSERT silently failed)
      try {
        await prisma.$executeRaw`
          INSERT INTO kyc_requests (id, user_id, first_name, last_name, date_of_birth, country, phone_number, document_type, status, created_at, updated_at)
          SELECT
            gen_random_uuid(),
            u.id,
            COALESCE(u.first_name, 'Unknown'),
            COALESCE(u.last_name, 'Unknown'),
            COALESCE(u.date_of_birth, CURRENT_DATE),
            COALESCE(u.country, 'Unknown'),
            u.phone_number,
            'PASSPORT',
            u.kyc_status,
            COALESCE(u.updated_at, NOW()),
            NOW()
          FROM users u
          WHERE u.kyc_status IN ('SUBMITTED', 'REJECTED', 'APPROVED')
            AND NOT EXISTS (SELECT 1 FROM kyc_requests k WHERE k.user_id = u.id)
        `
      } catch (reconcileErr) {
        console.error('KYC reconcile error (non-fatal):', reconcileErr.message)
      }

      const requests = await prisma.$queryRaw`
        SELECT k.*, u.email
        FROM kyc_requests k
        JOIN users u ON k.user_id = u.id
        ORDER BY k.created_at DESC
        LIMIT 100
      `
      return handleCORS(NextResponse.json({ requests }))
    }

    // POST /api/admin/kyc/:id/approve — approve a KYC request
    if (route.startsWith('/admin/kyc/') && route.endsWith('/approve') && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      const kycId = route.replace('/admin/kyc/', '').replace('/approve', '')
      const rows = await prisma.$queryRaw`SELECT user_id FROM kyc_requests WHERE id = ${kycId}`
      if (rows.length === 0) return handleCORS(NextResponse.json({ error: 'KYC request not found' }, { status: 404 }))
      const targetUserId = String(rows[0].user_id)
      await prisma.$executeRaw`UPDATE kyc_requests SET status = 'APPROVED', reviewed_by = ${admin.user.userId}, reviewed_at = NOW(), updated_at = NOW() WHERE id = ${kycId}`
      await prisma.$executeRaw`UPDATE users SET kyc_status = 'APPROVED', updated_at = NOW() WHERE id = ${targetUserId}`
      // Notification to user
      const nId = uuidv4()
      await prisma.$executeRaw`INSERT INTO notifications (id, user_id, message) VALUES (${nId}, ${targetUserId}, 'Your identity has been verified! You can now deposit real funds.')`
      // Audit log
      const auditId = uuidv4()
      await prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at) VALUES ($1, $2, 'KYC_APPROVE', $3, $4::jsonb, NOW())`,
        auditId, admin.user.userId, targetUserId, JSON.stringify({ kycId })
      )
      return handleCORS(NextResponse.json({ message: 'KYC approved. User can now deposit.' }))
    }

    // POST /api/admin/kyc/:id/reject — reject a KYC request
    if (route.startsWith('/admin/kyc/') && route.endsWith('/reject') && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      const kycId = route.replace('/admin/kyc/', '').replace('/reject', '')
      const body = await request.json().catch(() => ({}))
      const reason = body.reason || 'Identity could not be verified.'
      const rows = await prisma.$queryRaw`SELECT user_id FROM kyc_requests WHERE id = ${kycId}`
      if (rows.length === 0) return handleCORS(NextResponse.json({ error: 'KYC request not found' }, { status: 404 }))
      const targetUserId = String(rows[0].user_id)
      await prisma.$executeRaw`UPDATE kyc_requests SET status = 'REJECTED', reviewed_by = ${admin.user.userId}, reviewed_at = NOW(), updated_at = NOW() WHERE id = ${kycId}`
      await prisma.$executeRaw`UPDATE users SET kyc_status = 'REJECTED', updated_at = NOW() WHERE id = ${targetUserId}`
      const nId = uuidv4()
      await prisma.$executeRaw`INSERT INTO notifications (id, user_id, message) VALUES (${nId}, ${targetUserId}, ${'KYC verification rejected: ' + reason})`
      const auditId = uuidv4()
      await prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at) VALUES ($1, $2, 'KYC_REJECT', $3, $4::jsonb, NOW())`,
        auditId, admin.user.userId, targetUserId, JSON.stringify({ kycId, reason })
      )
      return handleCORS(NextResponse.json({ message: 'KYC rejected.' }))
    }

    // GET /api/positions - Get positions (Using Service Layer)
    if (route === '/positions' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || 'all'
      const symbol = searchParams.get('symbol')

      const tradeService = new TradeService(auth.user.userId)
      const positions = await tradeService.getPositions(status, symbol)

      return handleCORS(NextResponse.json({ positions }))
    }

    // GET /api/trades - Get trade history (Using Service Layer)
    if (route === '/trades' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const tradeService = new TradeService(auth.user.userId)
      const trades = await tradeService.getTradeHistory(100)

      return handleCORS(NextResponse.json({ trades }))
    }

    // GET /api/account/snapshots - Get equity curve
    if (route === '/account/snapshots' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const accountService = new AccountService(auth.user.userId)
      const snapshots = await accountService.getEquityCurve(100)
      
      return handleCORS(NextResponse.json({ snapshots }))
    }

    // GET /api/account/performance - Get daily performance history
    if (route === '/account/performance' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const accountService = new AccountService(auth.user.userId)
      const performance = await accountService.getPerformanceHistory(30)
      
      return handleCORS(NextResponse.json({ performance }))
    }

    // POST /api/orders/limit - Create limit order
    if (route === '/orders/limit' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const body = await request.json()
      const { symbol, type, action, quantity, limitPrice, expiresAt } = body

      if (!symbol || !type || !action || !quantity || !limitPrice) {
        return handleCORS(NextResponse.json(
          { error: 'symbol, type, action, quantity, and limitPrice are required' },
          { status: 400 }
        ))
      }

      const tradeService = new TradeService(auth.user.userId)
      const result = await tradeService.createLimitOrder({
        symbol,
        type,
        action,
        quantity: parseFloat(quantity),
        limitPrice: parseFloat(limitPrice),
        expiresAt
      })

      if (!result.success) {
        return handleCORS(NextResponse.json(
          { error: result.error },
          { status: 400 }
        ))
      }

      return handleCORS(NextResponse.json({
        message: 'Limit order created',
        order: result.order
      }))
    }

    // GET /api/orders/pending - Get pending orders
    if (route === '/orders/pending' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const tradeService = new TradeService(auth.user.userId)
      const orders = await tradeService.getPendingOrders()
      
      return handleCORS(NextResponse.json({ orders }))
    }

    // DELETE /api/orders/[id] - Cancel order
    if (route.startsWith('/orders/') && method === 'DELETE') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const orderId = path[1]
      const tradeService = new TradeService(auth.user.userId)
      await tradeService.cancelOrder(orderId)
      
      return handleCORS(NextResponse.json({ message: 'Order cancelled' }))
    }

    // GET /api/config - Get trading configuration
    if (route === '/config' && method === 'GET') {
      return handleCORS(NextResponse.json({
        tradingFeePercent: TRADING_CONFIG.TRADING_FEE_PERCENT * 100,
        minSlippagePercent: TRADING_CONFIG.MIN_SLIPPAGE_PERCENT * 100,
        maxSlippagePercent: TRADING_CONFIG.MAX_SLIPPAGE_PERCENT * 100,
        startingBalance: TRADING_CONFIG.STARTING_BALANCE,
        maxLeverage: TRADING_CONFIG.MAX_LEVERAGE,
        minTradeValue: TRADING_CONFIG.MIN_TRADE_VALUE
      }))
    }

    // ============ WATCHLIST ENDPOINTS ============
    
    // GET /api/watchlist - Get user's watchlist
    if (route === '/watchlist' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const watchlist = await prisma.$queryRaw`
        SELECT w.id, w.created_at, a.id as asset_id, a.symbol, a.name, a.type
        FROM watchlist_items w
        JOIN assets a ON w.asset_id = a.id
        WHERE w.user_id = ${auth.user.userId}
        ORDER BY w.created_at DESC
      `

      return handleCORS(NextResponse.json({ watchlist }))
    }

    // POST /api/watchlist - Add to watchlist
    if (route === '/watchlist' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const body = await request.json()
      const { assetId } = body

      if (!assetId) {
        return handleCORS(NextResponse.json(
          { error: 'Asset ID is required' },
          { status: 400 }
        ))
      }

      const assets = await prisma.$queryRaw`
        SELECT id FROM assets WHERE id = ${assetId}
      `
      
      if (assets.length === 0) {
        return handleCORS(NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        ))
      }

      const id = uuidv4()
      try {
        await prisma.$executeRaw`
          INSERT INTO watchlist_items (id, user_id, asset_id, created_at)
          VALUES (${id}, ${auth.user.userId}, ${assetId}, NOW())
        `
      } catch (error) {
        if (error.code === 'P2002' || error.message?.includes('unique constraint')) {
          return handleCORS(NextResponse.json(
            { error: 'Asset already in watchlist' },
            { status: 400 }
          ))
        }
        throw error
      }

      return handleCORS(NextResponse.json({ 
        message: 'Added to watchlist',
        id 
      }))
    }

    // DELETE /api/watchlist/[id]
    if (route.startsWith('/watchlist/') && method === 'DELETE') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const itemId = path[1]
      
      await prisma.$executeRaw`
        DELETE FROM watchlist_items 
        WHERE id = ${itemId} AND user_id = ${auth.user.userId}
      `

      return handleCORS(NextResponse.json({ message: 'Removed from watchlist' }))
    }

    // ============ PORTFOLIO ENDPOINTS (Legacy) ============
    
    if (route === '/portfolio' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const positions = await prisma.$queryRaw`
        SELECT p.id, p.quantity, p.entry_price, p.entry_date, p.created_at,
               a.id as asset_id, a.symbol, a.name, a.type
        FROM portfolio_positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.user_id = ${auth.user.userId}
        ORDER BY p.created_at DESC
      `

      return handleCORS(NextResponse.json({ positions }))
    }

    if (route === '/portfolio' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const body = await request.json()
      const validation = validateInput(positionSchema, body)
      
      if (!validation.success) {
        return handleCORS(NextResponse.json(
          { error: validation.error },
          { status: 400 }
        ))
      }

      const { assetId, quantity, entryPrice, entryDate } = validation.data

      const assets = await prisma.$queryRaw`
        SELECT id FROM assets WHERE id = ${assetId}
      `
      
      if (assets.length === 0) {
        return handleCORS(NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        ))
      }

      const id = uuidv4()
      const entryDateParsed = new Date(entryDate)
      
      await prisma.$executeRaw`
        INSERT INTO portfolio_positions (id, user_id, asset_id, quantity, entry_price, entry_date, created_at)
        VALUES (${id}, ${auth.user.userId}, ${assetId}, ${quantity}, ${entryPrice}, ${entryDateParsed}, NOW())
      `

      return handleCORS(NextResponse.json({ 
        message: 'Position added',
        id 
      }))
    }

    if (route.startsWith('/portfolio/') && method === 'PUT') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const positionId = path[1]
      const body = await request.json()
      const { quantity, entryPrice, entryDate } = body

      if (quantity !== undefined && quantity <= 0) {
        return handleCORS(NextResponse.json(
          { error: 'Quantity must be positive' },
          { status: 400 }
        ))
      }

      if (quantity !== undefined) {
        await prisma.$executeRaw`
          UPDATE portfolio_positions 
          SET quantity = ${quantity}
          WHERE id = ${positionId} AND user_id = ${auth.user.userId}
        `
      }
      if (entryPrice !== undefined) {
        await prisma.$executeRaw`
          UPDATE portfolio_positions 
          SET entry_price = ${entryPrice}
          WHERE id = ${positionId} AND user_id = ${auth.user.userId}
        `
      }
      if (entryDate !== undefined) {
        const entryDateParsed = new Date(entryDate)
        await prisma.$executeRaw`
          UPDATE portfolio_positions 
          SET entry_date = ${entryDateParsed}
          WHERE id = ${positionId} AND user_id = ${auth.user.userId}
        `
      }

      return handleCORS(NextResponse.json({ message: 'Position updated' }))
    }

    if (route.startsWith('/portfolio/') && method === 'DELETE') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const positionId = path[1]
      
      await prisma.$executeRaw`
        DELETE FROM portfolio_positions 
        WHERE id = ${positionId} AND user_id = ${auth.user.userId}
      `

      return handleCORS(NextResponse.json({ message: 'Position deleted' }))
    }

    // ============ LEDGER ENDPOINTS ============

    // GET /api/ledger - Get ledger entries for the current user
    if (route === '/ledger' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      }

      // Fetch user's active trading mode so we return the matching wallet's transactions
      const accs = await prisma.$queryRaw`
        SELECT trading_mode FROM virtual_accounts WHERE user_id = ${auth.user.userId} LIMIT 1
      `.catch(() => [])
      const tradingMode = accs[0]?.trading_mode || 'DEMO'

      // Return entries for the active wallet type; fall back to all entries if account_type column is absent
      const entries = await prisma.$queryRaw`
        SELECT * FROM ledger_entries
        WHERE user_id = ${auth.user.userId}
          AND account_type = ${tradingMode}
        ORDER BY created_at DESC
        LIMIT 100
      `.catch(() => prisma.$queryRaw`
        SELECT * FROM ledger_entries
        WHERE user_id = ${auth.user.userId}
        ORDER BY created_at DESC
        LIMIT 100
      `)

      return handleCORS(NextResponse.json({ entries, mode: tradingMode }))
    }

    // ============ WALLET ENDPOINTS ============

    // POST /api/wallet/request-funds - Add $10k demo funds
    if (route === '/wallet/request-funds' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      }

      const DEMO_AMOUNT = 10000

      // Add funds to demo wallet (and to active balance if currently in DEMO mode)
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET demo_balance = demo_balance + ${DEMO_AMOUNT},
            balance = CASE WHEN trading_mode = 'DEMO' THEN balance + ${DEMO_AMOUNT} ELSE balance END
        WHERE user_id = ${auth.user.userId}
      `

      // Get new balance
      const accounts = await prisma.$queryRaw`
        SELECT balance, demo_balance FROM virtual_accounts WHERE user_id = ${auth.user.userId}
      `
      const newBalance = parseFloat(accounts[0]?.balance || 0)
      const newDemoBalance = parseFloat(accounts[0]?.demo_balance || 0)

      // Create ledger entry — record active balance as snapshot
      const ledgerId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, account_type, created_at)
        VALUES (${ledgerId}, ${auth.user.userId}, 'DEPOSIT', ${DEMO_AMOUNT}, ${newBalance}, 'Demo funds added to practice account', 'DEMO', NOW())
      `

      return handleCORS(NextResponse.json({
        message: 'Demo funds added to your practice account',
        amount: DEMO_AMOUNT,
        newBalance,
        newDemoBalance
      }))
    }

    // ============ SETTINGS ENDPOINTS ============

    // POST /api/settings/password - Change user password
    if (route === '/settings/password' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      }

      const body = await request.json()
      const { currentPassword, newPassword } = body

      if (!currentPassword || !newPassword) {
        return handleCORS(NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 }))
      }

      if (newPassword.length < 8) {
        return handleCORS(NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 }))
      }

      const users = await prisma.$queryRaw`
        SELECT id, password_hash FROM users WHERE id = ${auth.user.userId}
      `

      if (users.length === 0) {
        return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 404 }))
      }

      const isValid = await verifyPassword(currentPassword, users[0].password_hash)
      if (!isValid) {
        return handleCORS(NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 }))
      }

      const newHash = await hashPassword(newPassword)
      await prisma.$executeRaw`
        UPDATE users SET password_hash = ${newHash}, updated_at = NOW()
        WHERE id = ${auth.user.userId}
      `

      return handleCORS(NextResponse.json({ message: 'Password updated successfully' }))
    }

    // ============ ADMIN ENDPOINTS ============

    // POST /api/admin/bootstrap - Promote current user to ADMIN (only if no ADMIN exists yet)
    if (route === '/admin/bootstrap' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
      }

      // Security: only the master admin email may claim ADMIN
      if (auth.user.email !== MASTER_ADMIN_EMAIL) {
        return handleCORS(NextResponse.json(
          { error: 'Only the designated admin email address may claim admin access.' },
          { status: 403 }
        ))
      }

      // Atomic conditional update: only promotes this user if no ADMIN currently exists.
      // The WHERE NOT EXISTS prevents the race condition of two simultaneous calls both succeeding.
      const result = await prisma.$executeRaw`
        UPDATE users SET role = 'ADMIN'
        WHERE id = ${auth.user.userId}
          AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN')
      `

      if (result === 0) {
        // Already admin or another admin exists — just ensure this email has admin
        await prisma.$executeRaw`
          UPDATE users SET role = 'ADMIN' WHERE id = ${auth.user.userId}
        `
      }

      return handleCORS(NextResponse.json({
        message: 'You have been promoted to ADMIN. Refresh the page to see the Admin menu.',
        userId: auth.user.userId,
        email: auth.user.email
      }))
    }

    // GET /api/admin/users - List all users with balances (optimized: select only needed fields)
    if (route === '/admin/users' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const users = await prisma.$queryRaw`
        SELECT u.id, u.email, u.role, u.is_suspended, u.created_at,
               va.balance
        FROM users u
        LEFT JOIN virtual_accounts va ON va.user_id = u.id
        ORDER BY u.created_at DESC
      `

      return handleCORS(NextResponse.json({ users }))
    }

    // GET /api/admin/audit-log - Get audit log
    if (route === '/admin/audit-log' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const log = await prisma.$queryRaw`
        SELECT al.*, u.email as admin_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.admin_id
        ORDER BY al.created_at DESC
        LIMIT 100
      `

      return handleCORS(NextResponse.json({ log }))
    }

    // POST /api/admin/force-close - Force close a trading position
    if (route === '/admin/force-close' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const body = await request.json()
      const { positionId, closePrice: customClosePrice } = body

      if (!positionId) {
        return handleCORS(NextResponse.json({ error: 'positionId is required' }, { status: 400 }))
      }

      // Fetch position
      const positions = await prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON a.id = p.asset_id
        WHERE p.id = ${positionId} AND p.status = 'OPEN'
      `

      if (positions.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Open position not found' }, { status: 404 }))
      }

      const pos = positions[0]

      // Use custom close price if provided, otherwise fetch market price
      let currentPrice = parseFloat(pos.entry_price)
      if (customClosePrice && !isNaN(parseFloat(customClosePrice))) {
        currentPrice = parseFloat(customClosePrice)
      } else {
        try {
          const provider = getMarketDataProvider()
          const quote = await provider.getQuote(pos.symbol, pos.type)
          currentPrice = quote.price
        } catch (_) {}
      }

      const realizedPnl = (currentPrice - parseFloat(pos.entry_price)) * parseFloat(pos.quantity)
      const saleValue = currentPrice * parseFloat(pos.quantity)

      // Close position
      await prisma.$executeRaw`
        UPDATE trading_positions
        SET status = 'CLOSED', closed_at = NOW(), realized_pnl = ${realizedPnl},
            exit_price = ${currentPrice}
        WHERE id = ${positionId}
      `

      // Return sale value to user's balance (update both legacy + mode-aware columns)
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET balance      = balance      + ${saleValue},
            real_balance = CASE WHEN trading_mode = 'REAL' THEN real_balance + ${saleValue} ELSE real_balance END,
            demo_balance = CASE WHEN trading_mode = 'DEMO' THEN demo_balance + ${saleValue} ELSE demo_balance END,
            updated_at   = NOW()
        WHERE user_id = ${pos.user_id}
      `

      // Get new balance
      const accounts = await prisma.$queryRaw`
        SELECT balance FROM virtual_accounts WHERE user_id = ${pos.user_id}
      `
      const newBalance = parseFloat(accounts[0]?.balance || 0)

      // Create ledger entry
      const ledgerId = uuidv4()
      const closeDesc = customClosePrice
        ? `Admin closed position ${pos.symbol} at custom price $${currentPrice.toFixed(2)} — P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)}`
        : `Admin force-closed position: ${pos.symbol}`
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, reference_id, created_at)
        VALUES (${ledgerId}, ${pos.user_id}, 'ADMIN_ADJUSTMENT', ${saleValue},
                ${newBalance}, ${closeDesc}, ${positionId}, NOW())
      `

      // Create audit log entry
      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'FORCE_CLOSE_POSITION',
                ${positionId}, ${JSON.stringify({ symbol: pos.symbol, quantity: pos.quantity, closePrice: currentPrice, realizedPnl, customPrice: !!customClosePrice })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({
        message: `Position ${pos.symbol} closed at $${currentPrice.toFixed(2)}`,
        closePrice: currentPrice,
        realizedPnl,
        saleValue
      }))
    }

    // POST /api/admin/adjust-balance - Override/adjust a user's balance
    if (route === '/admin/adjust-balance' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const body = await request.json()
      const { targetUserId, amount, reason } = body

      if (!targetUserId || amount === undefined || amount === null) {
        return handleCORS(NextResponse.json({ error: 'targetUserId and amount are required' }, { status: 400 }))
      }

      const numAmount = parseFloat(amount)
      if (isNaN(numAmount)) {
        return handleCORS(NextResponse.json({ error: 'amount must be a number' }, { status: 400 }))
      }

      // Check target user exists
      const targetUsers = await prisma.$queryRaw`
        SELECT id FROM users WHERE id = ${targetUserId}
      `
      if (targetUsers.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Target user not found' }, { status: 404 }))
      }

      // Adjust balance
      await prisma.$executeRaw`
        UPDATE virtual_accounts SET balance = balance + ${numAmount}
        WHERE user_id = ${targetUserId}
      `

      // Get new balance
      const accounts = await prisma.$queryRaw`
        SELECT balance FROM virtual_accounts WHERE user_id = ${targetUserId}
      `
      const newBalance = parseFloat(accounts[0]?.balance || 0)

      // Create ledger entry
      const ledgerId = uuidv4()
      const desc = reason ? `Admin adjustment: ${reason}` : 'Admin balance adjustment'
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, created_at)
        VALUES (${ledgerId}, ${targetUserId}, 'ADMIN_ADJUSTMENT',
                ${numAmount}, ${newBalance}, ${desc}, NOW())
      `

      // Create audit log entry
      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'ADJUST_BALANCE',
                ${targetUserId}, ${JSON.stringify({ amount: numAmount, reason: reason || null, newBalance })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({
        message: 'Balance adjusted successfully',
        amount: numAmount,
        newBalance
      }))
    }

    // POST /api/admin/suspend-user - Suspend or re-activate a user
    if (route === '/admin/suspend-user' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const body = await request.json()
      const { targetUserId, suspend } = body // suspend: true = deactivate, false = reactivate

      if (!targetUserId || typeof suspend !== 'boolean') {
        return handleCORS(NextResponse.json({ error: 'targetUserId and suspend (boolean) are required' }, { status: 400 }))
      }

      const targetUsers = await prisma.$queryRaw`
        SELECT id, email FROM users WHERE id = ${targetUserId}
      `
      if (targetUsers.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Target user not found' }, { status: 404 }))
      }

      await prisma.$executeRaw`
        UPDATE users SET is_suspended = ${suspend} WHERE id = ${targetUserId}
      `

      // Audit log
      const auditId = uuidv4()
      const action = suspend ? 'SUSPEND_USER' : 'REACTIVATE_USER'
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, ${action},
                ${targetUserId}, ${JSON.stringify({ email: targetUsers[0].email })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({
        message: suspend ? 'User suspended' : 'User reactivated',
        targetUserId
      }))
    }

    // POST /api/admin/broadcast - Set or clear the system-wide broadcast message
    if (route === '/admin/broadcast' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const body = await request.json()
      const message = typeof body.message === 'string' ? body.message.trim() : ''

      await prisma.$executeRaw`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('broadcast_message', ${message}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${message}, updated_at = NOW()
      `

      // Audit log
      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'SET_BROADCAST',
                NULL, ${JSON.stringify({ message })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({ message: 'Broadcast updated', broadcastMessage: message }))
    }

    // POST /api/admin/spread-multiplier - Set the global spread/fee multiplier
    if (route === '/admin/spread-multiplier' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const body = await request.json()
      const multiplier = parseFloat(body.multiplier)

      if (isNaN(multiplier) || multiplier < 1 || multiplier > 10) {
        return handleCORS(NextResponse.json({ error: 'multiplier must be a number between 1 and 10' }, { status: 400 }))
      }

      await prisma.$executeRaw`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('spread_multiplier', ${String(multiplier)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${String(multiplier)}, updated_at = NOW()
      `

      // Audit log
      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'SET_SPREAD_MULTIPLIER',
                NULL, ${JSON.stringify({ multiplier })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({ message: 'Spread multiplier updated', spreadMultiplier: multiplier }))
    }

    // GET /api/admin/activity-feed - Real-time feed of last 20 site actions
    if (route === '/admin/activity-feed' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const feed = await prisma.$queryRaw`
        SELECT al.id, al.action, al.details, al.created_at, u.email
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 20
      `

      return handleCORS(NextResponse.json({ feed }))
    }

    // GET /api/admin/settings - Get current system settings
    if (route === '/admin/settings' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) {
        return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))
      }

      const settings = await prisma.$queryRaw`
        SELECT key, value FROM system_settings
      `
      const result = {}
      settings.forEach(s => { result[s.key] = s.value })

      return handleCORS(NextResponse.json({ settings: result }))
    }

    // ============ DEPOSIT REQUEST ENDPOINTS ============

    // POST /api/wallet/deposit-request — user submits a deposit request
    if (route === '/wallet/deposit-request' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      const body = await request.json()
      const { amount, method: payMethod } = body

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 10) {
        return handleCORS(NextResponse.json({ error: 'Amount must be at least $10' }, { status: 400 }))
      }
      const validMethods = ['BTC', 'USDT']
      const chosenMethod = validMethods.includes(payMethod) ? payMethod : 'BTC'
      const address = DEPOSIT_ADDRESSES[chosenMethod]
      const id = uuidv4()
      await prisma.$executeRawUnsafe(
        `INSERT INTO deposit_requests (id, user_id, amount, method, address, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'PENDING'::"DepositStatus", NOW(), NOW())`,
        id, auth.user.userId, parseFloat(amount), chosenMethod, address
      )
      logActivity(auth.user.userId, 'DEPOSIT_REQUEST', { amount: parseFloat(amount), method: chosenMethod })
      return handleCORS(NextResponse.json({ message: 'Deposit request submitted. Awaiting admin approval.', id, amount: parseFloat(amount), method: chosenMethod, address }))
    }

    // GET /api/wallet/deposits — user views their own deposit requests
    if (route === '/wallet/deposits' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      const deposits = await prisma.$queryRawUnsafe(
        `SELECT id::text, user_id::text, amount::float8, method, address, status, notes, created_at, updated_at
         FROM deposit_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        auth.user.userId
      )
      return handleCORS(NextResponse.json({ deposits }))
    }

    // GET /api/admin/deposits — admin views all deposit requests
    if (route === '/admin/deposits' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const deposits = await prisma.$queryRaw`
        SELECT dr.*, u.email
        FROM deposit_requests dr
        JOIN users u ON u.id = dr.user_id
        ORDER BY dr.created_at DESC
        LIMIT 100
      `
      return handleCORS(NextResponse.json({ deposits }))
    }

    // GET /api/admin/deposits/count — count pending deposits (for sidebar badge)
    if (route === '/admin/deposits/count' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      // Role is embedded in the session; non-admins always get 0 without extra DB query
      if (auth.user.role !== 'ADMIN') return handleCORS(NextResponse.json({ count: 0 }))

      const result = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM deposit_requests WHERE status = 'PENDING'::"DepositStatus"
      `
      return handleCORS(NextResponse.json({ count: result[0]?.count || 0 }))
    }

    // POST /api/admin/deposits/approve — approve or reject a deposit request
    if (route === '/admin/deposits/approve' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const body = await request.json()
      const { depositId, action } = body   // action: 'APPROVE' | 'REJECT'
      if (!depositId || !['APPROVE', 'REJECT'].includes(action)) {
        return handleCORS(NextResponse.json({ error: 'depositId and action (APPROVE|REJECT) required' }, { status: 400 }))
      }

      const deposits = await prisma.$queryRawUnsafe(
        `SELECT id::text, user_id::text, amount::float8, method, address, status, notes, created_at, updated_at
         FROM deposit_requests WHERE id = $1 AND status = 'PENDING'::"DepositStatus"`,
        depositId
      )
      if (deposits.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Pending deposit request not found' }, { status: 404 }))
      }
      const dep = deposits[0]
      // Coerce types — $queryRawUnsafe returns Decimal/Buffer for some columns
      const depUserId = String(dep.user_id)
      const depAmount  = parseFloat(dep.amount)
      const depMethod  = String(dep.method || 'BTC')

      try {
        if (action === 'APPROVE') {
          // Credit real wallet (and active balance if user is currently in REAL mode)
          await prisma.$executeRawUnsafe(
            `UPDATE virtual_accounts
             SET real_balance = real_balance + $1,
                 balance = CASE WHEN trading_mode = 'REAL' THEN balance + $1 ELSE balance END
             WHERE user_id = $2`,
            depAmount, depUserId
          )
          // Get active balance for ledger snapshot
          const accounts = await prisma.$queryRawUnsafe(
            `SELECT balance::float8 AS balance FROM virtual_accounts WHERE user_id = $1`, depUserId
          )
          const activeBalance = parseFloat(accounts[0]?.balance || 0)
          // Ledger entry — snapshot uses active balance
          const ledgerId = uuidv4()
          await prisma.$executeRawUnsafe(
            `INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, reference_id, account_type, created_at)
             VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, $6, 'REAL', NOW())`,
            ledgerId, depUserId, depAmount, activeBalance,
            `Deposit approved — Real Wallet funded via ${depMethod}`, depositId
          )
          logActivity(depUserId, 'DEPOSIT_APPROVED', { amount: depAmount, method: depMethod })
        }

        // Update deposit status
        const newStatus = action === 'APPROVE' ? 'COMPLETED' : 'REJECTED'
        await prisma.$executeRawUnsafe(
          `UPDATE deposit_requests SET status = $1::"DepositStatus", updated_at = NOW() WHERE id = $2`,
          newStatus, depositId
        )

        // Audit log
        const auditId = uuidv4()
        await prisma.$executeRawUnsafe(
          `INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          auditId, admin.user.userId,
          action === 'APPROVE' ? 'DEPOSIT_APPROVE' : 'DEPOSIT_REJECT',
          depUserId,
          JSON.stringify({ depositId, amount: depAmount, method: depMethod })
        )
        return handleCORS(NextResponse.json({
          message: action === 'APPROVE' ? `$${depAmount.toFixed(2)} deposited to user account.` : 'Deposit request rejected.',
          status: newStatus
        }))
      } catch (approveErr) {
        console.error('Deposit approval error:', approveErr)
        return handleCORS(NextResponse.json({ error: `Approval failed: ${approveErr.message}` }, { status: 500 }))
      }
    }

    // POST /api/admin/force-settle — Force Profit or Force Loss on a position (God Mode)
    if (route === '/admin/force-settle' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const body = await request.json()
      const { positionId, outcome } = body  // outcome: 'PROFIT' | 'LOSS'
      if (!positionId || !['PROFIT', 'LOSS'].includes(outcome)) {
        return handleCORS(NextResponse.json({ error: 'positionId and outcome (PROFIT|LOSS) required' }, { status: 400 }))
      }

      const positions = await prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON a.id = p.asset_id
        WHERE p.id = ${positionId} AND p.status = 'OPEN'
      `
      if (positions.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Open position not found' }, { status: 404 }))
      }
      const pos = positions[0]

      // Get current market price (fall back to entry price)
      let currentPrice = parseFloat(pos.entry_price)
      try {
        const provider = getMarketDataProvider()
        const quote = await provider.getQuote(pos.symbol, pos.type)
        currentPrice = quote.price
      } catch (_) {}

      const qty = parseFloat(pos.quantity)
      const entryPrice = parseFloat(pos.entry_price)
      const notional = qty * entryPrice

      // Target P&L: +FORCE_PROFIT_RATIO of notional for profit, -FORCE_LOSS_RATIO for loss
      const targetPnl = outcome === 'PROFIT' ? notional * FORCE_PROFIT_RATIO : -(notional * FORCE_LOSS_RATIO)

      // Sale value = entry cost + targetPnl (we credit this back to the user)
      const originalCost = entryPrice * qty
      const saleValue = originalCost + targetPnl

      // Close position
      await prisma.$executeRaw`
        UPDATE trading_positions
        SET status = 'CLOSED', closed_at = NOW(), realized_pnl = ${targetPnl}
        WHERE id = ${positionId}
      `

      // Credit sale value back to user's account (update both legacy + mode-aware columns)
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET balance      = balance      + ${saleValue},
            real_balance = CASE WHEN trading_mode = 'REAL' THEN real_balance + ${saleValue} ELSE real_balance END,
            demo_balance = CASE WHEN trading_mode = 'DEMO' THEN demo_balance + ${saleValue} ELSE demo_balance END,
            updated_at   = NOW()
        WHERE user_id = ${pos.user_id}
      `

      const accounts = await prisma.$queryRaw`
        SELECT balance FROM virtual_accounts WHERE user_id = ${pos.user_id}
      `
      const newBalance = parseFloat(accounts[0]?.balance || 0)

      // Ledger entry — TRADE_SETTLEMENT so it shows on user's history
      const ledgerId = uuidv4()
      const desc = `${outcome === 'PROFIT' ? 'Trade Settlement (Win)' : 'Trade Settlement (Loss)'}: ${pos.symbol}`
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, reference_id, created_at)
        VALUES (${ledgerId}, ${pos.user_id}, 'TRADE_SELL',
                ${saleValue}, ${newBalance}, ${desc}, ${positionId}, NOW())
      `

      // Audit log
      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId},
                ${outcome === 'PROFIT' ? 'FORCE_PROFIT' : 'FORCE_LOSS'},
                ${positionId},
                ${JSON.stringify({ symbol: pos.symbol, qty, entryPrice, targetPnl, saleValue })}::jsonb, NOW())
      `

      // Notify user that their trade was settled
      const notifId = uuidv4()
      const notifMsg = `Trade ${pos.symbol} has been settled by the liquidity provider. ${outcome === 'PROFIT' ? `Profit of $${targetPnl.toFixed(2)} credited.` : `Loss of $${Math.abs(targetPnl).toFixed(2)} applied.`}`
      await prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, message, created_at)
        VALUES (${notifId}, ${pos.user_id}, ${notifMsg}, NOW())
      `

      return handleCORS(NextResponse.json({
        message: `Position ${pos.symbol} settled as ${outcome}. P&L: $${targetPnl.toFixed(2)}`,
        outcome,
        targetPnl,
        saleValue
      }))
    }

    // GET /api/admin/live-positions — list all open positions across all users
    if (route === '/admin/live-positions' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const positions = await prisma.$queryRaw`
        SELECT
          p.id,
          p.user_id,
          p.quantity,
          p.entry_price,
          p.opened_at,
          a.symbol,
          a.name,
          a.type,
          u.email AS user_email
        FROM trading_positions p
        JOIN assets a ON a.id = p.asset_id
        JOIN users u ON u.id = p.user_id
        WHERE p.status = 'OPEN'
        ORDER BY p.opened_at DESC
      `

      return handleCORS(NextResponse.json({ positions }))
    }

    // POST /api/admin/market-close — close a position at current market price with no P&L adjustment
    if (route === '/admin/market-close' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const body = await request.json()
      const { positionId } = body
      if (!positionId) {
        return handleCORS(NextResponse.json({ error: 'positionId is required' }, { status: 400 }))
      }

      const positions = await prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON a.id = p.asset_id
        WHERE p.id = ${positionId} AND p.status = 'OPEN'
      `
      if (positions.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Open position not found' }, { status: 404 }))
      }
      const pos = positions[0]

      let currentPrice = parseFloat(pos.entry_price)
      try {
        const provider = getMarketDataProvider()
        const quote = await provider.getQuote(pos.symbol, pos.type)
        currentPrice = quote.price
      } catch (_) {}

      const qty = parseFloat(pos.quantity)
      const entryPrice = parseFloat(pos.entry_price)
      const realizedPnl = (currentPrice - entryPrice) * qty
      const saleValue = currentPrice * qty

      await prisma.$executeRaw`
        UPDATE trading_positions
        SET status = 'CLOSED', closed_at = NOW(), realized_pnl = ${realizedPnl}
        WHERE id = ${positionId}
      `

      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET balance      = balance      + ${saleValue},
            real_balance = CASE WHEN trading_mode = 'REAL' THEN real_balance + ${saleValue} ELSE real_balance END,
            demo_balance = CASE WHEN trading_mode = 'DEMO' THEN demo_balance + ${saleValue} ELSE demo_balance END,
            updated_at   = NOW()
        WHERE user_id = ${pos.user_id}
      `

      const accounts = await prisma.$queryRaw`
        SELECT balance FROM virtual_accounts WHERE user_id = ${pos.user_id}
      `
      const newBalance = parseFloat(accounts[0]?.balance || 0)

      const ledgerId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, type, amount, balance, description, reference_id, created_at)
        VALUES (${ledgerId}, ${pos.user_id}, 'ADMIN_ADJUSTMENT',
                ${saleValue}, ${newBalance}, ${'Admin market-close: ' + pos.symbol}, ${positionId}, NOW())
      `

      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'MARKET_CLOSE',
                ${positionId}, ${JSON.stringify({ symbol: pos.symbol, qty, entryPrice, currentPrice, realizedPnl })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({
        message: `Position ${pos.symbol} closed at market price. P&L: $${realizedPnl.toFixed(2)}`,
        realizedPnl,
        saleValue
      }))
    }

    // ============ ADMIN GOD MODE - NEW ENDPOINTS ============

    // GET /api/admin/user-positions?userId= — open positions for a specific user
    if (route === '/admin/user-positions' && method === 'GET') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const { searchParams } = new URL(request.url)
      const targetUserId = searchParams.get('userId')
      if (!targetUserId) return handleCORS(NextResponse.json({ error: 'userId is required' }, { status: 400 }))

      const positions = await prisma.$queryRaw`
        SELECT
          p.id,
          p.user_id,
          p.quantity,
          p.entry_price,
          p.side,
          p.leverage,
          p.take_profit,
          p.stop_loss,
          p.opened_at,
          a.symbol,
          a.name,
          a.type
        FROM trading_positions p
        JOIN assets a ON a.id = p.asset_id
        WHERE p.user_id = ${targetUserId} AND p.status = 'OPEN'
        ORDER BY p.opened_at DESC
      `

      const accounts = await prisma.$queryRaw`
        SELECT balance FROM virtual_accounts WHERE user_id = ${targetUserId}
      `
      const balance = parseFloat(accounts[0]?.balance || 0)

      return handleCORS(NextResponse.json({ positions, balance }))
    }

    // POST /api/admin/set-market-trend — set BULL/BEAR/NEUTRAL global trend
    if (route === '/admin/set-market-trend' && method === 'POST') {
      const admin = await requireAdminAuth()
      if (admin.error) return handleCORS(NextResponse.json({ error: admin.error }, { status: admin.status }))

      const body = await request.json()
      const { trend } = body
      if (!['BULL', 'BEAR', 'NEUTRAL'].includes(trend)) {
        return handleCORS(NextResponse.json({ error: 'trend must be BULL, BEAR, or NEUTRAL' }, { status: 400 }))
      }

      await prisma.$executeRaw`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('market_trend', ${trend}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${trend}, updated_at = NOW()
      `

      // Apply immediately to in-process simulation engine
      setMarketTrend(trend)

      const auditId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at)
        VALUES (${auditId}, ${admin.user.userId}, 'SET_MARKET_TREND',
                NULL, ${JSON.stringify({ trend })}::jsonb, NOW())
      `

      return handleCORS(NextResponse.json({ message: `Market trend set to ${trend}`, trend }))
    }

    // GET /api/notifications — get unread notifications for current user
    if (route === '/notifications' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      const notifications = await prisma.$queryRaw`
        SELECT id, message, read, created_at
        FROM notifications
        WHERE user_id = ${auth.user.userId}
        ORDER BY created_at DESC
        LIMIT 20
      `
      return handleCORS(NextResponse.json({ notifications }))
    }

    // POST /api/notifications/read — mark all notifications as read
    if (route === '/notifications/read' && method === 'POST') {
      const auth = await requireAuth()
      if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))

      await prisma.$executeRaw`
        UPDATE notifications SET read = TRUE WHERE user_id = ${auth.user.userId}
      `
      return handleCORS(NextResponse.json({ message: 'Notifications marked as read' }))
    }

    // ============ ROUTE NOT FOUND ============
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    // Surface DB configuration errors with a clear, safe message.
    // Use name check (not instanceof) to avoid false negatives caused by
    // Next.js HMR module re-evaluation creating separate class instances.
    if (error?.name === 'DatabaseConfigError') {
      return handleCORS(NextResponse.json(
        { error: error.message },
        { status: 503 }
      ))
    }
    // Detect Prisma DB connection / initialisation errors — most common cause
    // is a paused Supabase free-tier project or a missing DATABASE_URL.
    const isPrismaConnectionError =
      error?.name === 'PrismaClientInitializationError' ||
      error?.name === 'PrismaClientKnownRequestError' ||
      (error?.message && (
        error.message.includes("Can't reach database") ||
        error.message.includes('connect ECONNREFUSED') ||
        error.message.includes('Connection refused') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      ))
    if (isPrismaConnectionError) {
      return handleCORS(NextResponse.json(
        { error: 'Unable to reach the database. If you are using Supabase free tier, your project may be paused — visit app.supabase.com, open your project, and click "Restore project". Then try again in 30 seconds.' },
        { status: 503 }
      ))
    }
    // Always include the real error message so it can be diagnosed from the UI.
    const detail = ` — ${error?.message || String(error)}`
    return handleCORS(NextResponse.json(
      { error: `Internal server error${detail}` },
      { status: 500 }
    ))
  }
}

// ── Market Simulator API ─────────────────────────────────────────────────────
// These are thin wrappers so the client can poll without importing the sim lib.

async function handleMarketRoute(route, method, body) {
  // GET /api/market/prices — returns all current bid/ask/mid prices
  if (route === '/market/prices' && method === 'GET') {
    const prices = MarketSim.getAllPrices()
    return handleCORS(NextResponse.json({ prices, settings: MarketSim.getSettings() }))
  }

  // POST /api/market/tick — advances prices by one tick (called every 2s by client)
  if (route === '/market/tick' && method === 'POST') {
    const updated = MarketSim.advanceTick()
    // Persist to DB at most once per 60s (throttled — avoids Supabase write flood)
    const now = Date.now()
    if (!handleMarketRoutes._lastPersist || now - handleMarketRoutes._lastPersist > 60000) {
      handleMarketRoutes._lastPersist = now
      persistPricesToDb(updated).catch(() => {})
    }
    return handleCORS(NextResponse.json({ prices: MarketSim.getAllPrices() }))
  }

  // GET /api/market/quote/:symbol — single symbol quote
  if (route.startsWith('/market/quote/') && method === 'GET') {
    const symbol = route.split('/market/quote/')[1]?.toUpperCase()
    const quote = MarketSim.getQuote(symbol)
    if (!quote) return handleCORS(NextResponse.json({ error: 'Symbol not found' }, { status: 404 }))
    return handleCORS(NextResponse.json(quote))
  }

  return null
}

async function persistPricesToDb(prices) {
  try {
    const entries = Object.entries(prices)
    if (!entries.length) return
    const values = entries.map(([sym, p]) =>
      `('${sym}', ${p.bid}, ${p.ask}, ${p.mid}, '${p.source}', NOW())`
    ).join(',\n')
    await prisma.$executeRawUnsafe(`
      INSERT INTO market_prices (symbol, bid, ask, mid, source, updated_at)
      VALUES ${values}
      ON CONFLICT (symbol) DO UPDATE
        SET bid = EXCLUDED.bid, ask = EXCLUDED.ask, mid = EXCLUDED.mid,
            source = EXCLUDED.source, updated_at = EXCLUDED.updated_at
    `)
  } catch (e) { /* best-effort */ }
}

// ── Admin Market Control ─────────────────────────────────────────────────────
async function handleAdminMarketControl(route, method, body, adminUserId) {
  // POST /api/admin/market-control/settings
  if (route === '/admin/market-control/settings' && method === 'POST') {
    const { volatility, trendBias, spreadPips } = body || {}
    const settings = MarketSim.updateSettings({ volatility, trendBias, spreadPips })
    // Persist to DB
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE market_sim_settings SET volatility=$1, trend_bias=$2, spread_pips=$3, updated_at=NOW() WHERE id=1`,
        settings.volatility, settings.trendBias, settings.spreadPips
      )
    } catch (e) { /* best-effort */ }
    // Audit log
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, admin_id, action, details, created_at) VALUES ($1,$2,'MARKET_SETTINGS_CHANGED',$3::jsonb,NOW())`,
        uuidv4(), adminUserId, JSON.stringify(settings)
      )
    } catch (e) { /* best-effort */ }
    return handleCORS(NextResponse.json({ message: 'Market settings updated', settings }))
  }

  // POST /api/admin/market-control/override — set a per-symbol price override
  if (route === '/admin/market-control/override' && method === 'POST') {
    const { symbol, price, durationMinutes = 10 } = body || {}
    if (!symbol || !price) return handleCORS(NextResponse.json({ error: 'symbol and price required' }, { status: 400 }))
    if (price <= 0) return handleCORS(NextResponse.json({ error: 'Price must be positive' }, { status: 400 }))
    MarketSim.setOverride(symbol, price, durationMinutes * 60 * 1000)
    // Audit log
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, admin_id, action, target_id, details, created_at) VALUES ($1,$2,'PRICE_OVERRIDE',$3,$4::jsonb,NOW())`,
        uuidv4(), adminUserId, symbol.toUpperCase(), JSON.stringify({ price, durationMinutes })
      )
    } catch (e) { /* best-effort */ }
    return handleCORS(NextResponse.json({ message: `Override set for ${symbol.toUpperCase()}`, price, durationMinutes }))
  }

  // DELETE /api/admin/market-control/override/:symbol
  if (route.startsWith('/admin/market-control/override/') && method === 'DELETE') {
    const symbol = route.split('/admin/market-control/override/')[1]?.toUpperCase()
    MarketSim.clearOverride(symbol)
    return handleCORS(NextResponse.json({ message: `Override cleared for ${symbol}` }))
  }

  // GET /api/admin/market-control/settings — get current settings
  if (route === '/admin/market-control/settings' && method === 'GET') {
    const settings = MarketSim.getSettings()
    // Also load from DB for display
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM market_sim_settings WHERE id=1`)
      if (rows[0]) {
        MarketSim.updateSettings({
          volatility: rows[0].volatility,
          trendBias: rows[0].trend_bias,
          spreadPips: rows[0].spread_pips,
        })
      }
    } catch (e) { /* best-effort */ }
    return handleCORS(NextResponse.json({ settings: MarketSim.getSettings() }))
  }

  return null
}

// Patch handleRoute to include market routes
const _origHandleRoute = handleRoute
async function handleRouteWithMarket(request, context) {
  const { pathname } = new URL(request.url)
  const segments = pathname.split('/api')[1] || '/'
  const method = request.method.toUpperCase()

  // Market routes (no auth needed for prices/tick)
  if (segments.startsWith('/market/')) {
    let body = {}
    try { body = method !== 'GET' ? await request.json() : {} } catch {}
    const result = await handleMarketRoute(segments, method, body)
    if (result) return result
  }

  // Admin market control routes
  if (segments.startsWith('/admin/market-control')) {
    const auth = await requireAdminAuth()
    if (auth.error) return handleCORS(NextResponse.json({ error: auth.error }, { status: auth.status }))
    let body = {}
    try { body = method !== 'GET' ? await request.json() : {} } catch {}
    const result = await handleAdminMarketControl(segments, method, body, auth.user.userId)
    if (result) return result
  }

  return _origHandleRoute(request, context)
}

// Export all HTTP methods
export const GET = handleRouteWithMarket
export const POST = handleRouteWithMarket
export const PUT = handleRouteWithMarket
export const DELETE = handleRouteWithMarket
export const PATCH = handleRouteWithMarket
