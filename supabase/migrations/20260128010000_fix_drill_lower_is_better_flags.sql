-- Fix lower_is_better flags for PGA Tour 18-hole and Aggressive Putting 4-6m variants
-- These drills should show fewest putts at the top (lower scores are better)

-- PGA Tour 18-hole variants - lower is better (fewer putts)
UPDATE drills 
SET lower_is_better = true 
WHERE title IN ('PGA Tour 18-hole', 'PGA Tour 18 Holes', 'PGA Tour 18-hole Test', '18-hole PGA Tour Putting Test');

-- Aggressive Putting 4-6m variants - lower is better (fewer putts)
UPDATE drills 
SET lower_is_better = true 
WHERE title IN ('Aggressive Putting 4-6m', 'Aggressive Putting');
