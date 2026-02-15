import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { hashPassword, verifyPassword, createSession, getSessionFromCookies, getSessionCookieOptions, COOKIE_NAME } from '@/lib/auth'
import { getMarketDataProvider } from '@/lib/providers/marketDataProvider'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { registerSchema, loginSchema, symbolSchema, assetTypeSchema, positionSchema, validateInput } from '@/lib/validation'
import { v4 as uuidv4 } from 'uuid'
import { TradeService } from '@/lib/services/tradeService'
import { AccountService } from '@/lib/services/accountService'
import { TRADING_CONFIG } from '@/lib/services/tradingConfig'

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

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

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
    // ============ ROOT ENDPOINT ============
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ 
        message: 'PaperTrade API - Paper Trading Platform',
        version: '2.1.0',
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

      // Create user
      const passwordHash = await hashPassword(password)
      const userId = uuidv4()
      
      await prisma.$executeRaw`
        INSERT INTO users (id, email, password_hash, created_at, updated_at)
        VALUES (${userId}::uuid, ${email}, ${passwordHash}, NOW(), NOW())
      `

      // Create virtual account with starting balance
      await prisma.$executeRaw`
        INSERT INTO virtual_accounts (user_id, balance)
        VALUES (${userId}::uuid, ${TRADING_CONFIG.STARTING_BALANCE})
      `

      // Create initial account snapshot
      const snapshotId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO account_snapshots (id, user_id, equity, balance, snapshot_type)
        VALUES (${snapshotId}::uuid, ${userId}::uuid, ${TRADING_CONFIG.STARTING_BALANCE}, ${TRADING_CONFIG.STARTING_BALANCE}, 'REGISTRATION')
      `

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

      // Find user
      const users = await prisma.$queryRaw`
        SELECT id, email, password_hash FROM users WHERE email = ${email}
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

      // Ensure virtual account exists
      await prisma.$executeRaw`
        INSERT INTO virtual_accounts (user_id, balance)
        VALUES (${user.id}::uuid, ${TRADING_CONFIG.STARTING_BALANCE})
        ON CONFLICT (user_id) DO NOTHING
      `

      // Create session
      const token = await createSession(user.id, user.email)
      const cookieOptions = getSessionCookieOptions()

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

      return handleCORS(NextResponse.json({
        user: { id: auth.user.userId, email: auth.user.email }
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

    // ============ ASSETS ENDPOINTS ============
    
    // GET /api/assets - List all available assets
    if (route === '/assets' && method === 'GET') {
      const assets = await prisma.$queryRaw`
        SELECT id, symbol, name, type, created_at FROM assets ORDER BY type, symbol
      `
      return handleCORS(NextResponse.json({ assets }))
    }

    // POST /api/assets/seed - Seed default assets
    if (route === '/assets/seed' && method === 'POST') {
      const defaultAssets = [
        { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
        { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock' },
        { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock' },
        { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock' },
        { symbol: 'AMD', name: 'AMD Inc.', type: 'stock' },
        { symbol: 'BTCUSD', name: 'Bitcoin', type: 'crypto' },
        { symbol: 'ETHUSD', name: 'Ethereum', type: 'crypto' },
        { symbol: 'SOLUSD', name: 'Solana', type: 'crypto' },
        { symbol: 'XRPUSD', name: 'Ripple', type: 'crypto' },
        { symbol: 'DOGEUSD', name: 'Dogecoin', type: 'crypto' },
        { symbol: 'ADAUSD', name: 'Cardano', type: 'crypto' },
      ]

      for (const asset of defaultAssets) {
        const id = uuidv4()
        await prisma.$executeRaw`
          INSERT INTO assets (id, symbol, name, type, created_at)
          VALUES (${id}::uuid, ${asset.symbol}, ${asset.name}, ${asset.type}::"AssetType", NOW())
          ON CONFLICT (symbol) DO NOTHING
        `
      }

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

      const body = await request.json()
      const { symbol, type, action, quantity, takeProfit, stopLoss, leverage } = body

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

      // Use TradeService
      const tradeService = new TradeService(auth.user.userId)
      const result = await tradeService.executeTrade({
        symbol,
        type,
        action,
        quantity: parseFloat(quantity),
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        leverage: leverage ? parseFloat(leverage) : 1
      })

      if (!result.success) {
        return handleCORS(NextResponse.json(
          { error: result.error },
          { status: 400 }
        ))
      }

      return handleCORS(NextResponse.json({
        message: `${action} order executed`,
        trade: result.trade,
        tradingFee: TRADING_CONFIG.TRADING_FEE_PERCENT * 100 + '%'
      }))
    }

    // GET /api/account - Get account summary (Using Service Layer)
    if (route === '/account' && method === 'GET') {
      const auth = await requireAuth()
      if (auth.error) {
        return handleCORS(NextResponse.json(
          { error: auth.error },
          { status: auth.status }
        ))
      }

      const accountService = new AccountService(auth.user.userId)
      const summary = await accountService.getAccountSummary()
      
      return handleCORS(NextResponse.json(summary))
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
        WHERE w.user_id = ${auth.user.userId}::uuid
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
        SELECT id FROM assets WHERE id = ${assetId}::uuid
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
          VALUES (${id}::uuid, ${auth.user.userId}::uuid, ${assetId}::uuid, NOW())
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
        WHERE id = ${itemId}::uuid AND user_id = ${auth.user.userId}::uuid
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
        WHERE p.user_id = ${auth.user.userId}::uuid
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
        SELECT id FROM assets WHERE id = ${assetId}::uuid
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
        VALUES (${id}::uuid, ${auth.user.userId}::uuid, ${assetId}::uuid, ${quantity}, ${entryPrice}, ${entryDateParsed}, NOW())
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
          WHERE id = ${positionId}::uuid AND user_id = ${auth.user.userId}::uuid
        `
      }
      if (entryPrice !== undefined) {
        await prisma.$executeRaw`
          UPDATE portfolio_positions 
          SET entry_price = ${entryPrice}
          WHERE id = ${positionId}::uuid AND user_id = ${auth.user.userId}::uuid
        `
      }
      if (entryDate !== undefined) {
        const entryDateParsed = new Date(entryDate)
        await prisma.$executeRaw`
          UPDATE portfolio_positions 
          SET entry_date = ${entryDateParsed}
          WHERE id = ${positionId}::uuid AND user_id = ${auth.user.userId}::uuid
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
        WHERE id = ${positionId}::uuid AND user_id = ${auth.user.userId}::uuid
      `

      return handleCORS(NextResponse.json({ message: 'Position deleted' }))
    }

    // ============ ROUTE NOT FOUND ============
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
