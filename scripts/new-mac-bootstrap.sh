#!/usr/bin/env bash
# ONE-TIME setup for a fresh Mac to run the backend test stack locally.
# Installs: Homebrew (if missing), Supabase CLI, Docker Desktop, deno, gh.
#
# After this finishes, the rest of the bring-up is:
#   1. Open Docker Desktop once (first launch provisions its VM).
#   2. supabase login
#   3. supabase link --project-ref rwvrzypgokxbznqjtinn
#   4. ./scripts/squash-baseline.sh     # one-time: capture prod schema as a replayable baseline
#   5. ./scripts/setup-local.sh         # boot local stack + reset (+ seed once seed.sql exists)
#   6. supabase test db                 # run pgTAP
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Make brew available in this shell (Apple Silicon path).
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi

echo "Installing Supabase CLI, deno, gh..."
brew install supabase/tap/supabase deno gh

echo "Installing Docker Desktop..."
brew install --cask docker || echo "Docker cask install skipped/failed. Install Docker Desktop manually if needed."

echo
echo "Installed versions:"
for c in supabase docker deno gh; do
  if command -v "$c" >/dev/null 2>&1; then
    printf '  %-10s %s\n' "$c" "$("$c" --version 2>&1 | head -1)"
  else
    printf '  %-10s NOT INSTALLED\n' "$c"
  fi
done

echo
echo "Next steps:"
echo "  1. Open Docker Desktop (first launch sets up the VM)."
echo "  2. supabase login"
echo "  3. supabase link --project-ref rwvrzypgokxbznqjtinn"
echo "  4. ./scripts/squash-baseline.sh"
echo "  5. ./scripts/setup-local.sh"
echo "  6. supabase test db"
