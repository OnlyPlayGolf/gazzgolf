#!/usr/bin/env bash
# ONE-COMMAND local backend bring-up: boot the local Supabase stack, rebuild the
# database from migrations, apply the seed, and (optionally) run the pgTAP suite.
#
# This is the everyday "get me a working local DB" script. It is the step the
# new-mac-bootstrap.sh next-steps list points at (step 4), and the [x] item in
# Gazz-iOS/TESTING.md Phase 0 ("one-command local Supabase boot + reset + seed").
#
# WHAT IT DOES
#   1. Verifies the Supabase CLI is installed and Docker is running.
#   2. Starts the local stack if it isn't already up (idempotent).
#   3. Runs `supabase db reset` — drops the local DB and replays:
#        migrations (the squashed baseline + anything after it) + supabase/seed.sql
#   4. Optionally runs `supabase test db` (the pgTAP suite) with --test/-t.
#   5. Prints the local API/DB/Studio URLs.
#
# SAFETY
#   - LOCAL ONLY. Every command targets the Docker stack on localhost. Nothing
#     here reads or writes production. (Prod work lives in squash-baseline.sh /
#     dump-schema.sh, which require an access token + DB password.)
#   - `supabase db reset` DOES wipe the LOCAL database every run — that's the
#     point (deterministic rebuild). It cannot touch prod.
#
# PREREQUISITE (the unblocker)
#   The migrations must be self-contained, i.e. squash-baseline.sh has been run.
#   Until then `supabase db reset` fails inside the first migration with
#   'relation "public.group_members" does not exist'. This script detects that
#   specific failure and points you at the squash, rather than dumping a wall of
#   SQL errors.
#
# USAGE
#   ./scripts/setup-local.sh         # boot + reset + seed
#   ./scripts/setup-local.sh --test  # boot + reset + seed, then run pgTAP
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

RUN_TESTS=0
case "${1:-}" in
  --test|-t) RUN_TESTS=1 ;;
  "") ;;
  *) echo "Unknown argument: $1 (use --test to also run pgTAP)" >&2; exit 1 ;;
esac

command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI not found. Run scripts/new-mac-bootstrap.sh first." >&2; exit 1; }
docker info >/dev/null 2>&1 || {
  echo "Docker is not running. Start Docker Desktop and retry." >&2; exit 1; }

# Guard: a fresh checkout whose migrations were never squashed cannot reset.
# Detect the known marker (no baseline file + the recursion-prone first migration).
if ! ls supabase/migrations/*_baseline_schema.sql >/dev/null 2>&1; then
  echo "WARNING: no squashed baseline found in supabase/migrations/." >&2
  echo "  The raw migrations are NOT self-contained; 'supabase db reset' will fail" >&2
  echo "  on the first migration. Run ./scripts/squash-baseline.sh first." >&2
  echo "  Continuing anyway in case you know better..." >&2
  echo >&2
fi

# 1 & 2. Start the stack if it isn't already running.
if supabase status >/dev/null 2>&1; then
  echo "Local stack already running."
else
  echo "Starting local Supabase stack (first run pulls images; may take a few minutes) ..."
  supabase start
fi

# 3. Rebuild the database from migrations + seed.
echo
echo "Resetting local database (migrations + seed.sql) ..."
if ! supabase db reset; then
  echo >&2
  echo "supabase db reset FAILED." >&2
  echo "  If the error mentions a relation that 'does not exist' (e.g. group_members)," >&2
  echo "  the migrations are not self-contained — run ./scripts/squash-baseline.sh," >&2
  echo "  then re-run this script." >&2
  exit 1
fi

# 4. Optional pgTAP run.
if [ "$RUN_TESTS" -eq 1 ]; then
  echo
  echo "Running pgTAP suite (supabase test db) ..."
  supabase test db
fi

# 5. Report.
echo
echo "================ local backend ready ================"
supabase status 2>/dev/null | grep -E "API URL|DB URL|Studio URL|anon key" || true
echo "====================================================="
echo "Next: ./scripts/setup-local.sh --test   (run the pgTAP suite)"
