-- Security Hardening: Demote all non-master users to USER role
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
--
-- IMPORTANT: Replace 'demo@investdash.com' with YOUR actual admin email address
-- before running this command.
--
-- This command will:
--   1. Reset every account (except the master admin email) to role = 'USER'
--   2. Leave the master admin email untouched
--   3. Be safe to re-run multiple times (idempotent)

UPDATE users
SET role = 'USER'
WHERE email <> 'demo@investdash.com';   -- <-- REPLACE WITH YOUR EMAIL

-- Verify: show current roles after the update
SELECT id, email, role, created_at
FROM users
ORDER BY role DESC, created_at ASC;
