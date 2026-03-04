// Account Service - Handles all account-related operations
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { getMarketDataProvider } from '@/lib/providers/marketDataProvider'
import { calculateUnrealizedPnL, TRADING_CONFIG } from './tradingConfig'

export class AccountService {
  constructor(userId) {
    this.userId = userId
  }

  // Get or create virtual account
  async getAccount() {
    const accounts = await prisma.$queryRaw`
      SELECT
        id,
        trading_mode,
        currency,
        COALESCE(margin_reserved, 0) as margin_reserved,
        COALESCE(demo_balance, 0) as demo_balance,
        COALESCE(real_balance, 0) as real_balance,
        CASE WHEN trading_mode = 'REAL' THEN COALESCE(real_balance, 0) ELSE COALESCE(demo_balance, 0) END AS balance,
        created_at,
        updated_at
      FROM virtual_accounts
      WHERE user_id = ${this.userId}
    `
    
    if (accounts.length === 0) {
      // Create account if doesn't exist
      const id = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO virtual_accounts (id, user_id, balance, demo_balance, real_balance, trading_mode)
        VALUES (
          ${id},
          ${this.userId},
          ${TRADING_CONFIG.STARTING_BALANCE},
          ${TRADING_CONFIG.STARTING_BALANCE},
          ${TRADING_CONFIG.STARTING_BALANCE},
          'REAL'
        )
      `
      return {
        id,
        balance: TRADING_CONFIG.STARTING_BALANCE,
        currency: 'USD',
        trading_mode: 'REAL',
        demo_balance: TRADING_CONFIG.STARTING_BALANCE,
        real_balance: TRADING_CONFIG.STARTING_BALANCE,
        created_at: new Date(),
        updated_at: new Date()
      }
    }
    
    return accounts[0]
  }

  // Get open positions (optionally filtered by account type)
  async getOpenPositions(accountType) {
    let resolvedType = accountType
    if (!resolvedType) {
      const account = await this.getAccount()
      resolvedType = account?.trading_mode === 'REAL' ? 'REAL' : 'DEMO'
    }
    return prisma.$queryRaw`
      SELECT p.*, a.symbol, a.name, a.type
      FROM trading_positions p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.user_id = ${this.userId} AND p.status = 'OPEN'
        AND (p.account_type = ${resolvedType} OR p.account_type IS NULL)
      ORDER BY p.opened_at DESC
    `
  }

  // Calculate full account summary with real-time quotes
  async getAccountSummary() {
    const account = await this.getAccount()
    const accountType = account?.trading_mode === 'REAL' ? 'REAL' : 'DEMO'

    // Fetch independent reads in parallel
    const [positions, closedPositions] = await Promise.all([
      this.getOpenPositions(accountType),
      prisma.$queryRaw`
        SELECT COALESCE(SUM(realized_pnl), 0) as total_realized,
               COALESCE(SUM(total_fees), 0) as total_fees
        FROM trading_positions 
        WHERE user_id = ${this.userId} AND status = 'CLOSED'
          AND (account_type = ${accountType} OR account_type IS NULL)
      `
    ])
    
    const realizedPnl = parseFloat(closedPositions[0]?.total_realized) || 0
    const totalFeesPaid = parseFloat(closedPositions[0]?.total_fees) || 0
    
    // Calculate unrealized P&L and positions value
    let openPnl = 0
    let positionsValue = 0
    const provider = getMarketDataProvider()
    const positionsWithQuotes = []

    // Batch quotes in one provider call (cached + throttled + simulation fallback)
    let quoteMap = {}
    try {
      const assets = Array.from(
        new Map(
          (positions || [])
            .filter(p => p?.symbol)
            .map(p => [`${p.symbol}:${p.type}`, { symbol: p.symbol, type: p.type }])
        ).values()
      )
      quoteMap = await provider.getBatchQuotes(assets)
    } catch (_) {
      quoteMap = {}
    }

    for (const pos of positions) {
      const q = quoteMap?.[pos.symbol]
      const currentPrice = q?.price ? Number(q.price) : Number(pos.entry_price)
      const safeCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0
        ? currentPrice
        : Number(pos.entry_price)

      const pnl = q?.price
        ? calculateUnrealizedPnL(
            safeCurrentPrice,
            pos.entry_price,
            pos.quantity,
            pos.leverage || 1
          )
        : 0

      const value = safeCurrentPrice * pos.quantity
      openPnl += pnl
      positionsValue += value

      positionsWithQuotes.push({
        ...pos,
        currentPrice: safeCurrentPrice,
        currentValue: value,
        unrealizedPnl: pnl,
        pnlPercent: q?.price
          ? ((safeCurrentPrice / pos.entry_price) - 1) * 100 * (pos.leverage || 1)
          : 0,
      })
    }
    
    // Correct CFD accounting:
    // Balance  = cash in account (already reflects realized P&L)
    // Equity   = Balance + Open P&L  (live total if all positions closed now)
    // Margin Reserved = SUM(open positions margin_used)
    // Available = Balance - Margin Reserved
    const computedMarginReserved = positions.reduce((sum, p) => {
      const explicit = parseFloat(p.margin_used)
      if (Number.isFinite(explicit) && explicit > 0) return sum + explicit

      const entryPrice = parseFloat(p.entry_price) || 0
      const qty = parseFloat(p.quantity) || 0
      const lev = Math.max(1, parseFloat(p.leverage) || 1)
      const estimated = (entryPrice * qty) / lev
      return sum + (Number.isFinite(estimated) && estimated > 0 ? estimated : 0)
    }, 0)
    const marginReserved = Math.max(0, computedMarginReserved)
    const equity = account.balance + openPnl
    const available = Math.max(0, account.balance - marginReserved)

    // Best-effort self-heal: keep virtual_accounts.margin_reserved in sync so UI never desyncs.
    try {
      // If there are no open positions, margin must be 0.
      // Otherwise store the computed value.
      const next = positions.length === 0 ? 0 : marginReserved
      const current = parseFloat(account.margin_reserved) || 0
      if (Math.abs(current - next) > 0.000001) {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET margin_reserved = ${next}, updated_at = NOW()
          WHERE user_id = ${this.userId}
        `
      }
    } catch (_) {}
    const totalPnl = realizedPnl + openPnl
    const returnPercent = equity > 0 ? ((equity / TRADING_CONFIG.STARTING_BALANCE) - 1) * 100 : 0
    
