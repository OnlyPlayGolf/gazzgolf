-- Add "The Foot Ladder" putting drills (3 variants) as coach_only drills
-- Not shown on Practice page — only surfaced by Coach AI.

INSERT INTO public.drills (title, shot_area, visibility, lower_is_better)
VALUES
  ('The Foot Ladder', 'putting', 'coach_only', false),
  ('The Foot Ladder – Comeback', 'putting', 'coach_only', false),
  ('The Foot Ladder – Elite', 'putting', 'coach_only', false)
ON CONFLICT DO NOTHING;
