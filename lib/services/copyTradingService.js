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
        u.first_name,
        u.last_name,
        SPLIT_PART(u.email, '@', 1) as username,
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

    // Check leader exists and is not suspended (any user can be a leader)
    const leaderCheck = await prisma.$queryRaw`
      SELECT id FROM users
      WHERE id = ${leaderId}
        AND is_suspended = FALSE
    `
    if (!leaderCheck || leaderCheck.length === 0) {
      return { success: false, error: 'Leader not found or account is suspended' }
    }
    // Prevent following yourself
    if (leaderId === this.userId) {
      return { success: false, error: 'You cannot copy your own account' }
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
        u.first_name as leader_first_name,
        u.last_name as leader_last_name,
        SPLIT_PART(u.email, '@', 1) as leader_username,
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
      console.log(`[DEBUG] executeCopyTrades called with leaderId=${leaderId}`)
      console.log(`[DEBUG] leaderTradeData:`, leaderTradeData)
      const { symbol, type, action, quantity, takeProfit, stopLoss, leverage, leaderPositionId } = leaderTradeData

      console.log(`[DEBUG] Extracted leaderPositionId from data:`, leaderPositionId)
      
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
               start_balance, daily_loss, last_reset_date, max_daily_loss
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
          // Use per-connection dollar limit if set, otherwise fall back to % default
          const startBalance = follower.start_balance || 0
          const maxDailyLossDollar = follower.max_daily_loss
            ? parseFloat(follower.max_daily_loss)
            : (startBalance > 0 ? startBalance * (CopyTradingService.LIMITS.MAX_DAILY_LOSS_PERCENT / 100) : null)
          if (maxDailyLossDollar !== null && dailyLoss >= maxDailyLossDollar) {
            console.warn(`[CopyTrading] Follower ${follower.follower_id} hit daily loss guardrail ($${maxDailyLossDollar}), pausing`)
            await prisma.$executeRaw`
              UPDATE copy_trading_followers
              SET status = 'PAUSED'
              WHERE follower_id = ${follower.follower_id} AND leader_id = ${leaderId}
            `
            continue
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
          console.log(`[DEBUG] executeCopyTrades: Creating copy trade for follower ${follower.follower_id}`)
          console.log(`[DEBUG] leaderPositionId being passed:`, leaderPositionId)
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
            copiedFromLeader: leaderId,
            leaderPositionId: leaderPositionId // Store the leader's position ID
          })

          console.log(`[DEBUG] executeTrade result:`, { success: result.success, positionId: result.positionId })
          
          if (result.success) {
            copiedCount++
            
            // Store the mapping between leader and follower positions
            if (leaderPositionId && result.positionId) {
              try {
                console.log(`[DEBUG] Updating position ${result.positionId} with leader_position_id ${leaderPositionId}`)
                const updateResult = await prisma.$executeRaw`
                  UPDATE trading_positions
                  SET leader_position_id = ${leaderPositionId}
                  WHERE id = ${result.positionId}
                `
                console.log(`[DEBUG] UPDATE affected ${updateResult} row(s)`)
                if (updateResult > 0) {
                  console.log(`[DEBUG] Successfully linked follower position ${result.positionId} to leader ${leaderPositionId}`)
                } else {
                  console.error(`[DEBUG] UPDATE returned 0 - position ${result.positionId} may not exist!`)
                }
              } catch (err) {
                console.error(`[CopyTrading] Failed to link position for follower ${follower.follower_id}:`, err.message)
                console.error(`[CopyTrading] Full error:`, err)
              }
            } else {
              console.warn(`[DEBUG] Cannot link position: leaderPositionId=${leaderPositionId}, result.positionId=${result.positionId}`)
            }
            
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

      // Emit platform feed event if at least one copy was made
      if (copiedCount > 0) {
        try {
          await prisma.$executeRaw`
            INSERT INTO copy_trade_events (id, leader_id, action, symbol, side, quantity, follower_count, created_at)
            VALUES (gen_random_uuid()::text, ${leaderId}, 'OPEN', ${symbol}, ${action}, ${quantity}, ${copiedCount}, NOW())
          `
        } catch (feedErr) {
          console.warn('[CopyTrading] Could not emit feed event:', feedErr.message)
        }
      }

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
   * Execute copy closes for all followers when leader closes a position
   * This ensures followers close at the same profit/loss percentage as the leader
   */
  static async executeCopyCloses(leaderId, leaderCloseData) {
    try {
      console.log(`[DEBUG] executeCopyCloses called with leaderId=${leaderId}, data:`, leaderCloseData)
      const { leaderPositionId, profitLossPercent, symbol, closeType = 'MARKET' } = leaderCloseData

      if (!leaderPositionId) {
        console.warn('[CopyTrading] No leaderPositionId provided for copy close')
        return { closedCount: 0 }
      }

      console.log(`[CopyTrading] Closing follower positions for leader position ${leaderPositionId}, P/L: ${profitLossPercent}%`)

      // Find all follower positions linked to this leader position
      let followerPositions
      try {
        followerPositions = await prisma.$queryRaw`
          SELECT tp.*, u.role as user_role, ctf.copy_ratio, ctf.follower_id, ctf.leader_id,
                 a.symbol as asset_symbol, a.type as asset_type
          FROM trading_positions tp
          JOIN copy_trading_followers ctf ON ctf.follower_id = tp.user_id AND ctf.leader_id = ${leaderId}
          JOIN users u ON u.id = tp.user_id
          JOIN assets a ON a.id = tp.asset_id
          WHERE tp.leader_position_id = ${leaderPositionId}
            AND tp.status = 'OPEN'
            AND ctf.status = 'ACTIVE'
        `
      } catch (err) {
        // Column might not exist yet during migration
        if (err.message && err.message.includes('leader_position_id')) {
          console.warn('[CopyTrading] leader_position_id column not yet migrated, skipping copy closes')
          return { closedCount: 0, migrationPending: true }
        }
        throw err
      }

      if (!followerPositions || followerPositions.length === 0) {
        console.log('[CopyTrading] No active follower positions found for this leader position')
        console.log(`[DEBUG] Query returned empty, leaderId=${leaderId}, leaderPositionId=${leaderPositionId}`)
        return { closedCount: 0 }
      }

      console.log(`[CopyTrading] Found ${followerPositions.length} follower positions to close`)
      console.log(`[DEBUG] Follower positions:`, followerPositions.map(p => ({ id: p.id, user_id: p.follower_id, symbol: p.asset_symbol })))

      let closedCount = 0
      const closeResults = []

      for (const followerPos of followerPositions) {
        try {
          const entryPrice = parseFloat(followerPos.entry_price)
          const quantity = parseFloat(followerPos.quantity)
          const entryValue = entryPrice * quantity

          // Calculate the target exit price based on the same profit/loss percentage
          // If leader gained X%, follower should also gain X%
          const targetPnl = entryValue * (profitLossPercent / 100)
          const exitPrice = entryPrice + (targetPnl / quantity)

          console.log(`[CopyTrading] Closing follower ${followerPos.follower_id} position ${followerPos.id}:`, {
            entryPrice,
            exitPrice,
            profitLossPercent,
            targetPnl
          })

          // Close the follower's position at the calculated price
          const tradeService = new TradeService(followerPos.follower_id)
          
          console.log(`[DEBUG] About to close follower position ${followerPos.id} with executeTrade`)
          // Execute sell to close the position at the target exit price
          const result = await tradeService.executeTrade({
            symbol: followerPos.asset_symbol,
            type: followerPos.asset_type,
            action: 'SELL',
            quantity: quantity,
            customPrice: exitPrice, // Use the calculated price
            isCopyClose: true, // Flag to identify copy closes
            copiedFromLeader: leaderId
          })

          console.log(`[DEBUG] executeTrade result for follower ${followerPos.follower_id}:`, result)
          if (result.success) {
            closedCount++
            
            // Update follower stats with profit
            if (targetPnl !== 0) {
              await prisma.$executeRaw`
                UPDATE copy_trading_followers
                SET total_profit_from_copying = COALESCE(total_profit_from_copying, 0) + ${targetPnl},
                    daily_loss = CASE 
                      WHEN ${targetPnl} < 0 THEN COALESCE(daily_loss, 0) + ABS(${targetPnl})
                      ELSE daily_loss
                    END,
                    updated_at = NOW()
                WHERE follower_id = ${followerPos.follower_id} AND leader_id = ${leaderId}
              `
            }

            // Log the copy close
            await prisma.$executeRaw`
              INSERT INTO copy_trade_history (
                id, follower_id, leader_id, original_trade_data,
                copied_quantity, copied_value, status, created_at
              ) VALUES (
                gen_random_uuid()::text, ${followerPos.follower_id}, ${leaderId},
                ${JSON.stringify({
                  action: 'CLOSE',
                  symbol,
                  profitLossPercent,
                  closeType,
                  leaderPositionId
                })}::jsonb,
                ${quantity}, ${targetPnl}, 'CLOSED', NOW()
              )
            `

            closeResults.push({
              followerId: followerPos.follower_id,
              positionId: followerPos.id,
              success: true,
              pnl: targetPnl
            })
          } else {
            console.error(`[CopyTrading] Failed to close follower ${followerPos.follower_id} position:`, result.error)
            
            closeResults.push({
              followerId: followerPos.follower_id,
              positionId: followerPos.id,
              success: false,
              error: result.error
            })
          }
        } catch (err) {
          console.error(`[CopyTrading] Error closing position for follower ${followerPos.follower_id}:`, err)
          closeResults.push({
            followerId: followerPos.follower_id,
            positionId: followerPos.id,
            success: false,
            error: err.message
          })
        }
      }

      console.log(`[CopyTrading] Copy close completed: ${closedCount}/${followerPositions.length} positions closed`)

      // Emit platform feed event for close
      if (closedCount > 0) {
        try {
          await prisma.$executeRaw`
            INSERT INTO copy_trade_events (id, leader_id, action, symbol, side, quantity, follower_count, created_at)
            VALUES (gen_random_uuid()::text, ${leaderId}, 'CLOSE', ${symbol || 'UNKNOWN'}, NULL, NULL, ${closedCount}, NOW())
          `
        } catch (feedErr) {
          console.warn('[CopyTrading] Could not emit close feed event:', feedErr.message)
        }
      }

      return {
        closedCount,
        totalFollowerPositions: followerPositions.length,
        results: closeResults
      }
    } catch (err) {
      console.error('[CopyTrading] Error in executeCopyCloses:', err)
      return { closedCount: 0, error: err.message }
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
