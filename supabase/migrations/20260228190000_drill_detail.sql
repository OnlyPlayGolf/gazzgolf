-- Add optional detail/notes field to session drills (e.g. "15 min", "3 rounds", "20 balls")
ALTER TABLE public.session_drills
ADD COLUMN IF NOT EXISTS drill_detail TEXT;
