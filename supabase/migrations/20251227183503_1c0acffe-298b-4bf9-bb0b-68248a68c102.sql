-- 1. Delete duplicate friendship records (keep only the accepted one where it exists)
DELETE FROM friendships 
WHERE id IN (
  SELECT f2.id
  FROM friendships f1
  JOIN friendships f2 ON f1.requester = f2.addressee AND f1.addressee = f2.requester
  WHERE f1.id < f2.id
    AND f1.status = 'accepted'
    AND f2.status = 'pending'
);

-- 2. For any remaining duplicates (both pending or both accepted), keep the older one
DELETE FROM friendships
WHERE id IN (
  SELECT f2.id
  FROM friendships f1
  JOIN friendships f2 ON f1.requester = f2.addressee AND f1.addressee = f2.requester
  WHERE f1.created_at < f2.created_at
);

-- 3. Add a unique constraint to prevent duplicate friendships in either direction
-- First create a function to normalize the pair
CREATE OR REPLACE FUNCTION normalized_friendship_pair(a uuid, b uuid)
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[LEAST(a, b), GREATEST(a, b)];
$$;

-- Create a unique index using the normalized pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_friendship_pair 
ON friendships (
  (LEAST(requester, addressee)),
  (GREATEST(requester, addressee))
);