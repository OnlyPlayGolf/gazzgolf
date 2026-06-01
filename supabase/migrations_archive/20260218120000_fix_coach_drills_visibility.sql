-- Fix: mark all non-canonical drills as 'coach_only'
-- These were created by Coach AI before the visibility column existed,
-- so they defaulted to 'featured' and appear in leaderboard drill pickers.

UPDATE public.drills
SET visibility = 'coach_only'
WHERE title NOT IN (
  'PGA Tour 18-hole Test',
  'Aggressive Putting 4-6m',
  'Up & Down Putts 6-10m',
  'Short Putt Test',
  'Lag Putting Drill 8-20m',
  '8-Ball Circuit',
  '18 Up & Downs',
  'Easy Chip Drill',
  'Wedge Game 40-80m',
  'Wedge Ladder 60-120m',
  'Approach Control 130-180m',
  '9 Windows Shot Shape Test',
  'Shot Shape Master',
  'Driver Control Drill'
)
AND visibility = 'featured';
