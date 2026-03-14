// Copy Trading Service - Implements industry-standard proportional copy trading
import prisma from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { TradeService } from './tradeService'
import { AccountService } from './accountService'

/**
 * Industry-Standard Copy Trading Implementation
 * 
 * Based on best practices from eToro, MetaTrader Social Trading, and other platforms:
 * 
 * 1. PROPORTIONAL POSITION SIZING:
 *    - Trades are scaled based on % of available capital used
 *    - Formula: followerSize = (leaderSize / leaderEquity) * followerEquity * copyRatio
 * 
 * 2. COPY RATIO (Multiplier):
 *    - Followers can adjust exposure from 0.1x to 2.0x
 *    - Default is 1.0x (same proportion as leader)
 * 
 * 3. RISK MANAGEMENT:
 *    - Min balance requirements to start copying
 *    - Max position size limits per trade
 *    - Stop copying on max daily loss threshold
 *    - Individual position stop loss protection
 * 
 * 4. CONNECTION STATES:
 *    - ACTIVE: Actively copying trades
 *    - PAUSED: Temporarily stopped, can resume
 *    - STOPPED: Permanently stopped, must reconnect
 */

export class CopyTradingService {
  constructor(userId) {
    this.userId = userId
  }

  // Constants for risk management
  static LIMITS = {
    MIN_FOLLOWER_BALANCE: 100, // Minimum $100 to start copying
    MAX_COPY_RATIO: 2.0,       // Maximum 2x leverage on copying
    MIN_COPY_RATIO: 0.1,       // Minimum 0.1x on copying
    MAX_POSITION_PERCENT: 20,  // Max 20% of balance per position
    MAX_DAILY_LOSS_PERCENT: 10 // Stop if lose 10% in a day
  }

