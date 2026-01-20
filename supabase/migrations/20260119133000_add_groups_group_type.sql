-- Add group_type to groups to distinguish permission model
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'player';

-- Ensure only supported values are allowed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_group_type_check'
      AND conrelid = 'public.groups'::regclass
  ) THEN
    ALTER TABLE public.groups
    ADD CONSTRAINT groups_group_type_check
    CHECK (group_type IN ('player', 'coach'));
  END IF;
END $$;

-- Backfill existing groups:
-- If any admin exists, treat as coach group, otherwise player group.
UPDATE public.groups g
SET group_type = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = g.id
      AND gm.role = 'admin'
  ) THEN 'coach'
  ELSE 'player'
END;

