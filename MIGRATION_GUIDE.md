# Migration Guide: Scorecard Snapshot Feature

## Step 1: Apply the Migration

You have two options:

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/rwvrzypgokxbznqjtinn
2. Navigate to **SQL Editor** in the left sidebar
3. Copy the entire contents of `supabase/migrations/20260120000000_add_scorecard_snapshot.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the migration

### Option B: Via Supabase CLI

If you prefer using CLI:

```bash
# Login to Supabase
npx supabase login

# Link to your project (if not already linked)
npx supabase link --project-ref rwvrzypgokxbznqjtinn

# Push the migration
npx supabase db push
```

## Step 2: Backfill Existing Rounds (Optional but Recommended)

After the migration runs, you'll want to generate snapshots for existing rounds. Run this SQL in the Supabase SQL Editor:

```sql
-- Backfill snapshots for all existing rounds that have holes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT round_id FROM holes LOOP
    PERFORM public.rebuild_round_scorecard_snapshot(r.round_id);
  END LOOP;
END $$;
```

This will generate snapshots for all rounds that already have hole data.

## Step 3: Verify Everything Works

1. **Check the migration applied:**
   ```sql
   -- Run in SQL Editor
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'rounds' AND column_name = 'scorecard_snapshot';
   ```
   Should return: `scorecard_snapshot | jsonb`

2. **Check triggers exist:**
   ```sql
   -- Run in SQL Editor
   SELECT trigger_name, event_manipulation, event_object_table
   FROM information_schema.triggers
   WHERE trigger_name LIKE '%rebuild_snapshot%';
   ```
   Should return 3 triggers (insert, update, delete)

3. **Test the snapshot function:**
   ```sql
   -- Run in SQL Editor (replace with a real round_id)
   SELECT public.rebuild_round_scorecard_snapshot('your-round-id-here');
   
   -- Check if snapshot was created
   SELECT scorecard_snapshot 
   FROM rounds 
   WHERE id = 'your-round-id-here';
   ```

4. **Test in your app:**
   - Start your dev server: `npm run dev`
   - Navigate to the Home feed
   - Check that scorecards display without errors
   - Verify the network tab shows fewer Supabase requests

## What Changed

- ✅ Added `scorecard_snapshot` JSONB column to `rounds` table
- ✅ Created function to rebuild snapshots automatically
- ✅ Added triggers to maintain snapshots when holes change
- ✅ Updated `round_summaries` view to include snapshot
- ✅ Refactored Home feed to use snapshots instead of fetching holes

## Troubleshooting

If you encounter issues:

1. **Migration fails:** Check the SQL Editor error message and ensure you have proper permissions
2. **Snapshots not generating:** Verify triggers are created and check function permissions
3. **App shows errors:** Check browser console and ensure the migration completed successfully

## Next Steps

After migration:
- New rounds will automatically get snapshots via triggers
- Existing rounds will need backfill (Step 2)
- The Home feed will now use snapshots, reducing database load significantly
