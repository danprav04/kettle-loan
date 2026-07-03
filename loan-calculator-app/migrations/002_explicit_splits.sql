-- 002_explicit_splits.sql
-- Backfill existing entries where split_with_user_ids is NULL or empty
-- to explicitly include all non-observer room members at the time of migration.

UPDATE entries
SET split_with_user_ids = COALESCE(
    (
        SELECT jsonb_agg(rm.user_id)
        FROM room_members rm
        WHERE rm.room_id = entries.room_id AND rm.role != 'observer'
    ),
    jsonb_build_array(entries.user_id)
)
WHERE amount > 0 
  AND (split_with_user_ids IS NULL OR split_with_user_ids = '[]'::jsonb)
  AND (payer_shares IS NULL OR payer_shares = '[]'::jsonb);

UPDATE entries
SET split_with_user_ids = COALESCE(
    (
        SELECT jsonb_agg(rm.user_id)
        FROM room_members rm
        WHERE rm.room_id = entries.room_id AND rm.role != 'observer' AND rm.user_id != entries.user_id
    ),
    jsonb_build_array(entries.user_id)
)
WHERE amount < 0 
  AND (split_with_user_ids IS NULL OR split_with_user_ids = '[]'::jsonb)
  AND (payer_shares IS NULL OR payer_shares = '[]'::jsonb);
