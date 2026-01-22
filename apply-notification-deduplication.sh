#!/bin/bash

# Script to apply Notification Deduplication Migration
# This will open your browser to apply the migration via Supabase Dashboard

echo "🚀 Applying Notification Deduplication Migration"
echo ""
echo "Step 1: Opening Supabase Dashboard..."
echo "Step 2: Copy the migration SQL below"
echo "Step 3: Paste it into SQL Editor and Run"
echo ""
echo "--- COPY FROM HERE ---"
cat supabase/migrations/20260121120000_notification_deduplication.sql
echo ""
echo "--- COPY TO HERE ---"
echo ""
echo "📋 Migration file: supabase/migrations/20260121120000_notification_deduplication.sql"
echo ""
echo "This migration will:"
echo "  ✓ Add group_id column to notifications table"
echo "  ✓ Create unique index to prevent duplicate notifications"
echo "  ✓ Update notify_drill_leaderboard() function with deduplication logic"
echo "  ✓ Clean up existing duplicate notifications"
echo ""
echo "Opening Supabase Dashboard..."
open "https://supabase.com/dashboard/project/rwvrzypgokxbznqjtinn/sql/new"
