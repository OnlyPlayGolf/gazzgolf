-- Cleanup: Delete orphaned pro_stats_rounds where the parent round no longer exists
-- This removes any existing orphaned records before the trigger is in place

-- Delete pro_stats_holes for orphaned pro_stats_rounds
DELETE FROM public.pro_stats_holes
WHERE pro_round_id IN (
  SELECT psr.id
  FROM public.pro_stats_rounds psr
  WHERE psr.external_round_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = psr.external_round_id
    )
);

-- Delete orphaned pro_stats_rounds
DELETE FROM public.pro_stats_rounds
WHERE external_round_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = pro_stats_rounds.external_round_id
  );
