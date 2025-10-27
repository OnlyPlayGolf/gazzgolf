-- Create round_players table to track multiple players in a round
CREATE TABLE public.round_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id)
);

-- Enable RLS
ALTER TABLE public.round_players ENABLE ROW LEVEL SECURITY;

-- Users can view players in rounds they're part of
CREATE POLICY "Users can view players in their rounds"
ON public.round_players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = round_players.round_id
    AND rp.user_id = auth.uid()
  )
);

-- Users can insert players when creating their own round
CREATE POLICY "Users can add players to their rounds"
ON public.round_players
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = round_players.round_id
    AND r.user_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_round_players_round_id ON public.round_players(round_id);
CREATE INDEX idx_round_players_user_id ON public.round_players(user_id);