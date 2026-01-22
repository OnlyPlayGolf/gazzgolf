#!/usr/bin/env node

/**
 * Script to apply Supabase migration directly via REST API
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rwvrzypgokxbznqjtinn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('');
  console.error('To apply the migration:');
  console.error('  1. Get your service role key from Supabase Dashboard > Settings > API');
  console.error('  2. Run: SUPABASE_SERVICE_ROLE_KEY=your_key node apply-migration-direct.mjs');
  console.error('');
  console.error('Alternatively, use the Supabase Dashboard SQL Editor (already opened)');
  process.exit(1);
}

const migrationFile = join(__dirname, 'supabase/migrations/20260121120000_notification_deduplication.sql');
const sql = readFileSync(migrationFile, 'utf-8');

console.log('🚀 Applying migration via Supabase REST API...');
console.log('');

try {
  // Execute SQL via Supabase REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // Try alternative: direct SQL execution endpoint
    const altResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: sql,
    });

    if (!altResponse.ok) {
      const errorText = await altResponse.text();
      throw new Error(`Failed to execute SQL: ${altResponse.status} ${altResponse.statusText}\n${errorText}`);
    }
  }

  console.log('✅ Migration applied successfully!');
  console.log('');
  console.log('Changes applied:');
  console.log('  ✓ Added group_id column to notifications table');
  console.log('  ✓ Created unique index for deduplication');
  console.log('  ✓ Updated notify_drill_leaderboard() function');
  console.log('  ✓ Cleaned up existing duplicate notifications');
} catch (error) {
  console.error('❌ Error applying migration:', error.message);
  console.error('');
  console.error('Please apply the migration manually via the Supabase Dashboard SQL Editor');
  console.error('The SQL is displayed above and the dashboard should be open.');
  process.exit(1);
}
