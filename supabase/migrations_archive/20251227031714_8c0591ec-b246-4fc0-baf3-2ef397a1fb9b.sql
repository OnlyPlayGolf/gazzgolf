-- Create game_groups table to track groups within a game/round
CREATE TABLE public.game_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  group_name text NOT NULL DEFAULT 'Group A',
  group_index integer NOT NULL DEFAULT 0,
  tee_time text,
  starting_hole integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(round_id, group_index)
);

-- Add group_id to round_players
ALTER TABLE public.round_players 
ADD COLUMN group_id uuid REFERENCES public.game_groups(id) ON DELETE SET NULL;

-- Enable RLS on game_groups
ALTER TABLE public.game_groups ENABLE ROW LEVEL SECURITY;

-- Users can view game_groups for rounds they own or are participants in
CREATE POLICY "Users can view game_groups for their rounds"
ON public.game_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r 
    WHERE r.id = game_groups.round_id AND r.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.round_players rp 
    WHERE rp.round_id = game_groups.round_id AND rp.user_id = auth.uid()
  )
);

-- Friends can view game_groups
CREATE POLICY "Friends can view game_groups"
ON public.game_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r
    JOIN public.friends_pairs fp ON (
      (fp.a = auth.uid() AND fp.b = r.user_id) OR 
      (fp.b = auth.uid() AND fp.a = r.user_id)
    )
    WHERE r.id = game_groups.round_id
  )
);

-- Round owner can insert game_groups
CREATE POLICY "Round owner can insert game_groups"
ON public.game_groups
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rounds r 
    WHERE r.id = game_groups.round_id AND r.user_id = auth.uid()
  )
);

-- Round owner can update game_groups
CREATE POLICY "Round owner can update game_groups"
ON public.game_groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r 
    WHERE r.id = game_groups.round_id AND r.user_id = auth.uid()
  )
);

-- Round owner can delete game_groups
CREATE POLICY "Round owner can delete game_groups"
ON public.game_groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rounds r 
    WHERE r.id = game_groups.round_id AND r.user_id = auth.uid()
  )
);