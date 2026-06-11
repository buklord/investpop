-- Migration: Add email verification, withdrawal, and dual-balance support
-- Run this against your production database to enable all new features

-- ── Users table additions ──────────────────────────────────────────

-- Add email_verified if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add is_suspended if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_suspended'
    ) THEN
        ALTER TABLE users ADD COLUMN is_suspended BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ── Virtual accounts table additions ──────────────────────────────

-- Add demo_balance if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'virtual_accounts' AND column_name = 'demo_balance'
    ) THEN
        ALTER TABLE virtual_accounts ADD COLUMN demo_balance FLOAT DEFAULT 100000;
    END IF;
END $$;

-- Add real_balance if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'virtual_accounts' AND column_name = 'real_balance'
    ) THEN
        ALTER TABLE virtual_accounts ADD COLUMN real_balance FLOAT DEFAULT 0;
    END IF;
END $$;

-- Add trading_mode if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'virtual_accounts' AND column_name = 'trading_mode'
    ) THEN
        ALTER TABLE virtual_accounts ADD COLUMN trading_mode TEXT DEFAULT 'REAL';
    END IF;
END $$;

-- Add margin_reserved if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'virtual_accounts' AND column_name = 'margin_reserved'
    ) THEN
        ALTER TABLE virtual_accounts ADD COLUMN margin_reserved FLOAT DEFAULT 0;
    END IF;
END $$;

-- ── New tables ───────────────────────────────────────────────────

-- Email verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount FLOAT NOT NULL,
    method TEXT NOT NULL,
    address TEXT,
    status TEXT DEFAULT 'PENDING',
    notes TEXT,
    processed_by TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- Trading positions
CREATE TABLE IF NOT EXISTS trading_positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity FLOAT NOT NULL,
    entry_price FLOAT NOT NULL,
    total_invested FLOAT,
    total_fees FLOAT,
    take_profit FLOAT,
    stop_loss FLOAT,
    leverage FLOAT DEFAULT 1,
    status TEXT DEFAULT 'OPEN',
    realized_pnl FLOAT,
    exit_price FLOAT,
    account_type TEXT,
    leader_position_id TEXT,
    opened_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    margin_used FLOAT
);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    position_id TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity FLOAT NOT NULL,
    price FLOAT NOT NULL,
    total_value FLOAT NOT NULL,
    fees FLOAT DEFAULT 0,
    opened_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Pending orders (limit orders)
CREATE TABLE IF NOT EXISTS pending_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity FLOAT NOT NULL,
    limit_price FLOAT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    executed_at TIMESTAMP,
    executed_price FLOAT
);

-- Copy trading followers
CREATE TABLE IF NOT EXISTS copy_trading_followers (
    id TEXT PRIMARY KEY,
    leader_id TEXT NOT NULL,
    follower_id TEXT NOT NULL,
    copy_ratio FLOAT DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(leader_id, follower_id)
);

-- Wallet balances
CREATE TABLE IF NOT EXISTS wallet_balances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    balance FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, asset)
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount FLOAT NOT NULL,
    asset_to TEXT,
    amount_to FLOAT,
    counterparty TEXT,
    price_usd FLOAT,
    balance_after FLOAT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
