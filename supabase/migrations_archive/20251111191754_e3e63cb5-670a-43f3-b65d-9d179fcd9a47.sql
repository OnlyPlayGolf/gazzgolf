-- Remove duplicate holes, keeping only the most recent entry per round/hole combination
DELETE FROM public.holes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY round_id, hole_number 
             ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.holes
  ) t
  WHERE t.rn > 1
);

-- Add unique constraint on round_id and hole_number
ALTER TABLE public.holes
ADD CONSTRAINT holes_round_hole_unique UNIQUE (round_id, hole_number);