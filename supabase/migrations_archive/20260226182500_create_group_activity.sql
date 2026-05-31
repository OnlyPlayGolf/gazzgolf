-- Create group_activity table for group activity feed
CREATE TABLE IF NOT EXISTS public.group_activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'manual' CHECK (type IN ('auto', 'manual')),
    content text,
    image_url text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast feed queries
CREATE INDEX IF NOT EXISTS idx_group_activity_group_created
ON public.group_activity (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_activity_user
ON public.group_activity (user_id);

-- Enable RLS
ALTER TABLE public.group_activity ENABLE ROW LEVEL SECURITY;

-- Group members can read activity for their groups
CREATE POLICY "Group members can read activity"
ON public.group_activity
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_activity.group_id
      AND gm.user_id = auth.uid()
  )
);

-- Group members can insert activity for their groups
CREATE POLICY "Group members can insert activity"
ON public.group_activity
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_activity.group_id
      AND gm.user_id = auth.uid()
  )
);

-- Users can delete their own activity posts
CREATE POLICY "Users can delete own activity"
ON public.group_activity
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
