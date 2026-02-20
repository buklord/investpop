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
      SELECT id, balance, base_currency, created_at, updated_at
      FROM virtual_accounts 
      WHERE user_id = ${this.userId}
    `
    
    if (accounts.length === 0) {
      // Create account if doesn't exist
      const id = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO virtual_accounts (id, user_id, balance)
        VALUES (${id}, ${this.userId}, ${TRADING_CONFIG.STARTING_BALANCE})
      `
      return {
        id,
        balance: TRADING_CONFIG.STARTING_BALANCE,
        base_currency: 'USD',
        created_at: new Date(),
        updated_at: new Date()
      }
    }
    
    return accounts[0]
  }

  // Get open positions with current quotes
  async getOpenPositions() {
    return prisma.$queryRaw`
      SELECT p.*, a.symbol, a.name, a.type
      FROM trading_positions p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.user_id = ${this.userId} AND p.status = 'OPEN'
      ORDER BY p.opened_at DESC
    `
  }

  // Calculate full account summary with real-time quotes
  async getAccountSummary() {
    const account = await this.getAccount()
    const positions = await this.getOpenPositions()
    
    // Get realized P&L from closed positions
    const closedPositions = await prisma.$queryRaw`
      SELECT COALESCE(SUM(realized_pnl), 0) as total_realized,
             COALESCE(SUM(total_fees), 0) as total_fees
      FROM trading_positions 
      WHERE user_id = ${this.userId} AND status = 'CLOSED'
    `
    
    const realizedPnl = parseFloat(closedPositions[0]?.total_realized) || 0
    const totalFeesPaid = parseFloat(closedPositions[0]?.total_fees) || 0
    
    // Calculate unrealized P&L and positions value
    let openPnl = 0
    let positionsValue = 0
    const provider = getMarketDataProvider()
    const positionsWithQuotes = []
    
    for (const pos of positions) {
      try {
        const quote = await provider.getQuote(pos.symbol, pos.type)
        const currentPrice = quote.price
        const pnl = calculateUnrealizedPnL(
          currentPrice, 
          pos.entry_price, 
          pos.quantity, 
          pos.leverage || 1
        )
        const value = currentPrice * pos.quantity
        
        openPnl += pnl
        positionsValue += value
        
        positionsWithQuotes.push({
          ...pos,
          currentPrice,
          currentValue: value,
          unrealizedPnl: pnl,
          pnlPercent: ((currentPrice / pos.entry_price) - 1) * 100 * (pos.leverage || 1)
        })
      } catch (err) {
        // Fallback to entry price if quote fails
        const value = pos.entry_price * pos.quantity
        positionsValue += value
        positionsWithQuotes.push({
          ...pos,
          currentPrice: pos.entry_price,
          currentValue: value,
          unrealizedPnl: 0,
          pnlPercent: 0
        })
      }
    }
    
    const equity = account.balance + positionsValue + openPnl
    const totalPnl = realizedPnl + openPnl
    const returnPercent = ((equity / TRADING_CONFIG.STARTING_BALANCE) - 1) * 100
    
    // Risk metrics
    const marginUsed = positionsValue
    const availableMargin = equity - marginUsed
    const marginLevel = positionsValue > 0 ? (equity / marginUsed) * 100 : Infinity
    
    return {
      // Core account data
      balance: account.balance,
      equity,
      positionsValue,
      
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
      currency: account.base_currency,
      createdAt: account.created_at,
      positionsCount: positions.length,
      positions: positionsWithQuotes
    }
  }

  // Update balance
  async updateBalance(amount, operation = 'add') {
    if (operation === 'add') {
      await prisma.$executeRaw`
        UPDATE virtual_accounts 
        SET balance = balance + ${amount}, updated_at = NOW()
        WHERE user_id = ${this.userId}
      `
    } else if (operation === 'subtract') {
      await prisma.$executeRaw`
        UPDATE virtual_accounts 
        SET balance = balance - ${amount}, updated_at = NOW()
        WHERE user_id = ${this.userId}
      `
    } else if (operation === 'set') {
      await prisma.$executeRaw`
        UPDATE virtual_accounts 
        SET balance = ${amount}, updated_at = NOW()
        WHERE user_id = ${this.userId}
      `
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

export default AccountService
