-- Backfill missing/incorrect round_name values so profile can show the real round name
-- We only touch non-pro-stats rounds where round_name is NULL or incorrectly equals course_name.
WITH ranked AS (
  SELECT
    id,
    user_id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY
        COALESCE(created_at, (date_played::timestamptz)) ASC,
        date_played ASC,
        id ASC
    ) AS rn
  FROM public.rounds
)
UPDATE public.rounds r
SET round_name = 'Round ' || ranked.rn
FROM ranked
WHERE r.id = ranked.id
  AND (r.round_name IS NULL OR r.round_name = r.course_name)
  AND (r.origin IS NULL OR r.origin IN ('play','tracker'));