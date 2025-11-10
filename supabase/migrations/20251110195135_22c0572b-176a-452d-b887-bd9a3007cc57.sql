-- Add description column to groups table
ALTER TABLE public.groups 
ADD COLUMN description text;