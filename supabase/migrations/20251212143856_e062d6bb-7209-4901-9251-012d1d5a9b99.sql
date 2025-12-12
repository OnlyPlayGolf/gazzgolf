-- Create table for Match Play games
CREATE TABLE public.match_play_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_name TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  tee_set TEXT,
  holes_played INTEGER NOT NULL DEFAULT 18,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  player_1 TEXT NOT NULL,
  player_1_handicap NUMERIC,
  player_1_tee TEXT,
  
  player_2 TEXT NOT NULL,
  player_2_handicap NUMERIC,
  player_2_tee TEXT,
  
  use_handicaps BOOLEAN NOT NULL DEFAULT false,
  
  -- Match status: positive = player 1 up, negative = player 2 up, 0 = all square
  match_status INTEGER NOT NULL DEFAULT 0,
  holes_remaining INTEGER NOT NULL DEFAULT 18,
  
  is_finished BOOLEAN NOT NULL DEFAULT false,
  winner_player TEXT,
  final_result TEXT -- e.g. "3 & 2", "1 Up", "All Square"
);

-- Create table for Match Play holes
CREATE TABLE public.match_play_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.match_play_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER,
  
  player_1_gross_score INTEGER,
  player_1_net_score INTEGER,
  player_2_gross_score INTEGER,
  player_2_net_score INTEGER,
  
  -- Hole result: 1 = player 1 won, -1 = player 2 won, 0 = halved
  hole_result INTEGER NOT NULL DEFAULT 0,
  
  -- Running match status after this hole
  match_status_after INTEGER NOT NULL DEFAULT 0,
  holes_remaining_after INTEGER NOT NULL DEFAULT 17
);

-- Enable RLS
ALTER TABLE public.match_play_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_play_holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for match_play_games
CREATE POLICY "Users can view their own match play games"
  ON public.match_play_games FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match play games"
  ON public.match_play_games FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own match play games"
  ON public.match_play_games FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own match play games"
  ON public.match_play_games FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for match_play_holes
CREATE POLICY "Users can view holes of their match play games"
  ON public.match_play_holes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.match_play_games g
    WHERE g.id = match_play_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert holes to their match play games"
  ON public.match_play_holes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.match_play_games g
    WHERE g.id = match_play_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can update holes of their match play games"
  ON public.match_play_holes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.match_play_games g
    WHERE g.id = match_play_holes.game_id AND g.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete holes of their match play games"
  ON public.match_play_holes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.match_play_games g
    WHERE g.id = match_play_holes.game_id AND g.user_id = auth.uid()
  ));