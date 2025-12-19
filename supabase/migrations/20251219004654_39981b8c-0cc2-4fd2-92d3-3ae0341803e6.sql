-- Create skins_games table
CREATE TABLE public.skins_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  course_name TEXT NOT NULL,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  holes_played INTEGER NOT NULL DEFAULT 18,
  skin_value NUMERIC NOT NULL DEFAULT 1,
  carryover_enabled BOOLEAN NOT NULL DEFAULT true,
  use_handicaps BOOLEAN NOT NULL DEFAULT false,
  handicap_mode TEXT NOT NULL DEFAULT 'net', -- 'gross' or 'net'
  is_finished BOOLEAN NOT NULL DEFAULT false,
  players JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, handicap, tee, group_name}
  winner_player TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create skins_holes table
CREATE TABLE public.skins_holes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.skins_games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER,
  player_scores JSONB NOT NULL DEFAULT '{}'::jsonb, -- {playerName: {gross: X, net: X}}
  skins_available INTEGER NOT NULL DEFAULT 1, -- Including carryovers
  winner_player TEXT, -- Null if carried over
  is_carryover BOOLEAN NOT NULL DEFAULT false, -- Did this hole result in a carryover
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.skins_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skins_holes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skins_games
CREATE POLICY "Users can view their own skins games"
ON public.skins_games FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Friends can view skins games"
ON public.skins_games FOR SELECT
USING (EXISTS (
  SELECT 1 FROM friends_pairs fp
  WHERE (fp.a = auth.uid() AND fp.b = skins_games.user_id)
     OR (fp.b = auth.uid() AND fp.a = skins_games.user_id)
));

CREATE POLICY "Users can insert their own skins games"
ON public.skins_games FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skins games"
ON public.skins_games FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own skins games"
ON public.skins_games FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for skins_holes
CREATE POLICY "Users can view holes of their skins games"
ON public.skins_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM skins_games g
  WHERE g.id = skins_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Friends can view skins holes"
ON public.skins_holes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM skins_games g
  WHERE g.id = skins_holes.game_id
  AND (g.user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
       OR (fp.b = auth.uid() AND fp.a = g.user_id)
  ))
));

CREATE POLICY "Users can insert holes to their skins games"
ON public.skins_holes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM skins_games g
  WHERE g.id = skins_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can update holes of their skins games"
ON public.skins_holes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM skins_games g
  WHERE g.id = skins_holes.game_id AND g.user_id = auth.uid()
));

CREATE POLICY "Users can delete holes of their skins games"
ON public.skins_holes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM skins_games g
  WHERE g.id = skins_holes.game_id AND g.user_id = auth.uid()
));