# Scorecard Snapshot Implementation Guide

## Overview
This implementation adds `scorecard_snapshot` to the `posts` table to eliminate hole table queries on the Home feed. Scorecards are generated ONCE when creating a post, not live.

## Migration Steps

### 1. Apply the Migration
Run the migration file in your Supabase Dashboard SQL Editor:
- File: `supabase/migrations/20260121000000_add_posts_scorecard_snapshot.sql`

This will:
- Add `scorecard_snapshot` JSONB column to `posts` table
- Add `round_id` column to `posts` table  
- Create GIN index for efficient queries
- Create `build_post_scorecard_snapshot()` function

### 2. Verify Migration
After applying, verify the function exists:
```sql
SELECT proname FROM pg_proc WHERE proname = 'build_post_scorecard_snapshot';
```

## How It Works

### Post Creation
When a user shares a scorecard post:
1. `RoundCompletionModal` calls `build_post_scorecard_snapshot()` RPC function
2. Function extracts finished hole scores from the round
3. Snapshot is stored in `posts.scorecard_snapshot`
4. Post is created with both `content` (for backwards compatibility) and `scorecard_snapshot`

### Home Feed Rendering
When displaying posts:
1. `FeedPost` checks if `post.scorecard_snapshot` exists
2. **If snapshot exists**: Renders scorecard grid directly from snapshot (NO hole queries)
3. **If no snapshot**: Shows `RoundCard` component (simple card, no scorecard grid)

## Error Handling

The code gracefully handles:
- Migration not applied yet (404 on RPC, 400 on insert)
- Missing snapshot (shows round card instead)
- Function errors (logs warning, continues without snapshot)

## Performance

**Before**: 700+ requests (querying holes for each scorecard)
**After**: <30 requests (snapshot data included in posts query)

## Testing

1. **Create a new scorecard post** - should generate snapshot automatically
2. **Check Home feed** - should render scorecard from snapshot
3. **Check old posts** - should show round card (no snapshot)

## Troubleshooting

### 404 Errors on `build_post_scorecard_snapshot`
- **Cause**: Migration not applied
- **Fix**: Apply migration in Supabase Dashboard

### 400 Errors on posts insert
- **Cause**: Columns don't exist yet
- **Fix**: Code handles this gracefully - post will be created without snapshot

### Still seeing high request count
- **Check**: Are other scorecard types (scramble, skins, etc.) still querying holes?
- **Note**: This implementation focuses on round scorecards first
