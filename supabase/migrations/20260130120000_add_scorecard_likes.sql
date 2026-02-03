-- Per-scorecard likes (one like per user per scorecard, e.g. per player card in round leaderboard).
-- scorecard_id is a stable string like "round:<round_id>:<round_player_id>" so each card has a unique id.
CREATE TABLE IF NOT EXISTS public.scorecard_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  scorecard_id text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS scorecard_likes_user_scorecard_unique
  ON public.scorecard_likes (user_id, scorecard_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_likes_scorecard ON public.scorecard_likes (scorecard_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_likes_user ON public.scorecard_likes (user_id);

ALTER TABLE public.scorecard_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for counts and "liked by me" state)
CREATE POLICY "scorecard_likes_select"
  ON public.scorecard_likes
  FOR SELECT
  USING (true);

-- Authenticated users can insert their own like
CREATE POLICY "scorecard_likes_insert"
  ON public.scorecard_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own like
CREATE POLICY "scorecard_likes_delete"
  ON public.scorecard_likes
  FOR DELETE
  USING (auth.uid() = user_id);
