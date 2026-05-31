-- Add origin column to tag rounds created via play function vs manual tracker
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS origin text;

-- Backfill: mark rounds with players as 'play'
UPDATE public.rounds r
SET origin = 'play'
WHERE origin IS NULL
  AND EXISTS (
    SELECT 1 FROM public.round_players rp WHERE rp.round_id = r.id
  );

-- Backfill: mark remaining as 'tracker'
UPDATE public.rounds r
SET origin = 'tracker'
WHERE origin IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.round_players rp WHERE rp.round_id = r.id
  );

-- Helpful index for filtering
CREATE INDEX IF NOT EXISTS idx_rounds_user_origin ON public.rounds (user_id, origin);
