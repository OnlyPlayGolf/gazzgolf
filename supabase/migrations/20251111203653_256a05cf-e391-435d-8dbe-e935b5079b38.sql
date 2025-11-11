-- Clean up duplicate pro_stats_rounds, keeping the one with the most holes for each user/external_round combination

-- Create a temp table with the IDs to keep (the one with most holes for each duplicate set)
CREATE TEMP TABLE rounds_to_keep AS
WITH ranked_rounds AS (
  SELECT 
    psr.id,
    psr.user_id,
    psr.external_round_id,
    (SELECT COUNT(*) FROM pro_stats_holes WHERE pro_round_id = psr.id) as hole_count,
    ROW_NUMBER() OVER (
      PARTITION BY psr.user_id, psr.external_round_id 
      ORDER BY (SELECT COUNT(*) FROM pro_stats_holes WHERE pro_round_id = psr.id) DESC, psr.created_at ASC
    ) as rn
  FROM pro_stats_rounds psr
  WHERE psr.external_round_id IS NOT NULL
)
SELECT id FROM ranked_rounds WHERE rn = 1;

-- Delete holes from rounds we're going to remove
DELETE FROM pro_stats_holes
WHERE pro_round_id IN (
  SELECT psr.id 
  FROM pro_stats_rounds psr
  WHERE psr.external_round_id IS NOT NULL
    AND psr.id NOT IN (SELECT id FROM rounds_to_keep)
);

-- Delete the duplicate pro_stats_rounds
DELETE FROM pro_stats_rounds
WHERE external_round_id IS NOT NULL
  AND id NOT IN (SELECT id FROM rounds_to_keep);

-- Now add the unique constraint
ALTER TABLE pro_stats_rounds 
ADD CONSTRAINT unique_user_external_round 
UNIQUE (user_id, external_round_id);