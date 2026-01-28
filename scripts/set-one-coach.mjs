#!/usr/bin/env node
/**
 * Set profiles.role = 'coach' for one user.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local or env.
 *
 * Run:
 *   node --env-file=.env.local scripts/set-one-coach.mjs
 *   node --env-file=.env.local scripts/set-one-coach.mjs your@email.com
 *
 * With no arg: updates the first profile (by id).
 * With email: updates the profile with that email.
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = process.env;
const defaultUrl = 'https://rwvrzypgokxbznqjtinn.supabase.co';
function useDefault(v) {
  return !v || v.length < 20 || v.includes('...') || !v.startsWith('http');
}
const url =
  useDefault(env.SUPABASE_URL) && useDefault(env.NEXT_PUBLIC_SUPABASE_URL) && useDefault(env.VITE_SUPABASE_URL)
    ? defaultUrl
    : (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || defaultUrl);
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (useDefault(key)) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing or placeholder. Use: node --env-file=.env.local scripts/set-one-coach.mjs [email]');
  process.exit(1);
}

const base = url.replace(/\/$/, '');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const emailArg = process.argv[2]?.trim();

let listUrl = `${base}/rest/v1/profiles?select=id,display_name,email&order=id.asc&limit=1`;
if (emailArg) {
  listUrl = `${base}/rest/v1/profiles?select=id,display_name,email&email=eq.${encodeURIComponent(emailArg)}`;
}

const list = await fetch(listUrl, { headers });
if (!list.ok) {
  console.error('Failed to list profiles:', list.status, await list.text());
  process.exit(1);
}
const rows = await list.json();
if (!rows.length) {
  if (emailArg) {
    console.error('No profile found with email:', emailArg);
  } else {
    console.error('No profiles found.');
  }
  process.exit(1);
}
const { id } = rows[0];
console.log('Updating profile', id, rows[0].display_name || rows[0].email || '');

const patch = await fetch(`${base}/rest/v1/profiles?id=eq.${id}`, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'coach' }),
});
if (!patch.ok) {
  console.error('Failed to update role:', patch.status, await patch.text());
  process.exit(1);
}
console.log('Set profiles.role = "coach" for profile', id);
