-- 005_revert_004_round_jsonb_percentages.sql
-- Restores mathematical precision for "equal splits" that were rounded by migration 004.
-- Since users only enter 2 decimal places manually, the only percentages that lost 
-- meaningful precision were auto-generated equal splits (like 33.33333333% for 3 people).
-- This migration detects those rounded equal splits (e.g., all 33.33) and restores 
-- them back to exact float precision (100.0 / count).

BEGIN;

-- Restore entries.payer_shares
UPDATE entries
SET payer_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(payer_shares))
    )
  )
  FROM jsonb_array_elements(payer_shares) AS elem
)
WHERE payer_shares IS NOT NULL 
  AND jsonb_typeof(payer_shares) = 'array'
  AND jsonb_array_length(payer_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(payer_shares))) < 0.02)
    FROM jsonb_array_elements(payer_shares) AS elem
  );

-- Restore entries.beneficiary_shares
UPDATE entries
SET beneficiary_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(beneficiary_shares))
    )
  )
  FROM jsonb_array_elements(beneficiary_shares) AS elem
)
WHERE beneficiary_shares IS NOT NULL 
  AND jsonb_typeof(beneficiary_shares) = 'array'
  AND jsonb_array_length(beneficiary_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(beneficiary_shares))) < 0.02)
    FROM jsonb_array_elements(beneficiary_shares) AS elem
  );

-- Restore entry_edits.old_payer_shares
UPDATE entry_edits
SET old_payer_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(old_payer_shares))
    )
  )
  FROM jsonb_array_elements(old_payer_shares) AS elem
)
WHERE old_payer_shares IS NOT NULL 
  AND jsonb_typeof(old_payer_shares) = 'array'
  AND jsonb_array_length(old_payer_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(old_payer_shares))) < 0.02)
    FROM jsonb_array_elements(old_payer_shares) AS elem
  );

-- Restore entry_edits.new_payer_shares
UPDATE entry_edits
SET new_payer_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(new_payer_shares))
    )
  )
  FROM jsonb_array_elements(new_payer_shares) AS elem
)
WHERE new_payer_shares IS NOT NULL 
  AND jsonb_typeof(new_payer_shares) = 'array'
  AND jsonb_array_length(new_payer_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(new_payer_shares))) < 0.02)
    FROM jsonb_array_elements(new_payer_shares) AS elem
  );

-- Restore entry_edits.old_beneficiary_shares
UPDATE entry_edits
SET old_beneficiary_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(old_beneficiary_shares))
    )
  )
  FROM jsonb_array_elements(old_beneficiary_shares) AS elem
)
WHERE old_beneficiary_shares IS NOT NULL 
  AND jsonb_typeof(old_beneficiary_shares) = 'array'
  AND jsonb_array_length(old_beneficiary_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(old_beneficiary_shares))) < 0.02)
    FROM jsonb_array_elements(old_beneficiary_shares) AS elem
  );

-- Restore entry_edits.new_beneficiary_shares
UPDATE entry_edits
SET new_beneficiary_shares = (
  SELECT jsonb_agg(
    jsonb_set(
      elem, 
      '{percentage}', 
      to_jsonb(100.0 / jsonb_array_length(new_beneficiary_shares))
    )
  )
  FROM jsonb_array_elements(new_beneficiary_shares) AS elem
)
WHERE new_beneficiary_shares IS NOT NULL 
  AND jsonb_typeof(new_beneficiary_shares) = 'array'
  AND jsonb_array_length(new_beneficiary_shares) > 0
  AND (
    SELECT bool_and(abs((elem->>'percentage')::numeric - (100.0 / jsonb_array_length(new_beneficiary_shares))) < 0.02)
    FROM jsonb_array_elements(new_beneficiary_shares) AS elem
  );

COMMIT;
