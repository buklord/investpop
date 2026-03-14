# Synchronized Copy Trading Implementation

## Overview

This document describes the newly implemented **synchronized copy trading** feature that ensures followers' trades mirror their leader's trades completely - including both opening AND closing at the same profit/loss percentages.

## What's New

### Before
- When an admin/super_admin opened a trade, followers would automatically open proportional trades ✅
- When an admin/super_admin closed a trade, followers' positions remained open ❌
- Followers had to manually close their positions or wait for stop-loss/take-profit ❌

### After (NEW Implementation)
- When an admin/super_admin opens a trade, followers automatically open proportional trades ✅
- **When an admin/super_admin closes a trade, followers' positions automatically close at the SAME profit/loss percentage** ✅
- Example: Leader closes at +5% profit → All followers close at +5% profit
- Example: Leader closes at -3% loss → All followers close at -3% loss
- **Followers win and lose together with their leader on every trade** ✅

## How It Works

### 1. Position Linking

When a follower copies a leader's trade:
```
Leader opens BTC position → Position ID: abc-123
Follower copies trade → Follower's position stores: leader_position_id = abc-123
```

This link allows the system to find all follower positions when the leader closes.

### 2. Synchronized Closing

When a leader closes a position:
```
1. Leader closes position abc-123
2. Calculate P/L percentage: (exitPrice - entryPrice) / entryPrice * 100
3. Find all follower positions where leader_position_id = abc-123
4. For each follower position:
   - Calculate target exit price to achieve SAME P/L percentage
   - Close follower's position at that calculated price
   - Update follower's profit/loss stats
5. All followers close at the same P/L % as the leader
```

### 3. Example Scenario

**Leader's Trade:**
- Entry: $50,000
- Exit: $52,500
- P/L: +5%

**Follower A (1.0x ratio, $5,000 balance):**
- Entry: $50,000
- Exit: $52,500 (same price)
- P/L: +5% (same percentage)
- Profit: $125 (5% of their $2,500 position)

**Follower B (0.5x ratio, $2,000 balance):**
- Entry: $50,000
- Exit: $52,500 (same price)
- P/L: +5% (same percentage)
- Profit: $25 (5% of their $500 position)

## Technical Implementation

### Database Changes

**Added to `trading_positions` table:**
```sql
leader_position_id TEXT  -- Links follower positions to leader positions
```

**Index added:**
```sql
CREATE INDEX tp_leader_position_idx ON trading_positions (leader_position_id) 
WHERE leader_position_id IS NOT NULL
```

### Code Changes

#### 1. Copy Trading Service (`lib/services/copyTradingService.js`)

**New Method: `executeCopyCloses()`**
```javascript
static async executeCopyCloses(leaderId, leaderCloseData) {
  // 1. Find all follower positions linked to the leader's position
  // 2. Calculate the profit/loss percentage from leader's close
  // 3. For each follower position:
  //    - Calculate target exit price for same P/L %
  //    - Execute close trade at calculated price
  //    - Update follower stats
  // 4. Return results
}
```

**Updated Method: `executeCopyTrades()`**
- Now stores `leader_position_id` in follower positions
- Links follower positions to leader positions for close tracking

#### 2. Trade Service (`lib/services/tradeService.js`)

**New Method: `triggerCopyCloses()`**
```javascript
async triggerCopyCloses(closeData) {
  // Checks if user is leader (ADMIN/SUPER_ADMIN)
  // Calculates P/L percentage
  // Triggers CopyTradingService.executeCopyCloses()
}
```

**Updated: `executeTrade()`**
- Accepts `customPrice` parameter for copy closes
- Accepts `isCopyClose` flag to prevent recursion
- Passes position ID when triggering copy trades

**Updated: `executeSell()`**
- Triggers copy closes when leader closes a position
- Only triggers for actual closes (not for copy closes)

#### 3. API Routes (`app/api/[[...path]]/route.js`)

**Schema Migration:**
- Added `leader_position_id` column to `trading_positions` table
- Added index for efficient position lookup

**Updated: `/api/admin/force-close`**
- Now triggers copy closes when admin force-closes a position
- All follower positions close at same P/L %

