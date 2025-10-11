-- Update user_settings table to support multiple favorite groups (max 3)
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS favourite_group_id;

ALTER TABLE public.user_settings 
ADD COLUMN favourite_group_ids uuid[] DEFAULT '{}';

-- Add a check constraint to limit to max 3 favorite groups
CREATE OR REPLACE FUNCTION check_favourite_groups_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.favourite_group_ids, 1) > 3 THEN
    RAISE EXCEPTION 'Cannot have more than 3 favourite groups';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_favourite_groups_limit
BEFORE INSERT OR UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION check_favourite_groups_limit();