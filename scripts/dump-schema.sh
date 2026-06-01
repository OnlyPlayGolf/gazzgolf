#!/usr/bin/env bash
# Capture the LIVE prod 'public' schema as a timestamped snapshot, for DRIFT
# checking against the repo's migrations. Read-only against prod.
#
# This is the [x] "prod schema snapshot for drift checking" item in
# Gazz-iOS/TESTING.md Phase 0. It is distinct from squash-baseline.sh:
#   - squash-baseline.sh  : ONE-TIME. Writes a baseline migration + archives the
#                           old migrations. Changes the repo.
#   - dump-schema.sh       : REPEATABLE. Writes a throwaway snapshot under
#                           schema-snapshots/ that you diff against the baseline
#                           to find drift. Never changes migrations.
#
# WHAT IT DOES
#   1. Verifies CLI + project link + (implicitly) credentials.
#   2. Dumps prod public schema to schema-snapshots/<UTC-timestamp>_prod_public.sql.
#   3. If a squashed baseline exists, prints a unified diff (baseline vs prod) so
#      you can see exactly what prod has that the repo doesn't (and vice versa).
#
# SAFETY
#   - READ-ONLY against prod (supabase db dump). Never writes prod, never edits
#     migrations, never commits. Output goes to schema-snapshots/ which is
#     gitignored by convention (add it if missing).
#
# CREDENTIALS (same as squash-baseline.sh)
#   - Access token: run `supabase login` (or set SUPABASE_ACCESS_TOKEN).
#   - DB password: the CLI prompts interactively. Do NOT pass it on the command
#     line (it would leak into shell history / process list). Type it at the prompt.
#
# USAGE
#   supabase login                 # once, if not already
#   ./scripts/dump-schema.sh       # writes a snapshot, prints drift vs baseline
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SNAP_DIR="schema-snapshots"
# Timestamp is supplied by `date`; this script is run interactively, so that's fine.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAP="${SNAP_DIR}/${STAMP}_prod_public.sql"

command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI not found. Run scripts/new-mac-bootstrap.sh first." >&2; exit 1; }

# Confirm the project is linked so --linked resolves to the right prod DB.
if [ ! -f supabase/.temp/project-ref ]; then
  echo "Project not linked. Run: supabase link --project-ref rwvrzypgokxbznqjtinn" >&2
  exit 1
fi

mkdir -p "$SNAP_DIR"

echo "Dumping prod public schema -> ${SNAP}"
echo "(If prompted, type the prod DB password — it will not echo.)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if ! supabase db dump --linked --schema public > "$TMP"; then
  echo "Dump failed. Did you run 'supabase login'? (needs an access token + DB password)" >&2
  exit 1
fi

# Sanity-check before keeping the file.
grep -q "CREATE TABLE" "$TMP" || {
  echo "Dump produced no CREATE TABLE statements; not saving. Check the prod link." >&2
  exit 1; }

mv "$TMP" "$SNAP"
trap - EXIT
echo "Saved snapshot: ${SNAP}  ($(grep -c 'CREATE TABLE' "$SNAP") tables)"

# Drift report against the squashed baseline, if one exists.
BASELINE="$(ls supabase/migrations/*_baseline_schema.sql 2>/dev/null | head -1 || true)"
echo
if [ -n "$BASELINE" ]; then
  echo "Drift vs baseline ($(basename "$BASELINE")):"
  if diff -u "$BASELINE" "$SNAP" >/dev/null 2>&1; then
    echo "  ✅ no differences — repo baseline matches prod public schema."
  else
    echo "  ⚠️ differences found (────  baseline  |  ++++  prod):"
    diff -u "$BASELINE" "$SNAP" | sed 's/^/    /' | head -120
    echo "  (truncated to 120 lines; full snapshot at ${SNAP})"
    echo "  Reconcile by adding a migration for anything prod has that the repo lacks."
  fi
else
  echo "No squashed baseline yet (run ./scripts/squash-baseline.sh)."
  echo "Snapshot saved for manual inspection: ${SNAP}"
fi
