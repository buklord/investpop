-- Migration: Add email verification, withdrawal, and dual-balance support
-- Uses public. schema prefix for Supabase compatibility

-- ── Users table additions ──────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE public.users ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_suspended'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_suspended BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ── Virtual accounts table additions ──────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'virtual_accounts' AND column_name = 'demo_balance'
    ) THEN
        ALTER TABLE public.virtual_accounts ADD COLUMN demo_balance FLOAT DEFAULT 100000;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'virtual_accounts' AND column_name = 'real_balance'
    ) THEN
        ALTER TABLE public.virtual_accounts ADD COLUMN real_balance FLOAT DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'virtual_accounts' AND column_name = 'trading_mode'
    ) THEN
        ALTER TABLE public.virtual_accounts ADD COLUMN trading_mode TEXT DEFAULT 'REAL';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'virtual_accounts' AND column_name = 'margin_reserved'
    ) THEN
        ALTER TABLE public.virtual_accounts ADD COLUMN margin_reserved FLOAT DEFAULT 0;
    END IF;
END $$;

-- ── New tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON public.email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON public.email_verifications(user_id);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);

CREATE TABLE IF NOT EXISTS public.trading_positions (
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

CREATE TABLE IF NOT EXISTS public.trades (
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

CREATE TABLE IF NOT EXISTS public.pending_orders (
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

CREATE TABLE IF NOT EXISTS public.copy_trading_followers (
    id TEXT PRIMARY KEY,
    leader_id TEXT NOT NULL,
    follower_id TEXT NOT NULL,
    copy_ratio FLOAT DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(leader_id, follower_id)
);

CREATE TABLE IF NOT EXISTS public.wallet_balances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    balance FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, asset)
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
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

CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
