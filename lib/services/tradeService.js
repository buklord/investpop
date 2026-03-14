// Trade Service - Handles all trading operations
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { getMarketDataProvider } from '@/lib/providers/marketDataProvider'
import * as MarketSim from '@/lib/marketSimulator'
import { AccountService } from './accountService'
import {
  calculateExecutedPrice,
  calculateTradingFee,
  calculateWeightedAveragePrice,
  calculateRealizedPnL,
  validateTradeRequirements,
  TRADING_CONFIG
} from './tradingConfig'

export class TradeService {
  constructor(userId) {
    this.userId = userId
    this.accountService = new AccountService(userId)
  }

  async getActiveAccountType() {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT trading_mode FROM virtual_accounts WHERE user_id = $1 LIMIT 1`,
      this.userId
    )
    const mode = rows?.[0]?.trading_mode
    // Default to REAL when unset (new requirement + safer than blocking trades).
    if (!mode) return 'REAL'
    return mode === 'REAL' ? 'REAL' : 'DEMO'
  }

  // Get asset by symbol
  async getAsset(symbol) {
    const assets = await prisma.$queryRaw`
      SELECT id, symbol, name, type FROM assets WHERE symbol = ${symbol.toUpperCase()}
    `
    return assets.length > 0 ? assets[0] : null
  }

  // Get current market price from provider (fallback if simulator doesn't have it)
  async getMarketPrice(symbol, type) {
    // Try simulator first (primary source)
    const simQuote = MarketSim.getQuote(symbol)
    if (simQuote) {
      return { price: simQuote.mid, bid: simQuote.bid, ask: simQuote.ask, simulated: true }
    }
    // Fallback to legacy provider
    const provider = getMarketDataProvider()
    const quote = await provider.getQuote(symbol, type)
    return { ...quote, bid: quote.price * 0.9999, ask: quote.price * 1.0001 }
  }

  // Get existing open position for asset
  async getOpenPosition(assetId, accountType) {
    const resolvedType = accountType === 'REAL' ? 'REAL' : 'DEMO'
    const positions = await prisma.$queryRaw`
      SELECT * FROM trading_positions
      WHERE user_id = ${this.userId}
        AND asset_id = ${assetId}
        AND status = 'OPEN'
        AND (account_type = ${resolvedType} OR account_type IS NULL)
      ORDER BY (account_type = ${resolvedType}) DESC, opened_at DESC
      LIMIT 1
    `
    return positions.length > 0 ? positions[0] : null
  }

  // Execute a market trade
  async executeTrade(params) {
    const { symbol, type, action, quantity, takeProfit, stopLoss, leverage = 1, customPrice, isCopyClose = false } = params
    
    // 1. Validate asset exists
    const asset = await this.getAsset(symbol)
    if (!asset) {
      return { success: false, error: 'Asset not found' }
    }

    // 2. Get bid/ask from simulator (MT-style: BUY at ask, SELL at bid)
    let quote
    let executedPrice
    
    // If custom price is provided (for copy closes), use it
    if (customPrice && !isNaN(customPrice) && customPrice > 0) {
      executedPrice = customPrice
      quote = { price: customPrice, bid: customPrice, ask: customPrice }
    } else {
      try {
        quote = await this.getMarketPrice(symbol, type)
      } catch (err) {
        return { success: false, error: 'Failed to fetch current market price' }
      }

      const isBuy = action === 'BUY'
      // MT-style execution: BUY opens at ask (higher), SELL opens at bid (lower)
      executedPrice = isBuy ? (quote.ask || quote.price) : (quote.bid || quote.price)
    }
    
    const marketPrice = quote.price || executedPrice

    // 3. No additional slippage (bid/ask spread IS the slippage for MT-style)
    const slippagePercent = 0

    // 4. Resolve active account type (server source of truth)
    let accountType
    try {
      accountType = await this.getActiveAccountType()
    } catch (e) {
      console.error('[TradeService] Cannot determine account mode:', e?.message)
      return { success: false, error: 'Cannot determine account mode — trade blocked. Please reload and try again.' }
    }

    // 5. Get account and existing position scoped to the active account type
    const account = await this.accountService.getAccount()
    const existingPosition = await this.getOpenPosition(asset.id, accountType)

    // 6. Validate trade requirements (skip validation for copy closes)
    if (!isCopyClose) {
      const validation = validateTradeRequirements(
        action, quantity, executedPrice, account.balance, existingPosition
      )
      
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join('. ') }
      }
    }

    // 7. Calculate trade values
    const totalValue = executedPrice * quantity
    const fee = calculateTradingFee(totalValue)

    // 8. Execute trade based on action
    if (action === 'BUY') {
      return this.executeBuy({
        asset,
        quantity,
        marketPrice,
        executedPrice,
        slippagePercent,
        totalValue,
        fee,
        existingPosition,
        takeProfit,
        stopLoss,
        leverage,
        accountType,
        leaderPositionId: params.leaderPositionId
      })
    } else {
      return this.executeSell({
        asset,
        quantity,
        marketPrice,
        executedPrice,
        slippagePercent,
        totalValue,
        fee,
        existingPosition,
        accountType,
        isCopyClose
      })
    }
  }

  // Execute BUY order
  async executeBuy(params) {
    const {
      asset, quantity, marketPrice, executedPrice, slippagePercent,
      totalValue, fee, existingPosition, takeProfit, stopLoss, leverage, accountType: accountTypeFromCaller,
      leaderPositionId
    } = params

    const totalDeduction = totalValue + fee
    let positionId
    let newEntryPrice = executedPrice
    let newQuantity = quantity
    let totalInvested = totalValue

    // Use the accountType resolved in executeTrade (server source of truth)
    const accountType = accountTypeFromCaller === 'REAL' ? 'REAL' : 'DEMO'

    // Check if we're adding to existing position
    if (existingPosition) {
      // Calculate weighted average entry price
      newEntryPrice = calculateWeightedAveragePrice(
        existingPosition.quantity,
        existingPosition.entry_price,
        quantity,
        executedPrice
      )
      newQuantity = existingPosition.quantity + quantity
      totalInvested = (existingPosition.total_invested || existingPosition.entry_price * existingPosition.quantity) + totalValue
      positionId = existingPosition.id

      // Update existing position, preserving leader_position_id if it exists
      await prisma.$executeRaw`
        UPDATE trading_positions 
        SET quantity = ${newQuantity}, 
            entry_price = ${newEntryPrice},
            total_invested = ${totalInvested},
            total_fees = COALESCE(total_fees, 0) + ${fee},
            take_profit = ${takeProfit || existingPosition.take_profit},
            stop_loss = ${stopLoss || existingPosition.stop_loss},
            leverage = ${leverage},
            leader_position_id = COALESCE(leader_position_id, ${leaderPositionId || null})
        WHERE id = ${positionId}
      `
    } else {
      // Create new position
      positionId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO trading_positions (
          id, user_id, asset_id, side, quantity, entry_price,
          take_profit, stop_loss, leverage, status, total_invested, total_fees, account_type, leader_position_id
        )
        VALUES (
          ${positionId}, ${this.userId}, ${asset.id}, 'LONG',
          ${quantity}, ${executedPrice}, ${takeProfit || null}, ${stopLoss || null},
          ${leverage}, 'OPEN', ${totalValue}, ${fee}, ${accountType}, ${leaderPositionId || null}
        )
      `
    }

