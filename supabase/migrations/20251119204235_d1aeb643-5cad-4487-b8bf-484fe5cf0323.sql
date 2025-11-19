-- Fix lower_is_better flags for drills
UPDATE drills 
SET lower_is_better = true 
WHERE title = 'PGA Tour 18 Holes';

UPDATE drills 
SET lower_is_better = false 
WHERE title = 'Aggressive Putting';

UPDATE drills 
SET lower_is_better = true 
WHERE title = '18 Up & Downs';

-- TW's 9 Windows Test is already correct (lower_is_better = true)