-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for per-player stats mode settings
CREATE TABLE public.player_game_stats_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  game_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  stats_mode TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_id, game_type)
);

-- Enable RLS
ALTER TABLE public.player_game_stats_mode ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats mode
CREATE POLICY "Users can view their own stats mode"
ON public.player_game_stats_mode
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own stats mode
CREATE POLICY "Users can insert their own stats mode"
ON public.player_game_stats_mode
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own stats mode
CREATE POLICY "Users can update their own stats mode"
ON public.player_game_stats_mode
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own stats mode
CREATE POLICY "Users can delete their own stats mode"
ON public.player_game_stats_mode
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_player_game_stats_mode_updated_at
BEFORE UPDATE ON public.player_game_stats_mode
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();