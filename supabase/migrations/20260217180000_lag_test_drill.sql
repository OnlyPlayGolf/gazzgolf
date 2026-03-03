-- Add "18-Hole Lag Test" as a coach_only drill
-- Fixed 18-putt lag putting test from 8-22m with golf-style scoring (lower is better).

INSERT INTO public.drills (title, shot_area, visibility, lower_is_better)
VALUES ('18-Hole Lag Test', 'putting', 'coach_only', true)
ON CONFLICT DO NOTHING;
