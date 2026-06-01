-- Fix lower_is_better flag for Åberg's Wedge Ladder
-- This drill uses "shots" as the unit, so fewer shots is better
UPDATE drills 
SET lower_is_better = true 
WHERE title = 'Åberg''s Wedge Ladder';
