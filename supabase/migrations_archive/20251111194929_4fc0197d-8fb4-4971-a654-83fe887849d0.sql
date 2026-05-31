-- Pro Stats: separate tables from gameplay rounds

-- 1) Create pro_stats_rounds (user-owned logical round for Pro Stats)
CREATE TABLE IF NOT EXISTS public.pro_stats_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_round_id uuid NULL, -- optional link to UI route id; no FK to avoid RLS coupling
  course_name text NULL,
  holes_played integer NOT NULL DEFAULT 18,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pro_stats_rounds ENABLE ROW LEVEL SECURITY;

-- Policies: user owns their rows
DROP POLICY IF EXISTS "ps_rounds_select_own" ON public.pro_stats_rounds;
CREATE POLICY "ps_rounds_select_own" ON public.pro_stats_rounds FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ps_rounds_insert_own" ON public.pro_stats_rounds;
CREATE POLICY "ps_rounds_insert_own" ON public.pro_stats_rounds FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ps_rounds_update_own" ON public.pro_stats_rounds;
CREATE POLICY "ps_rounds_update_own" ON public.pro_stats_rounds FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ps_rounds_delete_own" ON public.pro_stats_rounds;
CREATE POLICY "ps_rounds_delete_own" ON public.pro_stats_rounds FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) Create pro_stats_holes (shots per hole for Pro Stats)
CREATE TABLE IF NOT EXISTS public.pro_stats_holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_round_id uuid NOT NULL,
  hole_number integer NOT NULL,
  par integer NOT NULL,
  score integer NOT NULL,
  putts integer NULL,
  pro_shot_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pro_round_id, hole_number)
);

-- RLS
ALTER TABLE public.pro_stats_holes ENABLE ROW LEVEL SECURITY;

-- Policies referencing parent pro_stats_rounds
DROP POLICY IF EXISTS "ps_holes_select_own" ON public.pro_stats_holes;
CREATE POLICY "ps_holes_select_own" ON public.pro_stats_holes FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.pro_stats_rounds pr
    WHERE pr.id = pro_stats_holes.pro_round_id AND pr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ps_holes_insert_own" ON public.pro_stats_holes;
CREATE POLICY "ps_holes_insert_own" ON public.pro_stats_holes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pro_stats_rounds pr
    WHERE pr.id = pro_stats_holes.pro_round_id AND pr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ps_holes_update_own" ON public.pro_stats_holes;
CREATE POLICY "ps_holes_update_own" ON public.pro_stats_holes FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.pro_stats_rounds pr
    WHERE pr.id = pro_stats_holes.pro_round_id AND pr.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pro_stats_rounds pr
    WHERE pr.id = pro_stats_holes.pro_round_id AND pr.user_id = auth.uid()
  )
);
