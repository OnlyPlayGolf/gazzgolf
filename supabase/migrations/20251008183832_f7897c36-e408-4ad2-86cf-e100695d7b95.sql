-- Create enum types for hole tracking
CREATE TYPE public.tee_result AS ENUM ('FIR', 'MissL', 'MissR', 'Short', 'Long', 'Penalty');
CREATE TYPE public.approach_bucket AS ENUM ('200+', '120-200', '40-120', '<40');
CREATE TYPE public.approach_result AS ENUM ('GIR', 'MissL', 'MissR', 'Short', 'Long', 'Penalty');
CREATE TYPE public.first_putt_band AS ENUM ('0-2', '2-7', '7+');

-- Create rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  date_played DATE NOT NULL DEFAULT CURRENT_DATE,
  tee_set TEXT,
  holes_played INTEGER NOT NULL DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on rounds
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

-- RLS policies for rounds
CREATE POLICY "Users can view their own rounds"
  ON public.rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rounds"
  ON public.rounds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rounds"
  ON public.rounds FOR DELETE
  USING (auth.uid() = user_id);

-- Create holes table
CREATE TABLE public.holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  par INTEGER NOT NULL,
  score INTEGER NOT NULL,
  tee_result tee_result,
  approach_bucket approach_bucket,
  approach_result approach_result,
  up_and_down BOOLEAN DEFAULT FALSE,
  sand_save BOOLEAN DEFAULT FALSE,
  putts INTEGER,
  first_putt_band first_putt_band,
  penalties INTEGER DEFAULT 0,
  recovery BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(round_id, hole_number)
);

-- Enable RLS on holes
ALTER TABLE public.holes ENABLE ROW LEVEL SECURITY;

-- RLS policies for holes (check ownership via rounds table)
CREATE POLICY "Users can view holes from their own rounds"
  ON public.holes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = holes.round_id
      AND rounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert holes to their own rounds"
  ON public.holes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = holes.round_id
      AND rounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update holes from their own rounds"
  ON public.holes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = holes.round_id
      AND rounds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete holes from their own rounds"
  ON public.holes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.rounds
      WHERE rounds.id = holes.round_id
      AND rounds.user_id = auth.uid()
    )
  );

-- Create a view for round summaries
CREATE OR REPLACE VIEW public.round_summaries AS
SELECT 
  r.id as round_id,
  r.user_id,
  r.course_name,
  r.date_played,
  r.tee_set,
  r.holes_played,
  SUM(h.score) as total_score,
  SUM(h.par) as total_par,
  SUM(h.score) - SUM(h.par) as score_vs_par,
  COUNT(CASE WHEN h.tee_result = 'FIR' THEN 1 END)::float / 
    NULLIF(COUNT(CASE WHEN h.par >= 4 THEN 1 END), 0) * 100 as fir_percentage,
  COUNT(CASE WHEN h.approach_result = 'GIR' THEN 1 END)::float / 
    NULLIF(COUNT(h.id), 0) * 100 as gir_percentage,
  COUNT(CASE WHEN h.up_and_down = TRUE THEN 1 END)::float / 
    NULLIF(COUNT(CASE WHEN h.approach_result != 'GIR' THEN 1 END), 0) * 100 as updown_percentage,
  SUM(h.putts) as total_putts,
  COUNT(CASE WHEN h.putts >= 3 THEN 1 END) as three_putts,
  SUM(h.penalties) as total_penalties,
  COUNT(CASE WHEN h.sand_save = TRUE THEN 1 END) as sand_saves
FROM public.rounds r
LEFT JOIN public.holes h ON r.id = h.round_id
GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.tee_set, r.holes_played;

-- Grant access to the view
GRANT SELECT ON public.round_summaries TO authenticated;