**Updated: `/api/admin/force-settle`**
- Now triggers copy closes when admin force-settles a position
- Follower positions close at admin-specified P/L %

## Close Trigger Points

The synchronized close system triggers in these scenarios:

1. **Regular Trade Close**: Leader sells their position normally
2. **Admin Force Close**: Admin force-closes a leader's position
3. **Admin Force Settle**: Admin settles a leader's position with profit/loss

## Copy Close Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Leader closes position (any method)                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Calculate P/L percentage: (exit - entry) / entry * 100     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Query follower positions: WHERE leader_position_id = X     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ For each follower position:                                │
│   • Calculate target exit price for same P/L %             │
│   • Execute sell trade at calculated price                 │
│   • Update follower profit stats                           │
│   • Log copy close event                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ All followers closed at same P/L % as leader               │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

### For Followers
1. **True Mirror Trading**: Positions automatically mirror leader's complete trade lifecycle
2. **Consistent Results**: Same profit/loss percentage as your leader
3. **No Manual Management**: Don't need to monitor and manually close trades
4. **Synchronized Risk**: Win and lose together with your leader

### For Leaders (Admins)
1. **Full Control**: Your followers' trades mirror your exact trade outcomes
2. **Builds Trust**: Followers see identical results to yours
3. **Professional Management**: Acts like institutional copy trading platforms

### For Platform
1. **Industry Standard**: Matches behavior of eToro, ZuluTrade, etc.
2. **Better UX**: Followers don't need to understand when to exit
3. **Increased Confidence**: True one-to-one trade mirroring

## Safety Features

### Prevents Recursion
- `isCopyClose` flag prevents followers' closes from triggering more copy closes
- Only leader closes trigger follower closes

### Error Handling
- Copy closes run in background (non-blocking)
- Failed copy closes are logged but don't affect leader
- Each follower close is independent (one failure doesn't affect others)

### Validation
- Only active follower connections trigger closes
- Position must be linked (has `leader_position_id`)
- Follower position must be OPEN status

## Logging & Tracking

### Copy Trade History
All copy closes are logged in `copy_trade_history`:
```javascript
{
  action: 'CLOSE',
  symbol: 'BTC',
  profitLossPercent: 5.23,
  closeType: 'MARKET',  // or ADMIN_FORCE_CLOSE, ADMIN_FORCE_SETTLE
  status: 'CLOSED'
}
```

### Follower Stats Updated
- `total_profit_from_copying`: Running total of profits/losses
- `daily_loss`: Tracked for risk management limits

## Testing Checklist

After deployment, verify:

- [ ] Leader opens trade → Follower positions created with `leader_position_id`
- [ ] Leader closes at profit → Followers close at same profit %
- [ ] Leader closes at loss → Followers close at same loss %
- [ ] Admin force-close → Followers also close
- [ ] Admin force-settle → Followers close at specified %
- [ ] Multiple followers → All close at same P/L %
- [ ] Follower stats update correctly
- [ ] Copy close history logged properly
- [ ] No recursion (follower closes don't trigger more closes)

## API Testing

You can test with these scenarios:

1. **Create follower connection:** `POST /api/copy-trading/follow`
2. **Leader opens trade:** Place a buy order as admin
3. **Check follower position:** Verify `leader_position_id` is set
4. **Leader closes trade:** Sell the position
5. **Verify follower closed:** Check follower's position is CLOSED with same P/L %

## Documentation Updated

- ✅ [COPY_TRADING.md](COPY_TRADING.md) - Updated with synchronized closing info
- ✅ Code comments added to all new methods
- ✅ This implementation guide created

## Future Enhancements

Potential improvements:
- Partial close synchronization (close 50% → followers also close 50%)
- Configurable close behavior (some followers may want manual close)
- Close notification system for followers
- Performance analytics showing sync accuracy

## Support

For issues or questions about synchronized copy trading:
1. Check server logs for `[CopyTrading]` messages
2. Verify `leader_position_id` is set on follower positions
3. Check `copy_trade_history` for close events
4. Monitor follower profit stats for accuracy

---

**Implementation Date**: March 14, 2026
**Status**: ✅ Complete and Ready for Testing
