-- Create Copenhagen games table
CREATE TABLE public.copenhagen_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_name TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  tee_set TEXT,
  holes_played INTEGER NOT NULL DEFAULT 18,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Players (3 players for Copenhagen)
  player_1 TEXT NOT NULL,
  player_2 TEXT NOT NULL,
  player_3 TEXT NOT NULL,
  
  -- Player handicaps (nullable for scratch play)
  player_1_handicap NUMERIC,
  player_2_handicap NUMERIC,
  player_3_handicap NUMERIC,
  
  -- Player tees
  player_1_tee TEXT,
  player_2_tee TEXT,
  player_3_tee TEXT,
  
  -- Handicap mode
  use_handicaps BOOLEAN NOT NULL DEFAULT false,
  
  -- Stakes
  stake_per_point NUMERIC NOT NULL DEFAULT 1,
  
  -- Running totals
  player_1_total_points INTEGER NOT NULL DEFAULT 0,
  player_2_total_points INTEGER NOT NULL DEFAULT 0,
  player_3_total_points INTEGER NOT NULL DEFAULT 0,
  
  -- Press tracking (JSON array of press objects)
  presses JSONB DEFAULT '[]'::jsonb,
  
  -- Game status
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winner_player TEXT
);

-- Create Copenhagen holes table
CREATE TABLE public.copenhagen_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.copenhagen_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Gross scores
  player_1_gross_score INTEGER,
  player_2_gross_score INTEGER,
  player_3_gross_score INTEGER,
  
  -- Net scores (calculated based on handicap)
  player_1_net_score INTEGER,
  player_2_net_score INTEGER,
  player_3_net_score INTEGER,
  
  -- Points awarded this hole
  player_1_hole_points INTEGER NOT NULL DEFAULT 0,
  player_2_hole_points INTEGER NOT NULL DEFAULT 0,
  player_3_hole_points INTEGER NOT NULL DEFAULT 0,
  
  -- Running totals
  player_1_running_total INTEGER NOT NULL DEFAULT 0,
  player_2_running_total INTEGER NOT NULL DEFAULT 0,
  player_3_running_total INTEGER NOT NULL DEFAULT 0,
  
  -- Sweep indicator
  is_sweep BOOLEAN NOT NULL DEFAULT false,
  sweep_winner INTEGER, -- 1, 2, or 3
  
  -- Press points for this hole (JSON object tracking points per press)
  press_points JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(game_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.copenhagen_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copenhagen_holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for copenhagen_games
CREATE POLICY "Users can view their own copenhagen games"
ON public.copenhagen_games FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own copenhagen games"
ON public.copenhagen_games FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own copenhagen games"
ON public.copenhagen_games FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own copenhagen games"
ON public.copenhagen_games FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for copenhagen_holes
CREATE POLICY "Users can view holes of their copenhagen games"
ON public.copenhagen_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM copenhagen_games g
  WHERE g.id = copenhagen_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can insert holes to their copenhagen games"
ON public.copenhagen_holes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM copenhagen_games g
  WHERE g.id = copenhagen_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can update holes of their copenhagen games"
ON public.copenhagen_holes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM copenhagen_games g
  WHERE g.id = copenhagen_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can delete holes of their copenhagen games"
ON public.copenhagen_holes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM copenhagen_games g
  WHERE g.id = copenhagen_holes.game_id AND g.user_id = auth.uid()
));