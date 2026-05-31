-- Fix 1: Restrict profiles table access
-- Drop the overly permissive policy that allows any authenticated user to read all profiles
DROP POLICY IF EXISTS "profiles_read_all_authenticated" ON public.profiles;

-- Create more restrictive policies for profiles:
-- 1. Users can always read their own profile
CREATE POLICY "profiles_read_own"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. Users can read profiles of their friends
CREATE POLICY "profiles_read_friends"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = profiles.id)
       OR (fp.b = auth.uid() AND fp.a = profiles.id)
  )
);

-- 3. Users can read profiles of people in their groups
CREATE POLICY "profiles_read_group_members"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = profiles.id
  )
);

-- 4. Users can read profiles of people in their rounds (as participants)
CREATE POLICY "profiles_read_round_participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.round_players rp1
    JOIN public.round_players rp2 ON rp2.round_id = rp1.round_id
    WHERE rp1.user_id = auth.uid()
      AND rp2.user_id = profiles.id
  )
);

-- Fix 2: Recreate round_summaries view with security_invoker
-- This ensures the view respects RLS policies on underlying tables (rounds, holes)
DROP VIEW IF EXISTS public.round_summaries;

CREATE VIEW public.round_summaries
WITH (security_invoker = on)
AS
SELECT 
  r.id AS round_id,
  r.user_id,
  r.course_name,
  r.date_played,
  r.holes_played,
  r.tee_set,
  sum(h.score) AS total_score,
  sum(h.par) AS total_par,
  (sum(h.score) - sum(h.par)) AS score_vs_par,
  sum(h.putts) AS total_putts,
  count(*) FILTER (WHERE (h.putts > 2)) AS three_putts,
  sum(h.penalties) AS total_penalties,
  count(*) FILTER (WHERE (h.tee_result = 'FIR'::tee_result)) AS fairways_hit,
  count(*) FILTER (WHERE (h.par >= 4)) AS par4_and_5_count,
  CASE
    WHEN (count(*) FILTER (WHERE (h.par >= 4)) > 0) 
    THEN (((count(*) FILTER (WHERE (h.tee_result = 'FIR'::tee_result)))::double precision / (count(*) FILTER (WHERE (h.par >= 4)))::double precision) * (100)::double precision)
    ELSE NULL::double precision
  END AS fir_percentage,
  count(*) FILTER (WHERE ('GIR'::text = ANY (h.approach_results))) AS greens_hit,
  CASE
    WHEN (count(*) > 0) 
    THEN (((count(*) FILTER (WHERE ('GIR'::text = ANY (h.approach_results))))::double precision / (count(*))::double precision) * (100)::double precision)
    ELSE NULL::double precision
  END AS gir_percentage,
  count(*) FILTER (WHERE (h.sand_save = true)) AS sand_saves,
  count(*) FILTER (WHERE (h.up_and_down = true)) AS up_and_downs,
  count(*) FILTER (WHERE (NOT ('GIR'::text = ANY (h.approach_results)))) AS missed_greens,
  CASE
    WHEN (count(*) FILTER (WHERE (NOT ('GIR'::text = ANY (h.approach_results)))) > 0) 
    THEN (((count(*) FILTER (WHERE (h.up_and_down = true)))::double precision / (count(*) FILTER (WHERE (NOT ('GIR'::text = ANY (h.approach_results)))))::double precision) * (100)::double precision)
    ELSE NULL::double precision
  END AS updown_percentage
FROM public.rounds r
LEFT JOIN public.holes h ON (h.round_id = r.id)
GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.holes_played, r.tee_set;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.round_summaries TO authenticated;