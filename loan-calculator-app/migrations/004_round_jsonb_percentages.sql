-- 004_round_jsonb_percentages.sql

-- Round percentage values in entries.payer_shares
UPDATE entries
SET payer_shares = CASE 
  WHEN jsonb_typeof(payer_shares) != 'array' THEN payer_shares
  WHEN jsonb_array_length(payer_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(payer_shares) AS elem
  )
END
WHERE payer_shares IS NOT NULL AND jsonb_typeof(payer_shares) = 'array';

-- Round percentage values in entries.beneficiary_shares
UPDATE entries
SET beneficiary_shares = CASE 
  WHEN jsonb_typeof(beneficiary_shares) != 'array' THEN beneficiary_shares
  WHEN jsonb_array_length(beneficiary_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(beneficiary_shares) AS elem
  )
END
WHERE beneficiary_shares IS NOT NULL AND jsonb_typeof(beneficiary_shares) = 'array';

-- Round percentage values in entry_edits.old_payer_shares
UPDATE entry_edits
SET old_payer_shares = CASE 
  WHEN jsonb_typeof(old_payer_shares) != 'array' THEN old_payer_shares
  WHEN jsonb_array_length(old_payer_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(old_payer_shares) AS elem
  )
END
WHERE old_payer_shares IS NOT NULL AND jsonb_typeof(old_payer_shares) = 'array';

-- Round percentage values in entry_edits.new_payer_shares
UPDATE entry_edits
SET new_payer_shares = CASE 
  WHEN jsonb_typeof(new_payer_shares) != 'array' THEN new_payer_shares
  WHEN jsonb_array_length(new_payer_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(new_payer_shares) AS elem
  )
END
WHERE new_payer_shares IS NOT NULL AND jsonb_typeof(new_payer_shares) = 'array';

-- Round percentage values in entry_edits.old_beneficiary_shares
UPDATE entry_edits
SET old_beneficiary_shares = CASE 
  WHEN jsonb_typeof(old_beneficiary_shares) != 'array' THEN old_beneficiary_shares
  WHEN jsonb_array_length(old_beneficiary_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(old_beneficiary_shares) AS elem
  )
END
WHERE old_beneficiary_shares IS NOT NULL AND jsonb_typeof(old_beneficiary_shares) = 'array';

-- Round percentage values in entry_edits.new_beneficiary_shares
UPDATE entry_edits
SET new_beneficiary_shares = CASE 
  WHEN jsonb_typeof(new_beneficiary_shares) != 'array' THEN new_beneficiary_shares
  WHEN jsonb_array_length(new_beneficiary_shares) = 0 THEN '[]'::jsonb
  ELSE (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'percentage' THEN 
          jsonb_set(elem, '{percentage}', to_jsonb(ROUND((elem->>'percentage')::numeric, 2)))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(new_beneficiary_shares) AS elem
  )
END
WHERE new_beneficiary_shares IS NOT NULL AND jsonb_typeof(new_beneficiary_shares) = 'array';
