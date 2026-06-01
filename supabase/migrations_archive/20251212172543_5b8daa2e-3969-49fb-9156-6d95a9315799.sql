-- Create table for round comments (spectator comments on game feed)
CREATE TABLE public.round_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'round', -- 'round', 'match_play', 'umbriago', 'wolf', 'copenhagen'
  game_id UUID, -- For non-round game types
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.round_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on rounds they own or are friends with the owner
CREATE POLICY "Users can view comments on accessible rounds"
  ON public.round_comments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_comments.round_id
      AND (
        r.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
            OR (fp.b = auth.uid() AND fp.a = r.user_id)
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.match_play_games g
      WHERE g.id = round_comments.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
            OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.umbriago_games g
      WHERE g.id = round_comments.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
            OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.wolf_games g
      WHERE g.id = round_comments.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
            OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.copenhagen_games g
      WHERE g.id = round_comments.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
            OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
    )
  );

-- Users can insert their own comments
CREATE POLICY "Users can insert their own comments"
  ON public.round_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.round_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policy for friends to view rounds
CREATE POLICY "Friends can view rounds"
  ON public.rounds FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friends_pairs fp
      WHERE (fp.a = auth.uid() AND fp.b = user_id)
        OR (fp.b = auth.uid() AND fp.a = user_id)
    )
  );

-- Add RLS policy for friends to view match_play_games
CREATE POLICY "Friends can view match play games"
  ON public.match_play_games FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friends_pairs fp
      WHERE (fp.a = auth.uid() AND fp.b = user_id)
        OR (fp.b = auth.uid() AND fp.a = user_id)
    )
  );

-- Add RLS policy for friends to view match_play_holes
CREATE POLICY "Friends can view match play holes"
  ON public.match_play_holes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.match_play_games g
      WHERE g.id = match_play_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
            OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
    )
  );

-- Enable realtime for live updates
ALTER publication supabase_realtime ADD TABLE public.round_comments;
ALTER publication supabase_realtime ADD TABLE public.holes;
ALTER publication supabase_realtime ADD TABLE public.match_play_holes;