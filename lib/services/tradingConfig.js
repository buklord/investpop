// Trading Configuration Constants
export const TRADING_CONFIG = {
  // Fee structure
  TRADING_FEE_PERCENT: 0.001, // 0.1% per trade
  
  // Slippage simulation
  MIN_SLIPPAGE_PERCENT: 0.0001, // 0.01%
  MAX_SLIPPAGE_PERCENT: 0.0005, // 0.05%
  
  // Default values
  DEFAULT_LEVERAGE: 1,
  STARTING_BALANCE: 0,
  
  // Limits
  MAX_POSITION_SIZE_PERCENT: 0.5, // Max 50% of equity in single position
  MAX_LEVERAGE: 10,
  MIN_TRADE_VALUE: 1, // Minimum $1 trade
  
  // Risk management
  MARGIN_CALL_THRESHOLD: 0.3, // 30% equity warning
  LIQUIDATION_THRESHOLD: 0.2, // 20% equity liquidation
}

// Generate random slippage within configured range
export function generateSlippage(isBuy) {
  const { MIN_SLIPPAGE_PERCENT, MAX_SLIPPAGE_PERCENT } = TRADING_CONFIG
  const slippagePercent = MIN_SLIPPAGE_PERCENT + 
    Math.random() * (MAX_SLIPPAGE_PERCENT - MIN_SLIPPAGE_PERCENT)
  
  // Slippage works against the trader:
  // BUY = pay more (positive slippage)
  // SELL = receive less (negative slippage)
  return isBuy ? slippagePercent : -slippagePercent
}

// Calculate executed price with slippage
export function calculateExecutedPrice(marketPrice, isBuy) {
  const slippagePercent = generateSlippage(isBuy)
  const executedPrice = marketPrice * (1 + slippagePercent)
  return {
    executedPrice: Math.round(executedPrice * 100000) / 100000, // 5 decimal precision
    slippagePercent,
    slippageAmount: executedPrice - marketPrice
  }
}

// Calculate trading fee
export function calculateTradingFee(totalValue) {
  return Math.round(totalValue * TRADING_CONFIG.TRADING_FEE_PERCENT * 100) / 100
}

// Calculate weighted average entry price
export function calculateWeightedAveragePrice(
  existingQuantity,
  existingAvgPrice,
  newQuantity,
  newPrice
) {
  const totalQuantity = existingQuantity + newQuantity
  if (totalQuantity === 0) return 0
  
  const weightedPrice = (
    (existingQuantity * existingAvgPrice) + (newQuantity * newPrice)
  ) / totalQuantity
  
  return Math.round(weightedPrice * 100000) / 100000
}

// Calculate unrealized P&L
export function calculateUnrealizedPnL(
  currentPrice,
  averageEntryPrice,
  quantity,
  leverage = 1
) {
  return (currentPrice - averageEntryPrice) * quantity * leverage
}

// Calculate realized P&L on partial/full close
export function calculateRealizedPnL(
  sellPrice,
  averageEntryPrice,
  quantity,
  leverage = 1
) {
  return (sellPrice - averageEntryPrice) * quantity * leverage
}

// Validate trade requirements
export function validateTradeRequirements(
  action,
  quantity,
  price,
  balance,
  existingPosition
) {
  const errors = []
  const totalValue = quantity * price
  const fee = calculateTradingFee(totalValue)

  if (quantity <= 0) {
    errors.push('Quantity must be positive')
  }

  if (totalValue < TRADING_CONFIG.MIN_TRADE_VALUE) {
    errors.push(`Minimum trade value is $${TRADING_CONFIG.MIN_TRADE_VALUE}`)
  }

  if (action === 'BUY') {
    const requiredBalance = totalValue + fee
    if (balance < requiredBalance) {
      errors.push(`Insufficient balance. Required: $${requiredBalance.toFixed(2)}, Available: $${balance.toFixed(2)}`)
    }
  }

  if (action === 'SELL') {
    if (!existingPosition) {
      errors.push('No open position to sell')
    } else if (quantity > existingPosition.quantity) {
      errors.push(`Cannot sell more than owned. You have ${existingPosition.quantity} units.`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Calculate position risk metrics
export function calculatePositionRisk(
  currentPrice,
  entryPrice,
  quantity,
  leverage = 1,
  totalEquity
) {
  const positionValue = currentPrice * quantity
  const unrealizedPnL = calculateUnrealizedPnL(currentPrice, entryPrice, quantity, leverage)
  const pnlPercent = ((currentPrice / entryPrice) - 1) * 100 * leverage
  const portfolioWeight = (positionValue / totalEquity) * 100
  
  return {
    positionValue,
    unrealizedPnL,
    pnlPercent,
    portfolioWeight,
    isConcentrated: portfolioWeight > TRADING_CONFIG.MAX_POSITION_SIZE_PERCENT * 100
  }
}

export default TRADING_CONFIG
