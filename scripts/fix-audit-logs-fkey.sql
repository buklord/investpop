-- Fix audit_logs foreign key constraint to allow user deletion
-- This allows admin_id to be set to NULL when the referenced user is deleted

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;

-- Step 2: Make admin_id nullable (if not already)
ALTER TABLE audit_logs ALTER COLUMN admin_id DROP NOT NULL;

-- Step 3: Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE audit_logs 
  ADD CONSTRAINT audit_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;
