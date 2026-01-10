-- Create likes for any game/scorecard (round, match play, etc.)
CREATE TABLE IF NOT EXISTS public.game_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  game_id uuid NOT NULL
);

-- Prevent duplicate likes per user/game
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_likes_user_game_unique'
  ) THEN
    ALTER TABLE public.game_likes
      ADD CONSTRAINT game_likes_user_game_unique UNIQUE (user_id, game_type, game_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_likes_game ON public.game_likes (game_type, game_id);
CREATE INDEX IF NOT EXISTS idx_game_likes_user ON public.game_likes (user_id);

ALTER TABLE public.game_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read counts (safe: contains no private fields)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_likes' AND policyname='Game likes are viewable by everyone'
  ) THEN
    CREATE POLICY "Game likes are viewable by everyone"
    ON public.game_likes
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Only the authenticated user can like as themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_likes' AND policyname='Users can like games as themselves'
  ) THEN
    CREATE POLICY "Users can like games as themselves"
    ON public.game_likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Only the authenticated user can remove their own like
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='game_likes' AND policyname='Users can unlike their own game likes'
  ) THEN
    CREATE POLICY "Users can unlike their own game likes"
    ON public.game_likes
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;
