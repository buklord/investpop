import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { TradeService } from '@/lib/services/tradeService'
import { getMarketDataProvider } from '@/lib/providers/marketDataProvider'

export async function POST() {
  try {
    // This endpoint is designed to be called by a cron job or scheduler
    // It checks all pending limit orders and executes those that meet conditions
    
    const pendingOrders = await prisma.$queryRaw`
      SELECT * FROM pending_orders
      WHERE status = 'PENDING'
        AND (expires_at IS NULL OR expires_at > NOW())
    `

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({ executed: 0, message: 'No pending orders to execute' })
    }

    const provider = getMarketDataProvider()
    const executed = []
    const expired = []

    for (const order of pendingOrders) {
      try {
        // Check if expired
        if (order.expires_at && new Date(order.expires_at) < new Date()) {
          await prisma.$executeRaw`
            UPDATE pending_orders SET status = 'EXPIRED' WHERE id = ${order.id}
          `
          expired.push(order.id)
          continue
        }

        // Get current market price
        const quote = await provider.getQuote(order.symbol, order.asset_type)
        const currentPrice = quote?.price

        if (!currentPrice) continue

        const limitPrice = parseFloat(order.limit_price)
        const shouldExecute = order.side === 'BUY' 
          ? currentPrice <= limitPrice  // Buy when price drops to or below limit
          : currentPrice >= limitPrice  // Sell when price rises to or above limit

        if (shouldExecute) {
          // Execute the trade
          const tradeService = new TradeService(order.user_id)
          const result = await tradeService.executeTrade({
            symbol: order.symbol,
            type: order.asset_type,
            action: order.side,
            quantity: parseFloat(order.quantity),
            customPrice: currentPrice
          })

          if (result.success) {
            await prisma.$executeRaw`
              UPDATE pending_orders 
              SET status = 'EXECUTED', 
                  executed_at = NOW(),
                  executed_price = ${currentPrice}
              WHERE id = ${order.id}
            `
            executed.push({ orderId: order.id, price: currentPrice })
          }
        }
      } catch (err) {
        console.warn(`[limit-orders] Failed to process order ${order.id}:`, err.message)
      }
    }

    return NextResponse.json({
      executed: executed.length,
      expired: expired.length,
      executedOrders: executed,
      expiredOrders: expired
    })

  } catch (error) {
    console.error('[limit-orders/execute] error:', error)
    return NextResponse.json({ error: 'Failed to execute limit orders' }, { status: 500 })
  }
}
