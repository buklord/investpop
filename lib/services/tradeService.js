// Trade Service - Handles all trading operations
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { getMarketDataProvider } from '@/lib/providers/marketDataProvider'
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

  // Get asset by symbol
  async getAsset(symbol) {
    const assets = await prisma.$queryRaw`
      SELECT id, symbol, name, type FROM assets WHERE symbol = ${symbol.toUpperCase()}
    `
    return assets.length > 0 ? assets[0] : null
  }

  // Get current market price from provider
  async getMarketPrice(symbol, type) {
    const provider = getMarketDataProvider()
    const quote = await provider.getQuote(symbol, type)
    return quote
  }

  // Get existing open position for asset
  async getOpenPosition(assetId) {
    const positions = await prisma.$queryRaw`
      SELECT * FROM trading_positions 
      WHERE user_id = ${this.userId} 
      AND asset_id = ${assetId} 
      AND status = 'OPEN'
    `
    return positions.length > 0 ? positions[0] : null
  }

  // Execute a market trade
  async executeTrade(params) {
    const { symbol, type, action, quantity, takeProfit, stopLoss, leverage = 1 } = params
    
    // 1. Validate asset exists
    const asset = await this.getAsset(symbol)
    if (!asset) {
      return { success: false, error: 'Asset not found' }
    }

    // 2. Get current market price (SERVER-SIDE only)
    let quote
    try {
      quote = await this.getMarketPrice(symbol, type)
    } catch (err) {
      return { success: false, error: 'Failed to fetch current market price' }
    }
    const marketPrice = quote.price

    // 3. Calculate executed price with slippage
    const isBuy = action === 'BUY'
    const { executedPrice, slippagePercent, slippageAmount } = calculateExecutedPrice(marketPrice, isBuy)

    // 4. Get account and existing position
    const account = await this.accountService.getAccount()
    const existingPosition = await this.getOpenPosition(asset.id)

    // 5. Validate trade requirements
    const validation = validateTradeRequirements(
      action, quantity, executedPrice, account.balance, existingPosition
    )
    
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('. ') }
    }

    // 6. Calculate trade values
    const totalValue = executedPrice * quantity
    const fee = calculateTradingFee(totalValue)

    // 7. Execute trade based on action
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
        leverage
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
        existingPosition
      })
    }
  }

  // Execute BUY order
  async executeBuy(params) {
    const {
      asset, quantity, marketPrice, executedPrice, slippagePercent,
      totalValue, fee, existingPosition, takeProfit, stopLoss, leverage
    } = params

    const totalDeduction = totalValue + fee
    let positionId
    let newEntryPrice = executedPrice
    let newQuantity = quantity
    let totalInvested = totalValue

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

      // Update existing position
      await prisma.$executeRaw`
        UPDATE trading_positions 
        SET quantity = ${newQuantity}, 
            entry_price = ${newEntryPrice},
            total_invested = ${totalInvested},
            total_fees = COALESCE(total_fees, 0) + ${fee},
            take_profit = ${takeProfit || existingPosition.take_profit},
            stop_loss = ${stopLoss || existingPosition.stop_loss},
            leverage = ${leverage}
        WHERE id = ${positionId}
      `
    } else {
      // Create new position
      positionId = uuidv4()
      await prisma.$executeRaw`
        INSERT INTO trading_positions (
          id, user_id, asset_id, side, quantity, entry_price,
          take_profit, stop_loss, leverage, status, total_invested, total_fees
        )
        VALUES (
          ${positionId}, ${this.userId}, ${asset.id}, 'LONG',
          ${quantity}, ${executedPrice}, ${takeProfit || null}, ${stopLoss || null},
          ${leverage}, 'OPEN', ${totalValue}, ${fee}
        )
      `
    }

    // Record trade
    const tradeId = uuidv4()
    await prisma.$executeRaw`
      INSERT INTO trades (
        id, user_id, asset_id, position_id, side, quantity, 
        price, total_value, fee_amount, slippage, market_price
      )
      VALUES (
        ${tradeId}, ${this.userId}, ${asset.id}, ${positionId},
        'BUY', ${quantity}, ${executedPrice}, ${totalValue}, ${fee}, ${slippagePercent}, ${marketPrice}
      )
    `

    // Deduct from balance (cost + fee)
    await this.accountService.updateBalance(totalDeduction, 'subtract')

    // Create account snapshot
    await this.accountService.createSnapshot(tradeId, 'BUY')

    // Update daily performance
    await this.accountService.updateDailyPerformance(fee)

    return {
      success: true,
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
  }

  // Execute SELL order
  async executeSell(params) {
    const {
      asset, quantity, marketPrice, executedPrice, slippagePercent,
      totalValue, fee, existingPosition
    } = params

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
        price, total_value, fee_amount, slippage, market_price
      )
      VALUES (
        ${tradeId}, ${this.userId}, ${asset.id}, ${existingPosition.id},
        'SELL', ${quantity}, ${executedPrice}, ${totalValue}, ${fee}, ${slippagePercent}, ${marketPrice}
      )
    `

    // Add proceeds to balance
    await this.accountService.updateBalance(netProceeds, 'add')

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
            total_fees = ${totalFees}
        WHERE id = ${existingPosition.id}
      `
    } else {
      // Partial close - reduce quantity
      await prisma.$executeRaw`
        UPDATE trading_positions 
        SET quantity = ${remainingQuantity},
            total_fees = COALESCE(total_fees, 0) + ${fee}
        WHERE id = ${existingPosition.id}
      `
    }

    // Create account snapshot
    await this.accountService.createSnapshot(tradeId, 'SELL')

    // Update daily performance
    await this.accountService.updateDailyPerformance(fee)

    return {
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
  }

  // Get trade history
  async getTradeHistory(limit = 100) {
    return prisma.$queryRaw`
      SELECT t.*, a.symbol, a.name, a.type
      FROM trades t
      JOIN assets a ON t.asset_id = a.id
      WHERE t.user_id = ${this.userId}
      ORDER BY t.executed_at DESC
      LIMIT ${limit}
    `
  }

  // Get positions
  async getPositions(status = 'all', symbol = null) {
    if (status === 'open') {
      if (symbol) {
        return prisma.$queryRaw`
          SELECT p.*, a.symbol, a.name, a.type
          FROM trading_positions p
          JOIN assets a ON p.asset_id = a.id
          WHERE p.user_id = ${this.userId} 
          AND p.status = 'OPEN' 
          AND a.symbol = ${symbol}
          ORDER BY p.opened_at DESC
        `
      }
      return prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.user_id = ${this.userId} AND p.status = 'OPEN'
        ORDER BY p.opened_at DESC
      `
    } else if (status === 'closed') {
      return prisma.$queryRaw`
        SELECT p.*, a.symbol, a.name, a.type
        FROM trading_positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.user_id = ${this.userId} AND p.status = 'CLOSED'
        ORDER BY p.closed_at DESC
      `
    }
    return prisma.$queryRaw`
      SELECT p.*, a.symbol, a.name, a.type
      FROM trading_positions p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.user_id = ${this.userId}
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
