# Supabase CLI Setup Guide

The Supabase CLI has been installed as a dev dependency. Follow these steps to complete the setup:

## 1. Login to Supabase

**⚠️ IMPORTANT: Run this in your terminal (not via the AI assistant)**

Run the login command to authenticate with your Supabase account:

```bash
npm run supabase:login
```

This will open your browser to authenticate. After logging in, the CLI will be configured.

**Alternative:** If you have a Supabase access token, you can set it as an environment variable:
```bash
export SUPABASE_ACCESS_TOKEN=your_token_here
```

## 2. Link to Your Project

Link this local project to your Supabase project:

```bash
npm run supabase:link
```

This connects your local project to the remote project (`rwvrzypgokxbznqjtinn`).

## 3. Apply Migrations

After linking, you can apply migrations directly:

```bash
npm run supabase:db:push
```

This will apply all pending migrations from the `supabase/migrations/` directory.

## Available NPM Scripts

- `npm run supabase:login` - Authenticate with Supabase
- `npm run supabase:link` - Link to your Supabase project
- `npm run supabase:db:push` - Apply all pending migrations
- `npm run supabase:db:diff` - Generate a migration from schema differences
- `npm run supabase:migration:new` - Create a new migration file
- `npm run supabase:status` - Check Supabase project status

## Apply the Notification Deduplication Migration

Once you've completed steps 1 and 2, run:

```bash
npm run supabase:db:push
```

This will apply the `20260121120000_notification_deduplication.sql` migration.

## Alternative: Manual Application

If you prefer to apply migrations manually via the Dashboard:
- The SQL Editor is accessible at: https://supabase.com/dashboard/project/rwvrzypgokxbznqjtinn/sql/new
- Copy the SQL from `supabase/migrations/20260121120000_notification_deduplication.sql`
