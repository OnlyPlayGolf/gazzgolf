-- Step 1: Add event_id column to all game tables FIRST
ALTER TABLE public.copenhagen_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.best_ball_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.match_play_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.scramble_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.skins_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.umbriago_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.wolf_games ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS event_id uuid;

-- Step 2: Create events table (if not exists from previous partial migration)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  creator_id uuid NOT NULL,
  date_played date DEFAULT CURRENT_DATE,
  course_id uuid REFERENCES public.courses(id),
  course_name text,
  game_type text NOT NULL
);

-- Step 3: Add foreign key constraints to game tables
ALTER TABLE public.copenhagen_games 
  DROP CONSTRAINT IF EXISTS copenhagen_games_event_id_fkey,
  ADD CONSTRAINT copenhagen_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.best_ball_games 
  DROP CONSTRAINT IF EXISTS best_ball_games_event_id_fkey,
  ADD CONSTRAINT best_ball_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.match_play_games 
  DROP CONSTRAINT IF EXISTS match_play_games_event_id_fkey,
  ADD CONSTRAINT match_play_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.scramble_games 
  DROP CONSTRAINT IF EXISTS scramble_games_event_id_fkey,
  ADD CONSTRAINT scramble_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.skins_games 
  DROP CONSTRAINT IF EXISTS skins_games_event_id_fkey,
  ADD CONSTRAINT skins_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.umbriago_games 
  DROP CONSTRAINT IF EXISTS umbriago_games_event_id_fkey,
  ADD CONSTRAINT umbriago_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.wolf_games 
  DROP CONSTRAINT IF EXISTS wolf_games_event_id_fkey,
  ADD CONSTRAINT wolf_games_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.rounds 
  DROP CONSTRAINT IF EXISTS rounds_event_id_fkey,
  ADD CONSTRAINT rounds_event_id_fkey 
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

-- Step 4: Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for events table
DROP POLICY IF EXISTS "Event creators can manage their events" ON public.events;
CREATE POLICY "Event creators can manage their events"
ON public.events
FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Event participants can view events" ON public.events;
CREATE POLICY "Event participants can view events"
ON public.events
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.copenhagen_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.best_ball_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.match_play_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.scramble_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.skins_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.umbriago_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.wolf_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.rounds WHERE event_id = events.id AND user_id = auth.uid())
);

-- Step 6: Create security definer function to check event creator
CREATE OR REPLACE FUNCTION public.is_event_creator(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _event_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.events
      WHERE id = _event_id AND creator_id = auth.uid()
    )
  END
$$;

-- Step 7: Update RLS policies for hole tables to allow event creator to update

-- Copenhagen holes
DROP POLICY IF EXISTS "Users can update holes of their copenhagen games" ON public.copenhagen_holes;
CREATE POLICY "Users can update holes of their copenhagen games"
ON public.copenhagen_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM copenhagen_games g
    WHERE g.id = copenhagen_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Best ball holes
DROP POLICY IF EXISTS "Users can update holes of their best ball games" ON public.best_ball_holes;
CREATE POLICY "Users can update holes of their best ball games"
ON public.best_ball_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM best_ball_games g
    WHERE g.id = best_ball_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Match play holes
DROP POLICY IF EXISTS "Users can update holes of their match play games" ON public.match_play_holes;
CREATE POLICY "Users can update holes of their match play games"
ON public.match_play_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM match_play_games g
    WHERE g.id = match_play_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Scramble holes
DROP POLICY IF EXISTS "Users can update holes of their scramble games" ON public.scramble_holes;
CREATE POLICY "Users can update holes of their scramble games"
ON public.scramble_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM scramble_games g
    WHERE g.id = scramble_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Skins holes
DROP POLICY IF EXISTS "Users can update holes of their skins games" ON public.skins_holes;
CREATE POLICY "Users can update holes of their skins games"
ON public.skins_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM skins_games g
    WHERE g.id = skins_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Umbriago holes
DROP POLICY IF EXISTS "Users can update holes of their umbriago games" ON public.umbriago_holes;
CREATE POLICY "Users can update holes of their umbriago games"
ON public.umbriago_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM umbriago_games g
    WHERE g.id = umbriago_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);

-- Wolf holes
DROP POLICY IF EXISTS "Users can update holes of their wolf games" ON public.wolf_holes;
CREATE POLICY "Users can update holes of their wolf games"
ON public.wolf_holes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM wolf_games g
    WHERE g.id = wolf_holes.game_id 
    AND (g.user_id = auth.uid() OR public.is_event_creator(g.event_id))
  )
);