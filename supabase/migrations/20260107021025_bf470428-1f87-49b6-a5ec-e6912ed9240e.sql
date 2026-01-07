
-- Add columns to round_players to support guest players stored in database
ALTER TABLE public.round_players 
ADD COLUMN IF NOT EXISTS guest_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- Make user_id nullable for guest players (guests don't have accounts)
ALTER TABLE public.round_players ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure either user_id or guest_name is provided
ALTER TABLE public.round_players 
ADD CONSTRAINT round_players_user_or_guest_check 
CHECK (user_id IS NOT NULL OR (is_guest = TRUE AND guest_name IS NOT NULL));
