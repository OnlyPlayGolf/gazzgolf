-- Add group support to all game format player tables
-- This allows each format to have multiple groups, where each group has the required number of players

-- Match Play: Add group_id to allow multiple 2-player groups per event
ALTER TABLE public.match_play_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Copenhagen: Add group_id to allow multiple 3-player groups per event
ALTER TABLE public.copenhagen_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Skins: Add group_id to allow multiple groups per event
ALTER TABLE public.skins_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Best Ball: Add group_id to allow multiple team groups per event
ALTER TABLE public.best_ball_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Scramble: Add group_id to allow multiple team groups per event
ALTER TABLE public.scramble_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Umbriago: Add group_id to allow multiple 4-player groups per event
ALTER TABLE public.umbriago_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Wolf: Add group_id to allow multiple 4-6 player groups per event
ALTER TABLE public.wolf_games 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_match_play_games_group_id ON public.match_play_games(group_id);
CREATE INDEX IF NOT EXISTS idx_copenhagen_games_group_id ON public.copenhagen_games(group_id);
CREATE INDEX IF NOT EXISTS idx_skins_games_group_id ON public.skins_games(group_id);
CREATE INDEX IF NOT EXISTS idx_best_ball_games_group_id ON public.best_ball_games(group_id);
CREATE INDEX IF NOT EXISTS idx_scramble_games_group_id ON public.scramble_games(group_id);
CREATE INDEX IF NOT EXISTS idx_umbriago_games_group_id ON public.umbriago_games(group_id);
CREATE INDEX IF NOT EXISTS idx_wolf_games_group_id ON public.wolf_games(group_id);

-- Also add round_id to game_groups if we want to link groups back to a parent round
-- This allows game_groups to be reused for any game format (not just rounds table)
-- The game_groups.round_id can now point to rounds for stroke play or be null for other formats
-- We'll use the event_id on the games to link multiple games in an event

-- Update game_groups to have a more flexible structure for different game formats
-- The round_id is already nullable, so groups can exist without a rounds table reference

-- Add a game_type column to game_groups to indicate what format this group is for
ALTER TABLE public.game_groups 
ADD COLUMN IF NOT EXISTS game_type text;

-- Add event_id to game_groups to link groups to events (for multi-group tournaments)
ALTER TABLE public.game_groups 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_game_groups_event_id ON public.game_groups(event_id);
CREATE INDEX IF NOT EXISTS idx_game_groups_game_type ON public.game_groups(game_type);