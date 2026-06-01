-- Group challenges: weekly drill challenges for groups

CREATE TABLE IF NOT EXISTS public.group_challenges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  drill_id    uuid        REFERENCES public.drills(id) ON DELETE SET NULL,
  drill_slug  text        NOT NULL,
  drill_title text        NOT NULL,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  title       text        NOT NULL,
  message     text,
  start_date  date        NOT NULL DEFAULT CURRENT_DATE,
  end_date    date        NOT NULL DEFAULT (CURRENT_DATE + 6),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;

-- SELECT: any group member can read challenges for their group
CREATE POLICY "group_challenges_select_member"
ON public.group_challenges
FOR SELECT
TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

-- INSERT: owner/admin OR coach who is a group member
CREATE POLICY "group_challenges_insert_manager"
ON public.group_challenges
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.is_group_owner_or_admin(auth.uid(), group_id)
    OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
  )
);

-- UPDATE: owner/admin OR coach who is a group member
CREATE POLICY "group_challenges_update_manager"
ON public.group_challenges
FOR UPDATE
TO authenticated
USING (
  public.is_group_owner_or_admin(auth.uid(), group_id)
  OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
)
WITH CHECK (
  public.is_group_owner_or_admin(auth.uid(), group_id)
  OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
);

-- DELETE: owner/admin OR coach who is a group member
CREATE POLICY "group_challenges_delete_manager"
ON public.group_challenges
FOR DELETE
TO authenticated
USING (
  public.is_group_owner_or_admin(auth.uid(), group_id)
  OR (public.is_group_member(auth.uid(), group_id) AND public.is_coach(auth.uid()))
);

-- Index for fast active-challenge lookup
CREATE INDEX idx_group_challenges_active
ON public.group_challenges (group_id, is_active)
WHERE is_active = true;
