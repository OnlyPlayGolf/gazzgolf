#!/usr/bin/env node
/**
 * Push Coach AI env vars from .env.local to Vercel (production + preview).
 * Run: node scripts/push-vercel-env.mjs
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv(path) {
  const raw = readFileSync(path, 'utf-8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const envPath = join(root, '.env.local');
let env;
try {
  env = loadEnv(envPath);
} catch (e) {
  console.error('Missing .env.local. Create it with OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  process.exit(1);
}

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const keys = [
  { vercel: 'OPENAI_API_KEY', local: 'OPENAI_API_KEY' },
  { vercel: 'SUPABASE_URL', local: null },
  { vercel: 'SUPABASE_SERVICE_ROLE_KEY', local: 'SUPABASE_SERVICE_ROLE_KEY' },
];

const vals = {};
vals.OPENAI_API_KEY = env.OPENAI_API_KEY;
vals.SUPABASE_URL = SUPABASE_URL || 'https://rwvrzypgokxbznqjtinn.supabase.co';
vals.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

function isPlaceholder(v) {
  const s = String(v).trim();
  return !s || s.length < 10 || s === '...' || /^\.\.\.$|^your-|^sk-$/.test(s);
}
for (const k of Object.keys(vals)) {
  if (isPlaceholder(vals[k])) {
    console.error(`Missing or placeholder value for ${k} in .env.local. Use real values before pushing.`);
    process.exit(1);
  }
}

for (const envName of ['production', 'preview']) {
  for (const { vercel } of keys) {
    const v = vals[vercel];
    const r = spawnSync('npx', ['vercel', 'env', 'add', vercel, envName, '--force'], {
      input: v,
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: root,
      encoding: 'utf-8',
    });
    if (r.status !== 0) {
      console.error(`Failed to add ${vercel} to ${envName}.`);
      process.exit(1);
    }
  }
}

console.log('Added OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY to production and preview.');
