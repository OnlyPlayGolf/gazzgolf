-- Add tee_color to round_players table
ALTER TABLE public.round_players
ADD COLUMN tee_color text;

-- Add handicap and starting_hole for future use
ALTER TABLE public.round_players
ADD COLUMN handicap numeric(4,1),
ADD COLUMN starting_hole integer DEFAULT 1;