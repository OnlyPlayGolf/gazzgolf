-- Create umbriago_games table
CREATE TABLE public.umbriago_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_name TEXT NOT NULL,
  tee_set TEXT,
  holes_played INTEGER NOT NULL DEFAULT 18,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Teams
  team_a_player_1 TEXT NOT NULL,
  team_a_player_2 TEXT NOT NULL,
  team_b_player_1 TEXT NOT NULL,
  team_b_player_2 TEXT NOT NULL,
  
  -- Game settings
  stake_per_point NUMERIC NOT NULL DEFAULT 10,
  payout_mode TEXT NOT NULL DEFAULT 'difference', -- 'difference' or 'total'
  
  -- Running totals
  team_a_total_points INTEGER NOT NULL DEFAULT 0,
  team_b_total_points INTEGER NOT NULL DEFAULT 0,
  
  -- Roll history (array of {hole, old_difference, new_stake})
  roll_history JSONB DEFAULT '[]'::jsonb,
  
  -- Final state
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winning_team TEXT, -- 'A' or 'B' or 'TIE'
  final_payout NUMERIC
);

-- Create umbriago_holes table
CREATE TABLE public.umbriago_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.umbriago_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Player scores
  team_a_player_1_score INTEGER,
  team_a_player_2_score INTEGER,
  team_b_player_1_score INTEGER,
  team_b_player_2_score INTEGER,
  
  par INTEGER NOT NULL DEFAULT 4,
  
  -- Category winners (NULL = tie, 'A' or 'B')
  team_low_winner TEXT,
  individual_low_winner TEXT,
  closest_to_pin_winner TEXT,
  birdie_eagle_winner TEXT,
  
  -- Multiplier
  multiplier INTEGER NOT NULL DEFAULT 1, -- 1, 2, or 4
  double_called_by TEXT, -- 'A' or 'B'
  double_back_called BOOLEAN DEFAULT false,
  
  -- Results
  is_umbriago BOOLEAN NOT NULL DEFAULT false,
  team_a_hole_points INTEGER NOT NULL DEFAULT 0,
  team_b_hole_points INTEGER NOT NULL DEFAULT 0,
  
  -- Running totals after this hole
  team_a_running_total INTEGER NOT NULL DEFAULT 0,
  team_b_running_total INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(game_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.umbriago_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umbriago_holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for umbriago_games
CREATE POLICY "Users can view their own umbriago games"
ON public.umbriago_games FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own umbriago games"
ON public.umbriago_games FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own umbriago games"
ON public.umbriago_games FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own umbriago games"
ON public.umbriago_games FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for umbriago_holes
CREATE POLICY "Users can view holes of their umbriago games"
ON public.umbriago_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.umbriago_games g
  WHERE g.id = umbriago_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can insert holes to their umbriago games"
ON public.umbriago_holes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.umbriago_games g
  WHERE g.id = umbriago_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can update holes of their umbriago games"
ON public.umbriago_holes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.umbriago_games g
  WHERE g.id = umbriago_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can delete holes of their umbriago games"
ON public.umbriago_holes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.umbriago_games g
  WHERE g.id = umbriago_holes.game_id AND g.user_id = auth.uid()
));