# Copy Trading Feature Documentation

## Overview

The Copy Trading feature allows users to automatically replicate trades made by expert traders (leaders). Only **ADMIN** and **SUPER_ADMIN** users can be leaders that others can follow.

This implementation follows industry standards from platforms like eToro, MetaTrader Social Trading, and Interactive Brokers.

## How It Works

### For Followers

1. **Browse Leaders**: View available admin/super-admin traders to copy
2. **Connect**: Start following a leader with a custom copy ratio (0.1x to 2.0x)
3. **Auto-Copy Opens**: When the leader opens a trade, your account automatically opens proportional trades
4. **Auto-Copy Closes**: When the leader closes a trade, your positions close at the same profit/loss percentage
5. **Monitor**: Track your copy trading performance and history
6. **Control**: Pause, resume, or stop copying at any time

### For Leaders (Admin/Super-Admin Only)

1. **Trade Normally**: Execute trades as usual through the platform
2. **Auto-Replication**: Your trades (opens and closes) are automatically copied to all active followers
3. **Synchronized Results**: Followers win and lose together with you on every trade
4. **View Followers**: See who is copying your trades
5. **Performance Tracking**: Monitor your influence and total copied volume

## Key Features

### 1. Synchronized Trading (Open & Close)

**NEW: Full Trade Synchronization**
- When a leader opens a trade, all followers' trades open at proportional sizes
- **When a leader closes a trade, all followers' trades close at the same profit/loss percentage**
- Example: If leader closes at +5% profit, all followers also close at +5% profit
- Example: If leader closes at -3% loss, all followers also close at -3% loss
- This ensures followers win and lose together with their leader on all trades

### 2. Proportional Position Sizing

Trades are scaled based on the **percentage of available capital** used, not absolute amounts.

**Formula:**
```
followerPositionSize = (leaderPositionSize / leaderEquity) × followerEquity × copyRatio
```

**Example:**
- Leader has $10,000 balance
- Leader buys $1,000 of BTC (10% of capital)
- Follower has $5,000 balance with 1.0x copy ratio
- Follower buys $500 of BTC (10% of their capital)

### 3. Copy Ratio (Multiplier)

Followers can adjust their exposure:
- **0.1x**: Conservative (copy at 10% size)
- **0.5x**: Half size
- **1.0x**: Default (same proportion as leader)
- **1.5x**: 1.5x leverage
- **2.0x**: Maximum (double the proportion)

### 3. Risk Management

**Automatic Protection:**
- Minimum balance requirement: $100
- Maximum position size: 20% of balance per trade
- Daily loss limit: 10% - automatically pauses copying
- Minimum quantity validation to prevent dust trades

**Safety Features:**
- Copy trades run in background (don't delay leader's execution)
- Failed copy trades are logged but don't affect leader
- Followers can pause/resume anytime
- Individual stop loss/take profit protection

### 4. Connection States

- **ACTIVE**: Actively copying all leader trades
- **PAUSED**: Temporarily stopped, can resume anytime
- **STOPPED**: Permanently disconnected, must reconnect to resume

## API Endpoints

### Get Available Leaders
```http
GET /api/copy-trading/leaders
```

Returns list of admins/super-admins available to follow with their stats.

**Response:**
```json
{
  "leaders": [
    {
      "id": "uuid",
      "email": "admin@example.com",
      "role": "ADMIN",
      "follower_count": 15,
      "total_volume": 125000.50,
      "rating": 4.5
    }
  ]
}
```

### Start Following a Leader
```http
POST /api/copy-trading/follow
```

**Request:**
```json
{
  "leaderId": "leader-uuid",
  "copyRatio": 1.0
}
```

**Response:**
```json
{
  "message": "Successfully started copying leader",
  "connectionId": "connection-uuid"
}
```

### Stop Following
```http
POST /api/copy-trading/unfollow
```

**Request:**
```json
{
  "leaderId": "leader-uuid"
}
```

### Pause/Resume Copying
```http
PATCH /api/copy-trading/status
```

**Request:**
```json
{
  "leaderId": "leader-uuid",
  "status": "PAUSED"
}
```