  /**
   * Get list of available leaders (ADMIN and SUPER_ADMIN only)
   */
  static async getAvailableLeaders() {
    const leaders = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.email,
        u.role,
        COALESCE(ctr.total_followers, 0) as follower_count,
        COALESCE(ctr.total_copied_volume, 0) as total_volume,
        COALESCE(ctr.performance_rating, 0) as rating
      FROM users u
      LEFT JOIN copy_trading_leaders ctr ON ctr.user_id = u.id
      WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
        AND u.is_suspended = FALSE
      ORDER BY follower_count DESC
    `
    return leaders
  }

  /**
   * Start following a leader
   */
  async followLeader(leaderId, copyRatio = 1.0) {
    // Validate copy ratio
    if (copyRatio < CopyTradingService.LIMITS.MIN_COPY_RATIO || 
        copyRatio > CopyTradingService.LIMITS.MAX_COPY_RATIO) {
      return {
        success: false,
        error: `Copy ratio must be between ${CopyTradingService.LIMITS.MIN_COPY_RATIO} and ${CopyTradingService.LIMITS.MAX_COPY_RATIO}`
      }
    }

    // Check if leader is admin/super_admin
    const leaderCheck = await prisma.$queryRaw`
      SELECT role FROM users 
      WHERE id = ${leaderId} 
        AND role IN ('ADMIN', 'SUPER_ADMIN')
        AND is_suspended = FALSE
    `
    if (!leaderCheck || leaderCheck.length === 0) {
      return { success: false, error: 'Invalid leader or leader not available' }
    }

    // Check follower balance
    const accountService = new AccountService(this.userId)
    const account = await accountService.getAccount()
    if (account.balance < CopyTradingService.LIMITS.MIN_FOLLOWER_BALANCE) {
      return {
        success: false,
        error: `Minimum balance of $${CopyTradingService.LIMITS.MIN_FOLLOWER_BALANCE} required to start copy trading`
      }
    }

    // Check if already following
    const existing = await prisma.$queryRaw`
      SELECT id, status FROM copy_trading_followers
      WHERE follower_id = ${this.userId} AND leader_id = ${leaderId}
      LIMIT 1
    `

    const connectionId = uuidv4()
    const now = new Date()

    if (existing && existing.length > 0) {
      // Already following - update settings
      await prisma.$executeRaw`
        UPDATE copy_trading_followers
        SET copy_ratio = ${copyRatio},
            status = 'ACTIVE',
            updated_at = ${now}
        WHERE follower_id = ${this.userId} AND leader_id = ${leaderId}
      `
    } else {
      // Create new connection
      await prisma.$executeRaw`
        INSERT INTO copy_trading_followers (
          id, follower_id, leader_id, copy_ratio, status,
          start_balance, created_at, updated_at
        ) VALUES (
          ${connectionId}, ${this.userId}, ${leaderId}, ${copyRatio}, 'ACTIVE',
          ${account.balance}, ${now}, ${now}
        )
      `

      // Update leader stats
      await this.updateLeaderStats(leaderId)
    }

    return { success: true, connectionId }
  }

  /**
   * Stop following a leader
   */
  async unfollowLeader(leaderId) {
    await prisma.$executeRaw`
      UPDATE copy_trading_followers
      SET status = 'STOPPED', updated_at = NOW()
      WHERE follower_id = ${this.userId} AND leader_id = ${leaderId}
    `

    await this.updateLeaderStats(leaderId)
    return { success: true }
  }

  /**
   * Pause/Resume copying
   */
  async updateCopyStatus(leaderId, status) {
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return { success: false, error: 'Invalid status' }
    }

    await prisma.$executeRaw`
      UPDATE copy_trading_followers
      SET status = ${status}, updated_at = NOW()
      WHERE follower_id = ${this.userId} AND leader_id = ${leaderId}
    `

    return { success: true }
  }

  /**
   * Get my following list
   */
  async getMyFollowing() {
    const following = await prisma.$queryRaw`
      SELECT 
        cf.*,
        u.email as leader_email,
        va.balance as leader_balance
      FROM copy_trading_followers cf
      JOIN users u ON u.id = cf.leader_id
      LEFT JOIN virtual_accounts va ON va.user_id = cf.leader_id
      WHERE cf.follower_id = ${this.userId}
      ORDER BY cf.created_at DESC
    `
    return following
  }

  /**
   * Get my followers (if I'm a leader)
   */
  async getMyFollowers() {
    const followers = await prisma.$queryRaw`
      SELECT 
        cf.*,
        u.email as follower_email,
        va.balance as follower_balance
      FROM copy_trading_followers cf
      JOIN users u ON u.id = cf.follower_id
      LEFT JOIN virtual_accounts va ON va.user_id = cf.follower_id
      WHERE cf.leader_id = ${this.userId}
        AND cf.status = 'ACTIVE'
      ORDER BY cf.created_at DESC
    `
    return followers
  }

  /**
   * Update leader statistics
   */
  async updateLeaderStats(leaderId) {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_followers,
        COALESCE(SUM(total_copied_volume), 0) as total_volume
      FROM copy_trading_followers
      WHERE leader_id = ${leaderId} AND status = 'ACTIVE'
    `

    const followerCount = parseInt(stats[0]?.total_followers || 0)
    const totalVolume = parseFloat(stats[0]?.total_volume || 0)

    // Upsert leader stats
    await prisma.$executeRaw`
      INSERT INTO copy_trading_leaders (id, user_id, total_followers, total_copied_volume, updated_at)
      VALUES (gen_random_uuid()::text, ${leaderId}, ${followerCount}, ${totalVolume}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        total_followers = ${followerCount},
        total_copied_volume = ${totalVolume},
        updated_at = NOW()
    `
  }

