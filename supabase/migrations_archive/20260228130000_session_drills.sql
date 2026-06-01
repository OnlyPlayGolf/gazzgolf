-- session_drills: ordered drill lineup for a session

CREATE TABLE IF NOT EXISTS public.session_drills (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  position        int         NOT NULL,
  drill_type      text        NOT NULL CHECK (drill_type IN ('builtin', 'coach')),
  drill_slug      text,
  drill_title     text        NOT NULL,
  coach_drill_id  uuid        REFERENCES public.coach_drills(id) ON DELETE SET NULL,
  drill_payload   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, position)
);

ALTER TABLE public.session_drills ENABLE ROW LEVEL SECURITY;

-- SELECT: any group member can see drill lineups
CREATE POLICY "session_drills_select_member"
ON public.session_drills
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND public.is_group_member(auth.uid(), gs.group_id)
  )
);

-- INSERT: session creator who is coach or owner/admin
CREATE POLICY "session_drills_insert_manager"
ON public.session_drills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND gs.created_by = auth.uid()
    AND (
      public.is_group_owner_or_admin(auth.uid(), gs.group_id)
      OR (public.is_group_member(auth.uid(), gs.group_id) AND public.is_coach(auth.uid()))
    )
  )
);

-- UPDATE: session creator
CREATE POLICY "session_drills_update_manager"
ON public.session_drills
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND gs.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND gs.created_by = auth.uid()
  )
);

-- DELETE: session creator
CREATE POLICY "session_drills_delete_manager"
ON public.session_drills
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_sessions gs
    WHERE gs.id = session_drills.session_id
    AND gs.created_by = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_session_drills_session_position
ON public.session_drills (session_id, position);
