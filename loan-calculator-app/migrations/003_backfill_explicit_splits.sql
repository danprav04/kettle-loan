-- 003_backfill_explicit_splits.sql
-- Backfill historical entries where split_with_user_ids is NULL or empty
-- and beneficiary_shares is NULL or empty (catching entries that had default payer_shares populated).

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
  AND (beneficiary_shares IS NULL OR beneficiary_shares = '[]'::jsonb);

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
  AND (beneficiary_shares IS NULL OR beneficiary_shares = '[]'::jsonb);
