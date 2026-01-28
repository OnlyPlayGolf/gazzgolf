-- Add 21 Points Short Game drill
INSERT INTO public.drills (title, short_desc, long_desc, lower_is_better)
SELECT
  '21 Points',
  'Competitive short-game drill: 2+ players race to 21 points. Points by proximity to the hole.',
  '21 Points is a competitive short-game drill where 2 or more players compete to be the first to reach 21 points or more. Points are awarded based on proximity to the hole: the closer the shot finishes, the more points the player receives. The drill ends automatically when a player reaches 21+, and the result is saved. Higher total is better (first to 21 wins).',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.drills WHERE title = '21 Points'
);
