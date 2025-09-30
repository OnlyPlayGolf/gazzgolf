-- Add unique constraint on group_members to prevent duplicates
ALTER TABLE public.group_members 
ADD CONSTRAINT group_members_group_user_unique 
UNIQUE (group_id, user_id);