    // Risk metrics
    const marginUsed = marginReserved
    const availableMargin = available
    const marginLevel = marginReserved > 0 ? (equity / marginReserved) * 100 : Infinity
    
    return {
      // Core account data
      balance: account.balance,
      equity,
      available,
      positionsValue,
      marginReserved,
      
      // P&L
      openPnl,
      realizedPnl,
      totalPnl,
      returnPercent,
      
      // Costs
      totalFeesPaid,
      
      // Risk metrics
      marginUsed,
      availableMargin,
      marginLevel,
      
      // Status flags
      isMarginWarning: marginLevel < TRADING_CONFIG.MARGIN_CALL_THRESHOLD * 100,
      isLiquidationRisk: marginLevel < TRADING_CONFIG.LIQUIDATION_THRESHOLD * 100,
      
      // Meta
      currency: account.currency,
      createdAt: account.created_at,
      positionsCount: positions.length,
      positions: positionsWithQuotes
    }
  }

  // Update balance — updates both the legacy `balance` column AND the
  // mode-aware real_balance / demo_balance column in one atomic query.
  // IMPORTANT: `accountType` (REAL/DEMO) can be provided to ensure wallet
  // updates always apply to the correct sub-wallet (even if trading_mode was
  // switched in another tab).
  async updateBalance(amount, operation = 'add', accountType = null) {
    const resolvedType = accountType === 'REAL' || accountType === 'DEMO' ? accountType : null
    const col = resolvedType === 'REAL' ? 'real_balance' : resolvedType === 'DEMO' ? 'demo_balance' : null

    // If no explicit type, update the currently selected wallet (trading_mode)
    if (!col) {
      if (operation === 'add') {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET balance = balance + ${amount},
              real_balance  = CASE WHEN trading_mode = 'REAL' THEN real_balance + ${amount} ELSE real_balance END,
              demo_balance  = CASE WHEN trading_mode = 'DEMO' THEN demo_balance + ${amount} ELSE demo_balance END,
              updated_at = NOW()
          WHERE user_id = ${this.userId}
        `
      } else if (operation === 'subtract') {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET balance = balance - ${amount},
              real_balance  = CASE WHEN trading_mode = 'REAL' THEN real_balance - ${amount} ELSE real_balance END,
              demo_balance  = CASE WHEN trading_mode = 'DEMO' THEN demo_balance - ${amount} ELSE demo_balance END,
              updated_at = NOW()
          WHERE user_id = ${this.userId}
        `
      } else if (operation === 'set') {
        await prisma.$executeRaw`
          UPDATE virtual_accounts
          SET balance = ${amount},
              real_balance  = CASE WHEN trading_mode = 'REAL' THEN ${amount} ELSE real_balance END,
              demo_balance  = CASE WHEN trading_mode = 'DEMO' THEN ${amount} ELSE demo_balance END,
              updated_at = NOW()
          WHERE user_id = ${this.userId}
        `
      }
      return
    }

    // Explicit wallet update: only touch the target wallet and update the
    // legacy `balance` column *only if* the user is currently in that mode.
    if (operation === 'add') {
      await prisma.$executeRawUnsafe(
        `UPDATE virtual_accounts
         SET ${col} = ${col} + $1,
             balance = CASE WHEN trading_mode = $2 THEN balance + $1 ELSE balance END,
             updated_at = NOW()
         WHERE user_id = $3`,
        amount, resolvedType, this.userId
      )
    } else if (operation === 'subtract') {
      await prisma.$executeRawUnsafe(
        `UPDATE virtual_accounts
         SET ${col} = ${col} - $1,
             balance = CASE WHEN trading_mode = $2 THEN balance - $1 ELSE balance END,
             updated_at = NOW()
         WHERE user_id = $3`,
        amount, resolvedType, this.userId
      )
    } else if (operation === 'set') {
      await prisma.$executeRawUnsafe(
        `UPDATE virtual_accounts
         SET ${col} = $1,
             balance = CASE WHEN trading_mode = $2 THEN $1 ELSE balance END,
             updated_at = NOW()
         WHERE user_id = $3`,
        amount, resolvedType, this.userId
      )
    }
  }

  // Create account snapshot after trade
  async createSnapshot(tradeId, snapshotType = 'TRADE') {
    const summary = await this.getAccountSummary()
    const id = uuidv4()
    
    await prisma.$executeRaw`
      INSERT INTO account_snapshots (
        id, user_id, equity, balance, positions_value, 
        open_pnl, realized_pnl, trade_id, snapshot_type
      )
      VALUES (
        ${id}, ${this.userId}, ${summary.equity}, ${summary.balance},
        ${summary.positionsValue}, ${summary.openPnl}, ${summary.realizedPnl},
        ${tradeId}, ${snapshotType}
      )
    `
    
    return id
  }

  // Update daily performance
  async updateDailyPerformance(tradeFeePaid = 0) {
    const today = new Date().toISOString().split('T')[0]
    const summary = await this.getAccountSummary()
    
    // Check if we have a record for today
    const existing = await prisma.$queryRaw`
      SELECT id, starting_equity, trades_count, fees_paid
      FROM daily_performance 
      WHERE user_id = ${this.userId} AND date = ${today}::date
    `
    
    if (existing.length > 0) {
      // Update existing record
      const dailyPnl = summary.equity - existing[0].starting_equity
      const dailyReturnPct = ((summary.equity / existing[0].starting_equity) - 1) * 100
      
      await prisma.$executeRaw`
        UPDATE daily_performance 
        SET ending_equity = ${summary.equity},
            daily_pnl = ${dailyPnl},
            daily_return_pct = ${dailyReturnPct},
            trades_count = trades_count + 1,
            fees_paid = fees_paid + ${tradeFeePaid}
        WHERE id = ${existing[0].id}
      `
    } else {
      // Create new daily record
      const id = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO daily_performance (
          id, user_id, date, starting_equity, ending_equity,
          daily_pnl, daily_return_pct, trades_count, fees_paid
        )
        VALUES (
          ${id}, ${this.userId}, ${today}::date, ${summary.equity},
          ${summary.equity}, 0, 0, 1, ${tradeFeePaid}
        )
      `
    }
  }

  // Get performance history
  async getPerformanceHistory(days = 30) {
    return prisma.$queryRaw`
      SELECT * FROM daily_performance 
      WHERE user_id = ${this.userId}
      ORDER BY date DESC
      LIMIT ${days}
    `
  }

  // Get equity curve from snapshots
  async getEquityCurve(limit = 100) {
    return prisma.$queryRaw`
      SELECT equity, balance, positions_value, open_pnl, created_at
      FROM account_snapshots 
      WHERE user_id = ${this.userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }
}

// Standalone helper — returns the 4 dashboard card values using correct CFD accounting:
// balance   = virtual_accounts.balance (cash after trade costs deducted)
// available = balance - marginReserved (free cash not locked by open positions)
// openPnl   = sum of unrealised P&L on open positions
// equity    = balance + openPnl  (live total account value if all positions closed now)
export async function getAccountSnapshot(userId) {
  try {
    const svc = new AccountService(userId)
    const summary = await svc.getAccountSummary()
    const balance   = summary.balance || 0
    const available = summary.available || 0
    const openPnl   = summary.openPnl || 0
    const equity    = balance + openPnl
    const marginReserved = summary.marginReserved || 0
    return { balance, available, openPnl, equity, marginReserved, positionsCount: summary.positionsCount || 0, realizedPnl: summary.realizedPnl || 0 }
  } catch {
    return { balance: 0, available: 0, openPnl: 0, equity: 0, marginReserved: 0, positionsCount: 0, realizedPnl: 0 }
  }
}

export default AccountService
