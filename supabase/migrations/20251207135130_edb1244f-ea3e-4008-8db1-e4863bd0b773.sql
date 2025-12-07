-- Create wolf_games table
CREATE TABLE public.wolf_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_name TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  holes_played INTEGER NOT NULL DEFAULT 18,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Players (3-5 players)
  player_1 TEXT NOT NULL,
  player_2 TEXT NOT NULL,
  player_3 TEXT NOT NULL,
  player_4 TEXT,
  player_5 TEXT,
  
  -- Points settings
  lone_wolf_win_points INTEGER NOT NULL DEFAULT 3,
  lone_wolf_loss_points INTEGER NOT NULL DEFAULT 1,
  team_win_points INTEGER NOT NULL DEFAULT 1,
  
  -- Wolf position (first or last)
  wolf_position TEXT NOT NULL DEFAULT 'last',
  
  -- Player scores (running totals)
  player_1_points INTEGER NOT NULL DEFAULT 0,
  player_2_points INTEGER NOT NULL DEFAULT 0,
  player_3_points INTEGER NOT NULL DEFAULT 0,
  player_4_points INTEGER NOT NULL DEFAULT 0,
  player_5_points INTEGER NOT NULL DEFAULT 0,
  
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winner_player TEXT
);

-- Create wolf_holes table
CREATE TABLE public.wolf_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.wolf_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  par INTEGER NOT NULL DEFAULT 4,
  
  -- Who is the wolf this hole (1-5)
  wolf_player INTEGER NOT NULL,
  
  -- Wolf's choice
  wolf_choice TEXT, -- 'lone' or 'partner'
  partner_player INTEGER, -- 1-5
  
  -- Scores for each player
  player_1_score INTEGER,
  player_2_score INTEGER,
  player_3_score INTEGER,
  player_4_score INTEGER,
  player_5_score INTEGER,
  
  -- Points earned this hole
  player_1_hole_points INTEGER NOT NULL DEFAULT 0,
  player_2_hole_points INTEGER NOT NULL DEFAULT 0,
  player_3_hole_points INTEGER NOT NULL DEFAULT 0,
  player_4_hole_points INTEGER NOT NULL DEFAULT 0,
  player_5_hole_points INTEGER NOT NULL DEFAULT 0,
  
  -- Running totals
  player_1_running_total INTEGER NOT NULL DEFAULT 0,
  player_2_running_total INTEGER NOT NULL DEFAULT 0,
  player_3_running_total INTEGER NOT NULL DEFAULT 0,
  player_4_running_total INTEGER NOT NULL DEFAULT 0,
  player_5_running_total INTEGER NOT NULL DEFAULT 0,
  
  -- Winning side
  winning_side TEXT -- 'wolf', 'opponents', 'tie'
);

-- Enable RLS
ALTER TABLE public.wolf_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wolf_holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for wolf_games
CREATE POLICY "Users can view their own wolf games"
  ON public.wolf_games FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wolf games"
  ON public.wolf_games FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wolf games"
  ON public.wolf_games FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wolf games"
  ON public.wolf_games FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for wolf_holes
CREATE POLICY "Users can view holes of their wolf games"
  ON public.wolf_holes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM wolf_games g
    WHERE g.id = wolf_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert holes to their wolf games"
  ON public.wolf_holes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM wolf_games g
    WHERE g.id = wolf_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can update holes of their wolf games"
  ON public.wolf_holes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM wolf_games g
    WHERE g.id = wolf_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete holes of their wolf games"
  ON public.wolf_holes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM wolf_games g
    WHERE g.id = wolf_holes.game_id AND g.user_id = auth.uid()
  ));