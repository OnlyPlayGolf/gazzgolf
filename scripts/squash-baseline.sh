#!/usr/bin/env bash
# ONE-TIME squash: capture the live prod schema as a single replayable baseline.
#
# WHY THIS EXISTS
#   The ~304 files in supabase/migrations/ are NOT self-contained. The earliest
#   migration (20250930200532) already ALTERs / adds policies to tables that NO
#   migration ever CREATEs: profiles, friendships, round_status, groups,
#   group_members, banker_*, nine_points_*, and more. Lovable applied the
#   original schema directly to the hosted DB and never captured it as a
#   migration, so the history starts mid-stream. Consequence: a fresh
#   `supabase db reset` errors inside the first migration, which means backend
#   CI can never go green and no local/CI database can be built from the repo.
#
#   This script captures prod's CURRENT public schema as one baseline migration,
#   timestamped before everything else, and moves the existing migrations aside
#   (kept for history, never replayed). After it runs, `supabase db reset`
#   rebuilds the whole DB from the single baseline + any migrations added later.
#
# SAFETY
#   - Does NOT touch prod. It only reads prod's schema and writes LOCAL files.
#   - Refuses to run twice (won't clobber an existing baseline/archive).
#   - Asks for confirmation before moving anything.
#
# REQUIREMENTS (run scripts/new-mac-bootstrap.sh first if missing)
#   - Supabase CLI + Docker running
#   - Project linked:  supabase login && supabase link --project-ref rwvrzypgokxbznqjtinn
#
# AFTER IT RUNS
#   supabase db reset      # MUST replay cleanly from the single baseline
#   supabase test db       # run pgTAP once tests exist in supabase/tests/
#   git add -A             # review the diff, then commit
#
# CAUTION (future prod pushes): prod's migration-history table still lists the
#   archived migrations as applied. Before the next `supabase db push`, you may
#   need `supabase migration repair` so the CLI reconciles local vs remote
#   history. That is a prod-affecting step; do it deliberately, not here.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

MIG_DIR="supabase/migrations"
ARCHIVE_DIR="supabase/migrations_archive"
BASELINE_TS="20250929000000"   # one day before the earliest real migration (20250930200532)
BASELINE="${MIG_DIR}/${BASELINE_TS}_baseline_schema.sql"

command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI not found. Run scripts/new-mac-bootstrap.sh first." >&2; exit 1; }
docker info >/dev/null 2>&1 || {
  echo "Docker is not running. Start Docker Desktop and retry." >&2; exit 1; }

# Don't double-squash.
if [ -f "$BASELINE" ]; then
  echo "Baseline already exists: $BASELINE" >&2
  echo "Refusing to overwrite. Delete it and restore $ARCHIVE_DIR/ first if you must redo this." >&2
  exit 1
fi
if [ -d "$ARCHIVE_DIR" ] && [ -n "$(ls -A "$ARCHIVE_DIR" 2>/dev/null)" ]; then
  echo "$ARCHIVE_DIR already populated — a squash appears to have run already. Aborting." >&2
  exit 1
fi

MIG_COUNT="$(ls "$MIG_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')"
echo "This will:"
echo "  1. Dump the LIVE prod 'public' schema  ->  $BASELINE"
echo "  2. Move the existing $MIG_COUNT migrations  ->  $ARCHIVE_DIR/  (kept for history)"
echo "  3. Leave you to verify with 'supabase db reset', then commit."
echo
read -r -p "Proceed? [y/N] " ans
case "$ans" in
  y|Y) ;;
  *) echo "Aborted."; exit 0 ;;
esac

# Dump to a temp file first so a failed/partial dump never lands inside
# migrations/ where a later reset would try to apply it.
echo "Dumping prod schema (public) ..."
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
supabase db dump --linked --schema public > "$TMP"

# Sanity: a real schema dump is large and defines our core tables.
grep -q "CREATE TABLE" "$TMP" || {
  echo "Dump produced no CREATE TABLE statements. Prod link may be wrong; aborting." >&2
  exit 1; }
grep -q "round_status" "$TMP" || {
  echo "Dump is missing round_status (a core table). Aborting before any files move." >&2
  exit 1; }

# Move the existing migrations aside BEFORE writing the baseline, so the baseline
# ends up as the only file the CLI will replay.
mkdir -p "$ARCHIVE_DIR"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git mv "$MIG_DIR"/*.sql "$ARCHIVE_DIR"/ 2>/dev/null || mv "$MIG_DIR"/*.sql "$ARCHIVE_DIR"/
else
  mv "$MIG_DIR"/*.sql "$ARCHIVE_DIR"/
fi

# Write the baseline, ensuring extensions the migrations rely on are present.
# (A --schema public dump may omit CREATE EXTENSION lines; the local stack
# normally has these, but make it explicit so reset is deterministic.)
{
  echo "-- Squashed baseline schema, captured from prod (public) by scripts/squash-baseline.sh."
  echo "-- Pre-existing migrations were archived to ${ARCHIVE_DIR}/ (history only, not replayed)."
  echo "CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;"
  echo
  cat "$TMP"
} > "$BASELINE"

ARCH_COUNT="$(ls "$ARCHIVE_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')"
echo
echo "Wrote baseline:  $BASELINE"
echo "Archived $ARCH_COUNT migrations into $ARCHIVE_DIR/ (history only; not replayed)."
echo
echo "Now verify, then commit:"
echo "  supabase db reset        # must replay cleanly from the single baseline"
echo "  supabase test db         # if pgTAP tests exist in supabase/tests/"
echo "  git add -A               # review the diff first"
