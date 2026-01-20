#!/bin/bash

# Script to apply Supabase migration
# This will open your browser to apply the migration via Supabase Dashboard

echo "🚀 Applying Scorecard Snapshot Migration"
echo ""
echo "Step 1: Opening Supabase Dashboard..."
echo "Step 2: Copy the migration SQL below"
echo "Step 3: Paste it into SQL Editor and Run"
echo ""
echo "--- COPY FROM HERE ---"
cat supabase/migrations/20260120000000_add_scorecard_snapshot.sql
echo ""
echo "--- COPY TO HERE ---"
echo ""
echo "📋 Migration file: supabase/migrations/20260120000000_add_scorecard_snapshot.sql"
echo ""
echo "After applying, run the backfill script (optional):"
echo "File: supabase/migrations/20260120000001_backfill_scorecard_snapshots.sql"
echo ""
echo "Opening Supabase Dashboard..."
open "https://supabase.com/dashboard/project/rwvrzypgokxbznqjtinn/sql/new"