  /**
   * Execute copy trades for all followers when leader makes a trade
   * This is called after a leader successfully executes a trade
   */
  static async executeCopyTrades(leaderId, leaderTradeData) {
    try {
      const { symbol, type, action, quantity, takeProfit, stopLoss, leverage } = leaderTradeData

      // Get leader's account to calculate proportion
      const leaderAccountService = new AccountService(leaderId)
      const leaderAccount = await leaderAccountService.getAccount()
      const leaderEquity = leaderAccount.balance
      
      if (leaderEquity <= 0) {
        console.warn('[CopyTrading] Leader has zero or negative equity, skipping copy trades')
        return { copiedCount: 0 }
      }

      // Get all active followers
      const followers = await prisma.$queryRaw`
        SELECT follower_id, copy_ratio, total_trades_copied, total_copied_volume,
               start_balance, daily_loss, last_reset_date
        FROM copy_trading_followers
        WHERE leader_id = ${leaderId} 
          AND status = 'ACTIVE'
      `

      if (!followers || followers.length === 0) {
        return { copiedCount: 0 }
      }

      // Get leader's actual executed price and value (this would come from the trade result)
      const leaderPositionValue = quantity * leaderTradeData.executedPrice || 0
      const leaderPositionPercent = (leaderPositionValue / leaderEquity) * 100

      let copiedCount = 0
      const copyResults = []

      for (const follower of followers) {
        try {
          // Check daily loss limit (reset if new day)
          const today = new Date().toISOString().split('T')[0]
          const lastReset = follower.last_reset_date ? 
            new Date(follower.last_reset_date).toISOString().split('T')[0] : null
          
          let dailyLoss = follower.daily_loss || 0
          if (lastReset !== today) {
            // Reset daily loss for new day
            dailyLoss = 0
            await prisma.$executeRaw`
              UPDATE copy_trading_followers
              SET daily_loss = 0, last_reset_date = NOW()
              WHERE follower_id = ${follower.follower_id} AND leader_id = ${leaderId}
            `
          }

          // Check if follower hit daily loss limit
          const startBalance = follower.start_balance || 0
          if (startBalance > 0) {
            const lossPercent = (dailyLoss / startBalance) * 100
            if (lossPercent >= CopyTradingService.LIMITS.MAX_DAILY_LOSS_PERCENT) {
              console.warn(`[CopyTrading] Follower ${follower.follower_id} hit daily loss limit, pausing`)
              await prisma.$executeRaw`
                UPDATE copy_trading_followers
                SET status = 'PAUSED'
                WHERE follower_id = ${follower.follower_id} AND leader_id = ${leaderId}
              `
              continue
            }
          }

          // Get follower's account
          const followerAccountService = new AccountService(follower.follower_id)
          const followerAccount = await followerAccountService.getAccount()
          const followerEquity = followerAccount.balance

          // Check minimum balance
          if (followerEquity < CopyTradingService.LIMITS.MIN_FOLLOWER_BALANCE) {
            console.warn(`[CopyTrading] Follower ${follower.follower_id} below minimum balance`)
            continue
          }

          // Calculate proportional position size
          // Formula: followerSize = (leaderSize / leaderEquity) * followerEquity * copyRatio
          const copyRatio = follower.copy_ratio || 1.0
          const proportionalPercent = leaderPositionPercent * copyRatio
          
          // Apply max position size limit
          const finalPercent = Math.min(proportionalPercent, CopyTradingService.LIMITS.MAX_POSITION_PERCENT)
          const followerPositionValue = (followerEquity * finalPercent) / 100
          
          // Calculate follower quantity (assuming same price as leader)
          const estimatedPrice = leaderTradeData.executedPrice || leaderTradeData.price || 0
          if (estimatedPrice <= 0) {
            console.warn(`[CopyTrading] Invalid price for copy trade`)
            continue
          }

          const followerQuantity = followerPositionValue / estimatedPrice

          // Minimum quantity validation (prevent dust trades)
          if (followerQuantity < 0.0001) {
            console.warn(`[CopyTrading] Follower ${follower.follower_id} quantity too small, skipping`)
            continue
          }

          // Execute the copy trade
          const tradeService = new TradeService(follower.follower_id)
          const result = await tradeService.executeTrade({
            symbol,
            type,
            action,
            quantity: followerQuantity,
            takeProfit,
            stopLoss,
            leverage: leverage || 1,
            isCopyTrade: true, // Flag to identify copy trades
            copiedFromLeader: leaderId
          })

          if (result.success) {
            copiedCount++
            
            // Update follower stats
            const newTotalTrades = (follower.total_trades_copied || 0) + 1
            const newTotalVolume = (follower.total_copied_volume || 0) + followerPositionValue
            
            await prisma.$executeRaw`
              UPDATE copy_trading_followers
              SET total_trades_copied = ${newTotalTrades},
                  total_copied_volume = ${newTotalVolume},
                  last_copy_at = NOW(),
                  updated_at = NOW()
              WHERE follower_id = ${follower.follower_id} AND leader_id = ${leaderId}
            `

            // Log the copy trade
            await prisma.$executeRaw`
              INSERT INTO copy_trade_history (
                id, follower_id, leader_id, original_trade_data,
                copied_quantity, copied_value, status, created_at
              ) VALUES (
                gen_random_uuid()::text, ${follower.follower_id}, ${leaderId},
                ${JSON.stringify(leaderTradeData)}::jsonb,
                ${followerQuantity}, ${followerPositionValue}, 'EXECUTED', NOW()
              )
            `

            copyResults.push({
              followerId: follower.follower_id,
              success: true,
              quantity: followerQuantity,
              value: followerPositionValue
            })
          } else {
            // Log failed copy trade
            await prisma.$executeRaw`
              INSERT INTO copy_trade_history (
                id, follower_id, leader_id, original_trade_data,
                copied_quantity, copied_value, status, error_message, created_at
              ) VALUES (
                gen_random_uuid()::text, ${follower.follower_id}, ${leaderId},
                ${JSON.stringify(leaderTradeData)}::jsonb,
                ${followerQuantity}, ${followerPositionValue}, 'FAILED',
                ${result.error || 'Unknown error'}, NOW()
              )
            `

            copyResults.push({
              followerId: follower.follower_id,
              success: false,
              error: result.error
            })
          }
        } catch (err) {
          console.error(`[CopyTrading] Error copying trade for follower ${follower.follower_id}:`, err)
          copyResults.push({
            followerId: follower.follower_id,
            success: false,
            error: err.message
          })
        }
      }

      // Update leader stats
      await prisma.$executeRaw`
        UPDATE copy_trading_leaders
        SET total_copied_volume = total_copied_volume + ${leaderPositionValue * copiedCount}
        WHERE user_id = ${leaderId}
      `

      return {
        copiedCount,
        totalFollowers: followers.length,
        results: copyResults
      }
    } catch (err) {
      console.error('[CopyTrading] Error in executeCopyTrades:', err)
      return { copiedCount: 0, error: err.message }
    }
  }

  /**
   * Get copy trading statistics for a user
   */
  async getCopyTradingStats() {
    // Get stats as follower
    const followerStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as leaders_following,
        COALESCE(SUM(total_trades_copied), 0) as total_trades,
        COALESCE(SUM(total_copied_volume), 0) as total_volume,
        COALESCE(SUM(total_profit_from_copying), 0) as total_profit
      FROM copy_trading_followers
      WHERE follower_id = ${this.userId}
    `

    // Get stats as leader
    const leaderStats = await prisma.$queryRaw`
      SELECT 
        total_followers,
        total_copied_volume,
        performance_rating
      FROM copy_trading_leaders
      WHERE user_id = ${this.userId}
    `

    return {
      asFollower: followerStats[0] || {},
      asLeader: leaderStats[0] || { total_followers: 0, total_copied_volume: 0, performance_rating: 0 }
    }
  }
}