    // Record trade
    const tradeId = uuidv4()
    await prisma.$executeRaw`
      INSERT INTO trades (
        id, user_id, asset_id, position_id, side, quantity, 
        price, total_value, fee_amount, slippage, market_price, account_type
      )
      VALUES (
        ${tradeId}, ${this.userId}, ${asset.id}, ${positionId},
        'BUY', ${quantity}, ${executedPrice}, ${totalValue}, ${fee}, ${slippagePercent}, ${marketPrice}, ${accountType}
      )
    `

    // Deduct from the correct wallet (cost + fee)
    await this.accountService.updateBalance(totalDeduction, 'subtract', accountType)

    // Track margin reserved (increase by cost of trade)
    try {
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET margin_reserved = COALESCE(margin_reserved, 0) + ${totalValue},
            updated_at = NOW()
        WHERE user_id = ${this.userId}
      `
    } catch (e) { console.warn('[margin] open track failed', e.message) }

    // Non-critical bookkeeping runs in background so order execution returns faster.
    Promise.allSettled([
      this.accountService.createSnapshot(tradeId, 'BUY'),
      this.accountService.updateDailyPerformance(fee),
    ]).catch((e) => {
      console.warn('[tradeService] post-buy bookkeeping failed:', e?.message || e)
    })

    const tradeResult = {
      success: true,
      positionId, // Return positionId at top level for copy trading
      trade: {
        id: tradeId,
        symbol: asset.symbol,
        action: 'BUY',
        quantity,
        marketPrice,
        executedPrice,
        slippage: slippagePercent * 100, // as percentage
        totalValue,
        fee,
        totalDeduction,
        positionId,
        newPositionQuantity: newQuantity,
        averageEntryPrice: newEntryPrice
      }
    }

    // Trigger copy trades if this user is a leader (ADMIN or SUPER_ADMIN)
    // Run in background to not delay trade execution
    this.triggerCopyTrades({
      symbol: asset.symbol,
      type: asset.type,
      action: 'BUY',
      quantity,
      executedPrice,
      price: marketPrice,
      takeProfit,
      stopLoss,
      leverage,
      leaderPositionId: positionId // Pass the position ID for linking
    }).catch((err) => {
      console.warn('[CopyTrading] Background copy trigger failed:', err?.message)
    })

    return tradeResult
  }

  // Execute SELL order
  async executeSell(params) {
    const {
      asset, quantity, marketPrice, executedPrice, slippagePercent,
      totalValue, fee, existingPosition, accountType: accountTypeFromCaller, isCopyClose = false
    } = params

    if (!existingPosition) {
      return { success: false, error: 'No open position to sell' }
    }

    // Prefer the position-stamped account_type; fall back to active mode for legacy rows.
    const accountType = existingPosition.account_type || (accountTypeFromCaller === 'REAL' ? 'REAL' : 'DEMO')

    // Calculate realized P&L
    const realizedPnl = calculateRealizedPnL(
      executedPrice,
      existingPosition.entry_price,
      quantity,
      existingPosition.leverage || 1
    )

    // Calculate net proceeds (sale value - fee)
    const netProceeds = totalValue - fee

    // Record trade
    const tradeId = uuidv4()
    await prisma.$executeRaw`
      INSERT INTO trades (
        id, user_id, asset_id, position_id, side, quantity, 
        price, total_value, fee_amount, slippage, market_price, account_type
      )
      VALUES (
        ${tradeId}, ${this.userId}, ${asset.id}, ${existingPosition.id},
        'SELL', ${quantity}, ${executedPrice}, ${totalValue}, ${fee}, ${slippagePercent}, ${marketPrice}, ${accountType}
      )
    `

    // Add proceeds to the correct wallet (mode-safe)
    await this.accountService.updateBalance(netProceeds, 'add', accountType)

    // Release margin reserved (decrease by the cost originally locked)
    try {
      const positionMargin = existingPosition.total_invested || totalValue
      await prisma.$executeRaw`
        UPDATE virtual_accounts
        SET margin_reserved = GREATEST(0, COALESCE(margin_reserved, 0) - ${positionMargin}),
            updated_at = NOW()
        WHERE user_id = ${this.userId}
      `
    } catch (e) { console.warn('[margin] close track failed', e.message) }

    // Record TRADE_PNL ledger entry so wallet history and balance SUM stay in sync
    // Use the account_type stamped on the position at open time (no fallback — if missing, skip silently)
    try {
      const accountType = existingPosition.account_type || null
      if (accountType) {
        const ledgerDesc = realizedPnl >= 0
          ? `Trade closed - Profit: $${realizedPnl.toFixed(2)}`
          : `Trade closed - Loss: $${Math.abs(realizedPnl).toFixed(2)}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO ledger_entries (id, user_id, amount, type, description, account_type, created_at)
           VALUES ($1, $2, $3, 'TRADE_PNL', $4, $5, NOW())`,
          uuidv4(), this.userId, realizedPnl, ledgerDesc, accountType
        )
      } else {
        console.warn('[tradeService] position.account_type missing — TRADE_PNL ledger skipped')
      }
    } catch (e) {
      console.warn('[tradeService] TRADE_PNL ledger entry failed (non-critical):', e?.message)
    }

    const remainingQuantity = existingPosition.quantity - quantity

    if (remainingQuantity <= 0.0000001) { // Close position entirely (handle floating point)
      // Calculate total fees for this position
      const totalFees = (existingPosition.total_fees || 0) + fee
      
      await prisma.$executeRaw`
        UPDATE trading_positions 
        SET quantity = 0, 
            status = 'CLOSED', 
            closed_at = NOW(), 
            realized_pnl = ${realizedPnl},
            total_fees = ${totalFees},
            account_type = COALESCE(account_type, ${accountType})
        WHERE id = ${existingPosition.id}
      `
    } else {
      // Partial close - reduce quantity
      await prisma.$executeRaw`
        UPDATE trading_positions 
        SET quantity = ${remainingQuantity},
            total_fees = COALESCE(total_fees, 0) + ${fee},
            account_type = COALESCE(account_type, ${accountType})
        WHERE id = ${existingPosition.id}
      `
    }

    // Non-critical bookkeeping runs in background so order execution returns faster.
    Promise.allSettled([
      this.accountService.createSnapshot(tradeId, 'SELL'),
      this.accountService.updateDailyPerformance(fee),
    ]).catch((e) => {
      console.warn('[tradeService] post-sell bookkeeping failed:', e?.message || e)
    })

    const tradeResult = {
      success: true,
      trade: {
        id: tradeId,
        symbol: asset.symbol,
        action: 'SELL',
        quantity,
        marketPrice,
        executedPrice,
        slippage: slippagePercent * 100,
        totalValue,
        fee,
        netProceeds,
        realizedPnl,
        positionId: existingPosition.id,
        remainingQuantity: remainingQuantity > 0.0000001 ? remainingQuantity : 0,
        positionClosed: remainingQuantity <= 0.0000001
      }
    }

    // Trigger copy closes if this user is a leader (ADMIN or SUPER_ADMIN) and position is being closed
    // Only trigger for actual closes, not copy closes (to avoid recursion)
    if (!isCopyClose && remainingQuantity <= 0.0000001) {
      this.triggerCopyCloses({
        leaderPositionId: existingPosition.id,
        symbol: asset.symbol,
        entryPrice: existingPosition.entry_price,
        exitPrice: executedPrice,
        realizedPnl,
        quantity: existingPosition.quantity
      }).catch((err) => {
        console.warn('[CopyTrading] Background copy close trigger failed:', err?.message)
      })
    }

    return tradeResult
  }

  // Trigger copy trades for followers (if this user is a leader)
  async triggerCopyTrades(tradeData) {
    try {
      // Check if user is ADMIN or SUPER_ADMIN (only they can be leaders)
      const userCheck = await prisma.$queryRaw`
        SELECT role FROM users WHERE id = ${this.userId} LIMIT 1
      `
      
      const userRole = userCheck?.[0]?.role
      if (!userRole || !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        // Not a leader, skip
        return
      }

      // Import CopyTradingService here to avoid circular dependency
      const { CopyTradingService } = await import('./copyTradingService.js')
      
      // Execute copy trades in background
      await CopyTradingService.executeCopyTrades(this.userId, tradeData)
    } catch (err) {
      // Fail silently - copy trading errors should not affect leader's trade
      console.error('[CopyTrading] Error triggering copy trades:', err?.message)
    }
  }

  // Trigger copy closes for followers (if this user is a leader)
  async triggerCopyCloses(closeData) {
    try {
      // Check if user is ADMIN or SUPER_ADMIN (only they can be leaders)
      const userCheck = await prisma.$queryRaw`
        SELECT role FROM users WHERE id = ${this.userId} LIMIT 1
      `
      
      const userRole = userCheck?.[0]?.role
      if (!userRole || !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        // Not a leader, skip
        return
      }

      // Calculate profit/loss percentage
      const { entryPrice, exitPrice, leaderPositionId, symbol } = closeData
      const profitLossPercent = ((exitPrice - entryPrice) / entryPrice) * 100

      console.log(`[CopyTrading] Triggering copy closes for leader position ${leaderPositionId}, P/L: ${profitLossPercent.toFixed(2)}%`)

      // Import CopyTradingService here to avoid circular dependency
      const { CopyTradingService } = await import('./copyTradingService.js')
      
      // Execute copy closes in background
      await CopyTradingService.executeCopyCloses(this.userId, {
        leaderPositionId,
        profitLossPercent,
        symbol,
        closeType: 'MARKET'
      })
    } catch (err) {
      // Fail silently - copy trading errors should not affect leader's trade
      console.error('[CopyTrading] Error triggering copy closes:', err?.message)
    }
  }

  // Get trade history
  async getTradeHistory(limit = 100) {
    // Get user's active trading mode to filter by account type
    let accountType = 'REAL'
    try {
      const vaRows = await prisma.$queryRawUnsafe(
        `SELECT trading_mode FROM virtual_accounts WHERE user_id = $1 LIMIT 1`,
        this.userId
      )
      accountType = vaRows?.[0]?.trading_mode === 'REAL' ? 'REAL' : 'DEMO'
    } catch (e) { /* default REAL */ }

    return prisma.$queryRaw`
      SELECT t.*, a.symbol, a.name, a.type, t.created_at AS executed_at
      FROM trades t
      JOIN assets a ON t.asset_id = a.id
      WHERE t.user_id = ${this.userId}
        AND (t.account_type = ${accountType} OR t.account_type IS NULL)
      ORDER BY t.created_at DESC
      LIMIT ${limit}
    `
  }

  // Get positions
  async getPositions(status = 'all', symbol = null) {
    // Get user's active trading mode to filter by account type
    let accountType = 'REAL'
    try {
      const vaRows = await prisma.$queryRawUnsafe(
        `SELECT trading_mode FROM virtual_accounts WHERE user_id = $1 LIMIT 1`,
        this.userId
      )
      accountType = vaRows?.[0]?.trading_mode === 'REAL' ? 'REAL' : 'DEMO'
    } catch (e) { /* default REAL */ }

    if (status === 'open') {
      if (symbol) {
        return prisma.$queryRaw`
          SELECT p.*, a.symbol, a.name, a.type
          FROM trading_positions p
          JOIN assets a ON p.asset_id = a.id
          WHERE p.user_id = ${this.userId} 
          AND p.status = 'OPEN' 
          AND a.symbol = ${symbol}
          AND (p.account_type = ${accountType} OR p.account_type IS NULL)
          ORDER BY p.opened_at DESC
        `
      }
      return prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.user_id = ${this.userId} AND p.status = 'OPEN'
        AND (p.account_type = ${accountType} OR p.account_type IS NULL)
        ORDER BY p.opened_at DESC
      `
    } else if (status === 'closed') {
      return prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.user_id = ${this.userId} AND p.status = 'CLOSED'
        AND (p.account_type = ${accountType} OR p.account_type IS NULL)
        ORDER BY p.closed_at DESC
      `
    }
    return prisma.$queryRaw`
      SELECT p.*, a.symbol, a.name, a.type
      FROM trading_positions p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.user_id = ${this.userId}
      AND (p.account_type = ${accountType} OR p.account_type IS NULL)
      ORDER BY p.opened_at DESC
    `
  }

  // Create limit order
  async createLimitOrder(params) {
    const { symbol, type, action, quantity, limitPrice, expiresAt } = params
    
    const asset = await this.getAsset(symbol)
    if (!asset) {
      return { success: false, error: 'Asset not found' }
    }

    const id = uuidv4()
    await prisma.$executeRaw`
      INSERT INTO pending_orders (
        id, user_id, asset_id, order_type, side, quantity, 
        limit_price, expires_at, status
      )
      VALUES (
        ${id}, ${this.userId}, ${asset.id}, 
        'LIMIT'::"OrderType", ${action}::"TradeSide", ${quantity}, ${limitPrice},
        ${expiresAt || null}, 'PENDING'::"OrderStatus"
      )
    `

    return {
      success: true,
      order: { id, symbol, action, quantity, limitPrice, status: 'PENDING' }
    }
  }

  // Get pending orders
  async getPendingOrders() {
    return prisma.$queryRaw`
      SELECT o.*, a.symbol, a.name, a.type
      FROM pending_orders o
      JOIN assets a ON o.asset_id = a.id
      WHERE o.user_id = ${this.userId} AND o.status = 'PENDING'
      ORDER BY o.created_at DESC
    `
  }

  // Cancel order
  async cancelOrder(orderId) {
    await prisma.$executeRaw`
      UPDATE pending_orders 
      SET status = 'CANCELLED'
      WHERE id = ${orderId} AND user_id = ${this.userId}
    `
    return { success: true }
  }
}

export default TradeService
