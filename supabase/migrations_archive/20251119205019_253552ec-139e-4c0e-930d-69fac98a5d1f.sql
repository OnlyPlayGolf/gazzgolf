-- Fix Aggressive Putting to have lowest scores on top
UPDATE drills 
SET lower_is_better = true 
WHERE title = 'Aggressive Putting';