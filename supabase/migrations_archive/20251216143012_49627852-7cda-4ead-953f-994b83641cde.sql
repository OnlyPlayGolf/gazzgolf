-- Create scramble_games table
CREATE TABLE public.scramble_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  course_name TEXT NOT NULL,
  tee_set TEXT,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  holes_played INTEGER NOT NULL DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  min_drives_per_player INTEGER DEFAULT NULL,
  use_handicaps BOOLEAN NOT NULL DEFAULT false,
  scoring_type TEXT NOT NULL DEFAULT 'gross',
  
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winning_team TEXT
);

-- Create scramble_holes table
CREATE TABLE public.scramble_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.scramble_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  team_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  UNIQUE(game_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.scramble_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scramble_holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for scramble_games
CREATE POLICY "Users can view their own scramble games"
ON public.scramble_games FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scramble games"
ON public.scramble_games FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scramble games"
ON public.scramble_games FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scramble games"
ON public.scramble_games FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Friends can view scramble games"
ON public.scramble_games FOR SELECT
USING (EXISTS (
  SELECT 1 FROM friends_pairs fp
  WHERE (fp.a = auth.uid() AND fp.b = scramble_games.user_id)
     OR (fp.b = auth.uid() AND fp.a = scramble_games.user_id)
));

-- RLS policies for scramble_holes
CREATE POLICY "Users can view holes of their scramble games"
ON public.scramble_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM scramble_games g
  WHERE g.id = scramble_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can insert holes to their scramble games"
ON public.scramble_holes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM scramble_games g
  WHERE g.id = scramble_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can update holes of their scramble games"
ON public.scramble_holes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM scramble_games g
  WHERE g.id = scramble_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can delete holes of their scramble games"
ON public.scramble_holes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM scramble_games g
  WHERE g.id = scramble_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Friends can view scramble holes"
ON public.scramble_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM scramble_games g
  WHERE g.id = scramble_holes.game_id
  AND EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
       OR (fp.b = auth.uid() AND fp.a = g.user_id)
  )
));