-- migrations/001_multi_party_rbac.sql

-- 1. Add role to room_members
ALTER TABLE room_members ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'active';

-- 2. Add currency to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'ILS';

-- 3. Set creators to admin role
UPDATE room_members rm
SET role = 'admin'
FROM rooms r
WHERE rm.room_id = r.id AND rm.user_id = r.creator_id;

-- 4. Add new entry columns for multi-party splits and attribution
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS payer_shares JSONB,
  ADD COLUMN IF NOT EXISTS beneficiary_shares JSONB,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

-- 5. Set created_by = original user_id
UPDATE entries SET created_by_user_id = user_id WHERE created_by_user_id IS NULL;

-- 6. Migrate payer_shares: current user_id is always 100% payer
UPDATE entries
SET payer_shares = jsonb_build_array(
  jsonb_build_object('userId', user_id, 'percentage', 100)
)
WHERE payer_shares IS NULL;

-- 7. Migrate beneficiary_shares from split_with_user_ids (equal split)
UPDATE entries
SET beneficiary_shares = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', elem::int,
      'percentage', ROUND(100.0 / jsonb_array_length(split_with_user_ids), 2)
    )
  )
  FROM jsonb_array_elements_text(split_with_user_ids) AS elem
)
WHERE split_with_user_ids IS NOT NULL
  AND jsonb_array_length(split_with_user_ids) > 0
  AND beneficiary_shares IS NULL;

-- 8. Create entry audit trail table
CREATE TABLE IF NOT EXISTS entry_edits (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
  edited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_amount NUMERIC(10, 2),
  new_amount NUMERIC(10, 2),
  old_description VARCHAR(255),
  new_description VARCHAR(255),
  old_payer_shares JSONB,
  new_payer_shares JSONB,
  old_beneficiary_shares JSONB,
  new_beneficiary_shares JSONB,
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entry_edits_entry_id ON entry_edits(entry_id);