Status options: `ACTIVE` or `PAUSED`

### Get My Following List
```http
GET /api/copy-trading/following
```

Returns all leaders you're following with connection details.

### Get My Followers (Leaders Only)
```http
GET /api/copy-trading/followers
```

Available only to ADMIN/SUPER_ADMIN users.

### Get Copy Trading Statistics
```http
GET /api/copy-trading/stats
```

Returns comprehensive stats as both follower and leader (if applicable).

**Response:**
```json
{
  "stats": {
    "asFollower": {
      "leaders_following": 2,
      "total_trades": 45,
      "total_volume": 5000.00,
      "total_profit": 250.75
    },
    "asLeader": {
      "total_followers": 10,
      "total_copied_volume": 50000.00,
      "performance_rating": 4.2
    }
  }
}
```

### Get Copy Trade History
```http
GET /api/copy-trading/history?limit=50
```

Returns history of all copy trades executed on your account.

## Database Schema

### copy_trading_leaders
Tracks statistics for leaders (ADMIN/SUPER_ADMIN).

```sql
- id: UUID
- user_id: UUID (unique)
- total_followers: INTEGER
- total_copied_volume: FLOAT
- performance_rating: FLOAT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### copy_trading_followers
Tracks copy trading relationships.

```sql
- id: UUID
- follower_id: UUID
- leader_id: UUID
- copy_ratio: FLOAT (default 1.0)
- status: VARCHAR(20) [ACTIVE, PAUSED, STOPPED]
- start_balance: FLOAT
- total_trades_copied: INTEGER
- total_copied_volume: FLOAT
- total_profit_from_copying: FLOAT
- daily_loss: FLOAT
- last_reset_date: TIMESTAMP
- last_copy_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- UNIQUE(follower_id, leader_id)
```

### copy_trade_history
Logs all copy trade attempts (successful and failed).

```sql
- id: UUID
- follower_id: UUID
- leader_id: UUID
- original_trade_data: JSONB
- copied_quantity: FLOAT
- copied_value: FLOAT
- status: VARCHAR(20) [EXECUTED, FAILED]
- error_message: TEXT
- created_at: TIMESTAMP
```

## Implementation Details

### Trade Execution Flow

**Opening Trades:**
1. **Leader executes trade** → TradeService.executeTrade()
2. **Trade completes successfully**
3. **Check if leader is ADMIN/SUPER_ADMIN**
4. **Trigger copy trades in background** (non-blocking)
5. **For each active follower:**
   - Check risk limits (balance, daily loss)
   - Calculate proportional position size
   - Apply copy ratio multiplier
   - Enforce max position size limits
   - Execute follower's trade
   - **Link follower position to leader position** (stores leader_position_id)
   - Log result (success/failure)
6. **Update statistics**

**Closing Trades (NEW):**
1. **Leader closes position** → TradeService.executeSell() or Admin force-close
2. **Position closes successfully**
3. **Calculate profit/loss percentage** (exit price vs entry price)
4. **Check if leader is ADMIN/SUPER_ADMIN**
5. **Trigger copy closes in background** (non-blocking)
6. **Find all follower positions linked to this leader position**
7. **For each follower position:**
   - Calculate target exit price based on same P/L percentage
   - Execute close at calculated price
   - Update follower profit stats
   - Log close result
8. **All followers close at same profit/loss % as leader**

### Position Linking

Each follower position stores `leader_position_id` to track which leader position it's copying:
- When leader opens a trade → followers' positions link to that leader position
- When leader closes that position → system finds all linked follower positions
- Follower positions close with the exact same profit/loss percentage

### Code Structure

```
/lib/services/
  ├── copyTradingService.js      # Main copy trading logic
  │   ├── executeCopyTrades()    # Opens follower trades
  │   └── executeCopyCloses()    # Closes follower trades (NEW)
  ├── tradeService.js             # Triggers copy opens & closes
  │   ├── triggerCopyTrades()    # For opening trades
  │   └── triggerCopyCloses()    # For closing trades (NEW)
  └── accountService.js           # Account balance management

