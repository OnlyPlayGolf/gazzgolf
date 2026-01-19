-- Diagnostic queries to check if snapshots exist

-- 1. Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rounds' AND column_name = 'scorecard_snapshot';

-- 2. Count rounds with/without snapshots
SELECT 
  COUNT(*) as total_rounds,
  COUNT(scorecard_snapshot) as rounds_with_snapshots,
  COUNT(*) - COUNT(scorecard_snapshot) as rounds_without_snapshots
FROM rounds;

-- 3. Check rounds that have holes but no snapshot
SELECT 
  r.id,
  r.course_name,
  r.holes_played,
  COUNT(h.id) as hole_count,
  CASE WHEN r.scorecard_snapshot IS NULL THEN 'NO SNAPSHOT' ELSE 'HAS SNAPSHOT' END as snapshot_status
FROM rounds r
LEFT JOIN holes h ON h.round_id = r.id
GROUP BY r.id, r.course_name, r.holes_played, r.scorecard_snapshot
HAVING COUNT(h.id) > 0
ORDER BY r.created_at DESC
LIMIT 10;

-- 4. Sample snapshot structure (if any exist)
SELECT 
  round_id,
  course_name,
  jsonb_pretty(scorecard_snapshot) as snapshot_json
FROM round_summaries
WHERE scorecard_snapshot IS NOT NULL
LIMIT 1;
