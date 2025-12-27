-- Fix friend search without exposing profile PII
-- 1) Remove the broad profiles SELECT policy (friend search will use RPC returning safe fields)
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON public.profiles;

-- 2) Fix security-linter ERROR: make round_summaries a SECURITY INVOKER view
CREATE OR REPLACE VIEW public.round_summaries
WITH (security_invoker = true)
AS
SELECT r.id AS round_id,
    r.user_id,
    r.course_name,
    r.date_played,
    r.holes_played,
    r.tee_set,
    sum(h.score) AS total_score,
    sum(h.par) AS total_par,
    sum(h.score) - sum(h.par) AS score_vs_par,
    sum(h.putts) AS total_putts,
    count(*) FILTER (WHERE h.putts > 2) AS three_putts,
    sum(h.penalties) AS total_penalties,
    count(*) FILTER (WHERE h.tee_result = 'FIR'::tee_result) AS fairways_hit,
    count(*) FILTER (WHERE h.par >= 4) AS par4_and_5_count,
        CASE
            WHEN count(*) FILTER (WHERE h.par >= 4) > 0 THEN count(*) FILTER (WHERE h.tee_result = 'FIR'::tee_result)::double precision / count(*) FILTER (WHERE h.par >= 4)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS fir_percentage,
    count(*) FILTER (WHERE 'GIR'::text = ANY (h.approach_results)) AS greens_hit,
        CASE
            WHEN count(*) > 0 THEN count(*) FILTER (WHERE 'GIR'::text = ANY (h.approach_results))::double precision / count(*)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS gir_percentage,
    count(*) FILTER (WHERE h.sand_save = true) AS sand_saves,
    count(*) FILTER (WHERE h.up_and_down = true) AS up_and_downs,
    count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results))) AS missed_greens,
        CASE
            WHEN count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results))) > 0 THEN count(*) FILTER (WHERE h.up_and_down = true)::double precision / count(*) FILTER (WHERE NOT ('GIR'::text = ANY (h.approach_results)))::double precision * 100::double precision
            ELSE NULL::double precision
        END AS updown_percentage
   FROM rounds r
     LEFT JOIN holes h ON h.round_id = r.id
  GROUP BY r.id, r.user_id, r.course_name, r.date_played, r.holes_played, r.tee_set;

-- 3) RPC: search profiles (returns safe fields only)
CREATE OR REPLACE FUNCTION public.search_profiles(q text, max_results integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.country
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND (
      (q IS NOT NULL AND length(trim(q)) > 0)
      AND (
        coalesce(p.username, '') ILIKE '%' || trim(q) || '%'
        OR coalesce(p.display_name, '') ILIKE '%' || trim(q) || '%'
        OR (
          position('@' in trim(q)) > 0
          AND lower(p.email) = lower(trim(q))
        )
      )
    )
  ORDER BY coalesce(p.display_name, p.username, '')
  LIMIT greatest(1, least(coalesce(max_results, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.search_profiles(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, integer) TO authenticated;

-- 4) RPC: fetch a single public profile by id (for QR add-friend screen)
CREATE OR REPLACE FUNCTION public.get_public_profile(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  country text,
  handicap text,
  home_club text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.country,
    p.handicap,
    p.home_club
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = target_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;