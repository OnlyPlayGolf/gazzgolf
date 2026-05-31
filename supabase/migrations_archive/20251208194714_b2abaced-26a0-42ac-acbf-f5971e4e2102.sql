-- Fix existing accepted friendships that have NULL user_a/user_b
UPDATE friendships 
SET user_a = LEAST(requester, addressee), 
    user_b = GREATEST(requester, addressee) 
WHERE status = 'accepted' 
  AND (user_a IS NULL OR user_b IS NULL)
  AND requester IS NOT NULL 
  AND addressee IS NOT NULL;

-- Create or replace a trigger to automatically populate user_a/user_b when status becomes accepted
CREATE OR REPLACE FUNCTION populate_friendship_pair()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.requester IS NOT NULL AND NEW.addressee IS NOT NULL THEN
    NEW.user_a := LEAST(NEW.requester, NEW.addressee);
    NEW.user_b := GREATEST(NEW.requester, NEW.addressee);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS populate_friendship_pair_trigger ON friendships;
CREATE TRIGGER populate_friendship_pair_trigger
BEFORE INSERT OR UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION populate_friendship_pair();