-- Fix Djursholms GK tee setup:
-- - Remove orange tee
-- - Ensure tee labels are 39 (shortest) → 58 (longest)
-- - If orange_distance was used as the longest tee, move it to black_distance and null orange_distance

update public.courses
set tee_names = jsonb_build_object(
  'black', '58',
  'blue', '55',
  'white', '49',
  'yellow', '44',
  'red', '39'
)
where name in (
  'Djursholms GK',
  'Djursholms Golf Klubb',
  'Djursholms Golfklubb'
);

update public.course_holes ch
set
  black_distance = coalesce(ch.black_distance, ch.orange_distance),
  orange_distance = null
where ch.course_id in (
  select id from public.courses
  where name in (
    'Djursholms GK',
    'Djursholms Golf Klubb',
    'Djursholms Golfklubb'
  )
);

