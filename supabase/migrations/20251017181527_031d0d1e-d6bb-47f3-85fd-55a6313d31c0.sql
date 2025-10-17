DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_update_in_conversation'
  ) THEN
    CREATE POLICY "messages_update_in_conversation"
    ON public.messages
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.group_members gm ON gm.group_id = c.group_id
        WHERE c.id = messages.conversation_id
          AND gm.user_id = auth.uid()
      )
    )
    WITH CHECK (
      (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id
            AND cp.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1
          FROM public.conversations c
          JOIN public.group_members gm ON gm.group_id = c.group_id
          WHERE c.id = messages.conversation_id
            AND gm.user_id = auth.uid()
        )
      )
    );
  END IF;
END
$$;