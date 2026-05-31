-- Add INSERT policy for conversation_participants
-- Users should be able to add participants to conversations they are creating or part of
CREATE POLICY "Users can add participants to conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Allow adding yourself as a participant
    user_id = auth.uid() OR
    -- Allow adding others if you are already a participant in that conversation
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  )
);