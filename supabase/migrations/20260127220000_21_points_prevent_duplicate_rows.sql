-- Add unique constraint to prevent duplicate 21 Points rows for the same user+drill+game
-- This ensures each player has exactly one row per game, even if trigger and RPC both run
CREATE UNIQUE INDEX IF NOT EXISTS idx_drill_results_user_drill_game
ON public.drill_results(user_id, drill_id, ((attempts_json::jsonb ->> 'gameId')))
WHERE (attempts_json::jsonb ->> 'gameId') IS NOT NULL AND (attempts_json::jsonb ->> 'gameId') != '';

-- Note: ON CONFLICT with partial indexes requires matching the index condition
-- We'll use the index name in ON CONFLICT or check EXISTS before insert
