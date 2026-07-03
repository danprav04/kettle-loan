-- migrations/003_permissions.sql
-- Replace role VARCHAR column with 4 boolean permission columns

-- 1. Add permission columns
ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS can_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_add_entries BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_participate BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view BOOLEAN NOT NULL DEFAULT true;

-- 2. Migrate existing roles to permissions
UPDATE room_members SET can_admin = true,  can_add_entries = true,  can_participate = true,  can_view = true  WHERE role = 'admin';
UPDATE room_members SET can_admin = false, can_add_entries = true,  can_participate = true,  can_view = true  WHERE role = 'active';
UPDATE room_members SET can_admin = false, can_add_entries = false, can_participate = true,  can_view = true  WHERE role = 'passive';
UPDATE room_members SET can_admin = false, can_add_entries = false, can_participate = false, can_view = true  WHERE role = 'observer';

-- 3. Drop the old role column
ALTER TABLE room_members DROP COLUMN IF EXISTS role;
