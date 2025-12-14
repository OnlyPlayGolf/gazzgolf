-- Create best_ball_games table
CREATE TABLE public.best_ball_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  course_name TEXT NOT NULL,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  holes_played INTEGER NOT NULL DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Game type: 'stroke' or 'match'
  game_type TEXT NOT NULL DEFAULT 'stroke',
  
  -- Team A players (stored as JSON array for flexibility)
  team_a_name TEXT NOT NULL DEFAULT 'Team A',
  team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Team B players
  team_b_name TEXT NOT NULL DEFAULT 'Team B',
  team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Scoring
  use_handicaps BOOLEAN NOT NULL DEFAULT false,
  team_a_total INTEGER NOT NULL DEFAULT 0,
  team_b_total INTEGER NOT NULL DEFAULT 0,
  
  -- Match play specific
  match_status INTEGER NOT NULL DEFAULT 0, -- positive = Team A up, negative = Team B up
  holes_remaining INTEGER NOT NULL DEFAULT 18,
  
  -- Game status
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winner_team TEXT, -- 'A', 'B', 'TIE'
  final_result TEXT -- e.g., "3 & 2" for match play
);

-- Create best_ball_holes table
CREATE TABLE public.best_ball_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.best_ball_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Player scores stored as JSONB: [{playerId, grossScore, netScore, handicapStrokes}]
  team_a_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  team_b_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Best ball results
  team_a_best_gross INTEGER,
  team_a_best_net INTEGER,
  team_a_counting_player TEXT, -- name of player whose score counted
  
  team_b_best_gross INTEGER,
  team_b_best_net INTEGER,
  team_b_counting_player TEXT,
  
  -- Running totals (stroke play)
  team_a_running_total INTEGER NOT NULL DEFAULT 0,
  team_b_running_total INTEGER NOT NULL DEFAULT 0,
  
  -- Match play hole result: 1 = Team A wins, -1 = Team B wins, 0 = halved
  hole_result INTEGER NOT NULL DEFAULT 0,
  match_status_after INTEGER NOT NULL DEFAULT 0,
  holes_remaining_after INTEGER NOT NULL DEFAULT 17,
  
  UNIQUE(game_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.best_ball_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.best_ball_holes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for best_ball_games
CREATE POLICY "Users can view their own best ball games" 
ON public.best_ball_games FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own best ball games" 
ON public.best_ball_games FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own best ball games" 
ON public.best_ball_games FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own best ball games" 
ON public.best_ball_games FOR DELETE 
USING (auth.uid() = user_id);

-- Friends can view best ball games
CREATE POLICY "Friends can view best ball games"
ON public.best_ball_games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = best_ball_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = best_ball_games.user_id)
  )
);

-- RLS Policies for best_ball_holes
CREATE POLICY "Users can view holes of their best ball games" 
ON public.best_ball_holes FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM best_ball_games g 
    WHERE g.id = best_ball_holes.game_id AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert holes to their best ball games" 
ON public.best_ball_holes FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM best_ball_games g 
    WHERE g.id = best_ball_holes.game_id AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update holes of their best ball games" 
ON public.best_ball_holes FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM best_ball_games g 
    WHERE g.id = best_ball_holes.game_id AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete holes of their best ball games" 
ON public.best_ball_holes FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM best_ball_games g 
    WHERE g.id = best_ball_holes.game_id AND g.user_id = auth.uid()
  )
);

-- Friends can view best ball holes
CREATE POLICY "Friends can view best ball holes"
ON public.best_ball_holes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM best_ball_games g
    WHERE g.id = best_ball_holes.game_id
    AND (
      g.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM friends_pairs fp
        WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
           OR (fp.b = auth.uid() AND fp.a = g.user_id)
      )
    )
  )
);