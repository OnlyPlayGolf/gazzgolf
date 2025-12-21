-- Delete round_players for unfinished rounds first
DELETE FROM round_players 
WHERE round_id IN (
  SELECT r.id
  FROM rounds r
  WHERE r.user_id = 'f2e6d651-e6a9-42d7-8bd8-0479899b3e22'
    AND (r.origin IS NULL OR r.origin = 'play' OR r.origin = 'tracker')
    AND NOT EXISTS (SELECT 1 FROM holes h WHERE h.round_id = r.id)
);

-- Delete the unfinished rounds
DELETE FROM rounds 
WHERE user_id = 'f2e6d651-e6a9-42d7-8bd8-0479899b3e22'
  AND (origin IS NULL OR origin = 'play' OR origin = 'tracker')
  AND NOT EXISTS (SELECT 1 FROM holes h WHERE h.round_id = rounds.id);