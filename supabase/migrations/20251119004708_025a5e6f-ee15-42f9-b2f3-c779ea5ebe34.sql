-- Add TW's 9 Windows Test drill
INSERT INTO public.drills (title, short_desc, long_desc, lower_is_better)
SELECT 
  'TW''s 9 Windows Test',
  'Hit all 9 shot combinations (3 trajectories × 3 shapes) with a 7 iron. Count shots needed to complete all windows.',
  'Inspired by Tiger Woods'' legendary shot-making ability, this drill tests your capacity to control both trajectory and shape with precision. Hit shots through all 9 "windows" - every combination of Low/Middle/High trajectory and Fade/Straight/Draw shape. Window order is randomized each session. Use a 7 iron and a 15-meter wide target. Lower score is better - perfect score is 9 shots.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.drills WHERE title = 'TW''s 9 Windows Test'
);