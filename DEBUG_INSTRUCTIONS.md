# Debug: Why Requests Haven't Decreased

## Step 1: Check if Snapshots Exist

Run this in Supabase SQL Editor:

```sql
SELECT 
  COUNT(*) as total_rounds,
  COUNT(scorecard_snapshot) as rounds_with_snapshots
FROM rounds;
```

**If `rounds_with_snapshots` is 0**, you need to run the backfill!

## Step 2: Run Backfill (If Needed)

If snapshots don't exist, run this to generate them:

```sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT round_id FROM holes LOOP
    PERFORM public.rebuild_round_scorecard_snapshot(r.round_id);
  END LOOP;
END $$;
```

## Step 3: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages like:
   - `[Scorecard] Using snapshot for round: ...` ✅ Good!
   - `[Scorecard] No snapshot found for round: ...` ❌ Need backfill

## Step 4: Check Network Tab

1. Open Network tab in DevTools
2. Filter by "supabase"
3. Reload Home feed
4. Count requests - should see:
   - `round_summaries` queries (1 per post with round)
   - `profiles` queries (batched)
   - NO `holes` table queries ✅

## Common Issues:

### Issue 1: Snapshots Don't Exist
**Solution**: Run backfill SQL (Step 2)

### Issue 2: Posts Don't Have roundId
**Check**: Look at post content - does it have `[ROUND_SCORECARD]...|roundId|...`?
**Solution**: Older posts might not have roundId - they'll use embedded data (slower but works)

### Issue 3: Component Not Being Used
**Check**: Are you seeing round scorecards on Home feed?
**Solution**: Make sure posts have `roundScorecardResult` parsed correctly

## Quick Test:

Run this to see what's happening:

```sql
-- Check recent rounds with holes
SELECT 
  r.id,
  r.course_name,
  COUNT(h.id) as hole_count,
  CASE WHEN r.scorecard_snapshot IS NULL THEN 'MISSING' ELSE 'EXISTS' END as snapshot
FROM rounds r
LEFT JOIN holes h ON h.round_id = r.id
WHERE h.id IS NOT NULL
GROUP BY r.id, r.course_name, r.scorecard_snapshot
ORDER BY r.created_at DESC
LIMIT 5;
```

If you see "MISSING" snapshots, run the backfill!
