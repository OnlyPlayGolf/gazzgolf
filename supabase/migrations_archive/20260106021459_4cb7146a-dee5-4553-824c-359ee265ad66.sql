-- Drop the existing incomplete INSERT policy
DROP POLICY IF EXISTS "Users can create friend conversations" ON public.conversations;

-- Create proper INSERT policy that checks the user is authenticated
CREATE POLICY "Authenticated users can create friend conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND type = 'friend'
);

-- Also add UPDATE policy for conversations (for updating updated_at)
CREATE POLICY "Users can update their conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);