/app/api/[[...path]]/route.js    # API endpoints + database tables


Database tables created in:
  ensureSchemaExtensions() function
```

## Example Use Cases

### Use Case 1: Basic Copy Trading

1. **Follower (User)** with $1,000 balance
2. **Leader (Admin)** with $10,000 balance
3. Leader buys $2,000 of ETH (20% of capital)
4. Follower automatically buys $200 of ETH (20% of their $1,000)

### Use Case 2: Conservative Copying

1. Follower sets copy ratio to 0.5x
2. Leader uses 10% of capital
3. Follower only uses 5% of capital (10% × 0.5)

### Use Case 3: Aggressive Copying

1. Follower sets copy ratio to 2.0x
2. Leader uses 5% of capital
3. Follower uses 10% of capital (5% × 2.0)
4. Limited by max position size of 20%

## Safety & Risk Management

### Automatic Protections

1. **Minimum Balance**: $100 required to start copying
2. **Daily Loss Limit**: Automatically pauses at 10% daily loss
3. **Max Position Size**: No single trade can exceed 20% of balance
4. **Dust Prevention**: Minimum quantity validation
5. **Balance Checks**: Verified before each copy trade

### Manual Controls

1. **Pause Anytime**: Stop copying without disconnecting
2. **Custom Ratios**: Adjust exposure level (0.1x to 2.0x)
3. **Stop Following**: Permanently disconnect from leader
4. **View History**: Track all copy trades and outcomes

### Error Handling

- **Leader trade failures**: Don't affect leader's own execution
- **Follower insufficient balance**: Skip trade, log error
- **Network issues**: Logged for manual review
- **Invalid prices**: Trade skipped with error message

## Best Practices

### For Followers

1. **Start Conservative**: Begin with 0.5x or 1.0x copy ratio
2. **Monitor Performance**: Regularly check copy trade results
3. **Sufficient Balance**: Maintain at least $200 to avoid frequent skips
4. **Diversify**: Consider following multiple leaders
5. **Set Limits**: Use the 10% daily loss protection

### For Leaders (Admins)

1. **Trade Responsibly**: Remember you're being copied
2. **Communicate**: Inform followers of strategy changes
3. **Monitor Followers**: Check follower count and performance
4. **Risk Management**: Use stop losses and position sizing
5. **Consistency**: Maintain steady trading approach

## Troubleshooting

### Why didn't my copy trade execute?

Common reasons:
1. Insufficient balance
2. Hit daily loss limit (10%)
3. Position would exceed 20% limit
4. Minimum quantity too small
5. Copy trading was paused

Check `/api/copy-trading/history` for specific error messages.

### How to reset daily loss tracking?

Daily loss resets automatically at midnight UTC. You can also unfollow and re-follow to reset (not recommended).

### Can I copy from multiple leaders?

Yes! You can follow multiple leaders simultaneously. Each connection has independent settings and tracking.

### What happens if I don't have enough balance?

The specific copy trade is skipped and logged as failed. You'll continue copying future trades when you have sufficient balance.

## Technical Notes

- Copy trades execute asynchronously (non-blocking)
- Trade execution typically takes 100-500ms per follower
- Max followers per leader: Unlimited (but performance scales)
- Price matching: Uses same market price as leader
- Account types: Copy trading works with both DEMO and REAL accounts
- Slippage: Follower may experience slightly different execution prices

## Future Enhancements

Potential features for future versions:

1. **Advanced Filters**: Copy only specific asset types or trade sizes
2. **Time Limits**: Set start/end times for copying
3. **Performance-Based**: Auto-pause if leader performance drops
4. **Social Features**: Leader rankings, reviews, and profiles
5. **Reverse Copy**: Automatically do opposite of leader
6. **Partial Copying**: Copy only X% of leader's trades
7. **Asset Filters**: Only copy specific symbols/markets

## Support

For issues or questions:
1. Check copy trade history for error messages
2. Verify minimum balance requirements ($100)
3. Review daily loss limits (10%)
4. Contact system administrator

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Author**: Investpop Development Team
