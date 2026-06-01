-- Add "The Distance Ladder" as a coach_only drill
-- This is a quick putting drill where distance increases with attempts.
-- Not shown on Practice page — only surfaced by Coach AI.

INSERT INTO public.drills (title, shot_area, visibility, lower_is_better)
VALUES ('The Distance Ladder', 'putting', 'coach_only', false)
ON CONFLICT DO NOTHING;
