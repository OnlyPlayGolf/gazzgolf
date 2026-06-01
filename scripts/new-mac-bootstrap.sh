#!/usr/bin/env bash
# ONE-TIME setup for a fresh Mac to run the backend test stack locally.
# Installs: Homebrew (if missing), Supabase CLI, Docker Desktop, deno, gh.
# Authenticates gh + supabase, clones both repos to ~/code, and points the
# iOS CLAUDE.md canonical path at the new checkout.
#
# Locked decisions (see Gazz-iOS/TESTING.md "Hardware reality"):
#   - Docker Desktop (not OrbStack/Colima)
#   - idb is a Phase 3 concern and is intentionally skipped here
#   - Interactive auth happens in-script: `gh auth login`, `supabase login`
#   - Repo layout: ~/code/Loopd-ios (iOS app) and ~/code/gazzgolf (backend)
#   - Hard-stop unless --force when RAM < 16 GB or free disk < 50 GB
#
# Usage:
#   ./scripts/new-mac-bootstrap.sh           # normal run
#   ./scripts/new-mac-bootstrap.sh --force   # bypass the RAM/disk hard-stops
#
# Idempotent: re-running skips tools that are already installed, skips auth
# that is already valid, and skips clones that already exist. Safe to run twice.
set -euo pipefail

# ----------------------------------------------------------------------------
# Config (locked decisions)
# ----------------------------------------------------------------------------
CODE_DIR="${HOME}/code"
IOS_DIR="${CODE_DIR}/Loopd-ios"
GAZZ_DIR="${CODE_DIR}/gazzgolf"
IOS_REMOTE="https://github.com/OnlyPlayGolf/Gazz-iOS.git"
GAZZ_REMOTE="https://github.com/OnlyPlayGolf/gazzgolf.git"
PROJECT_REF="rwvrzypgokxbznqjtinn"
OLD_IOS_DIR="${HOME}/Documents/Loopd-ios"   # stale checkout to detect & offer to move
MIN_RAM_GB=16
MIN_DISK_GB=50

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

note()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m!  %s\033[0m\n' "$*" >&2; }
die()   { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
ask()   { # ask "question" -> returns 0 for yes, 1 for no (default no)
  local a; read -r -p "$1 [y/N] " a; case "$a" in y|Y) return 0;; *) return 1;; esac
}

# ----------------------------------------------------------------------------
# 0. Preflight: chip, macOS, RAM, disk  (hard-stop unless --force)
# ----------------------------------------------------------------------------
note "Preflight checks"
ARCH="$(uname -m)"
echo "  chip:   ${ARCH}"
echo "  macOS:  $(sw_vers -productVersion 2>/dev/null || echo 'unknown')"

# Physical RAM (bytes -> GB).
RAM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
RAM_GB=$(( RAM_BYTES / 1024 / 1024 / 1024 ))
echo "  RAM:    ${RAM_GB} GB (need >= ${MIN_RAM_GB})"

# Free space on the volume backing $HOME, in GB (portable: avoid -BG).
DISK_FREE_KB="$(df -Pk "$HOME" | awk 'NR==2 {print $4}')"
DISK_FREE_GB=$(( DISK_FREE_KB / 1024 / 1024 ))
echo "  disk:   ${DISK_FREE_GB} GB free on \$HOME volume (need >= ${MIN_DISK_GB})"

HARDSTOP=0
[ "$RAM_GB"  -lt "$MIN_RAM_GB"  ] && { warn "RAM below ${MIN_RAM_GB} GB — Docker + Supabase stack will struggle."; HARDSTOP=1; }
[ "$DISK_FREE_GB" -lt "$MIN_DISK_GB" ] && { warn "Free disk below ${MIN_DISK_GB} GB — Docker images alone are multi-GB."; HARDSTOP=1; }
if [ "$HARDSTOP" -eq 1 ]; then
  if [ "$FORCE" -eq 1 ]; then
    warn "Hardware below spec, but --force given. Continuing anyway."
  else
    die "Hardware below the TESTING.md floor (>= ${MIN_RAM_GB} GB RAM, >= ${MIN_DISK_GB} GB free). Re-run with --force to override."
  fi
fi

# ----------------------------------------------------------------------------
# 1. Homebrew (handles both Apple Silicon and Intel paths)
# ----------------------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  note "Installing Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Make brew available in THIS shell, whichever prefix it installed to.
  if [ -x /opt/homebrew/bin/brew ]; then        # Apple Silicon
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then         # Intel
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  note "Homebrew already installed ($(brew --version | head -1))"
fi

# ----------------------------------------------------------------------------
# 2. CLI tools (idempotent — brew install is a no-op if already present)
# ----------------------------------------------------------------------------
note "Installing CLI tools: supabase, deno, gh, git"
brew install supabase/tap/supabase deno gh git

note "Installing Docker Desktop (cask)"
if [ -d "/Applications/Docker.app" ]; then
  echo "  Docker.app already present — skipping cask install."
else
  brew install --cask docker || warn "Docker cask install skipped/failed. Install Docker Desktop manually if needed."
fi

# ----------------------------------------------------------------------------
# 3. Authenticate gh + supabase (interactive, in-script per locked decision)
# ----------------------------------------------------------------------------
note "GitHub auth"
if gh auth status >/dev/null 2>&1; then
  echo "  gh already authenticated — skipping."
else
  echo "  Launching 'gh auth login' (choose HTTPS; this also configures git)."
  gh auth login
fi
# Wire gh's token into git so HTTPS clone/fetch/push work non-interactively.
gh auth setup-git 2>/dev/null || warn "gh auth setup-git failed; git over HTTPS may still prompt."

note "Supabase auth"
if supabase projects list >/dev/null 2>&1; then
  echo "  supabase already logged in — skipping."
else
  echo "  Launching 'supabase login' (opens a browser for an access token)."
  supabase login
fi

# ----------------------------------------------------------------------------
# 4. Clone both repos into ~/code  (idempotent)
# ----------------------------------------------------------------------------
note "Cloning repos into ${CODE_DIR}"
mkdir -p "$CODE_DIR"

clone_if_missing() { # clone_if_missing <dir> <remote>
  local dir="$1" remote="$2"
  if [ -d "${dir}/.git" ]; then
    echo "  $(basename "$dir") already cloned at ${dir} — skipping."
  else
    echo "  Cloning $(basename "$dir") -> ${dir}"
    git clone "$remote" "$dir"
  fi
}
clone_if_missing "$IOS_DIR"  "$IOS_REMOTE"
clone_if_missing "$GAZZ_DIR" "$GAZZ_REMOTE"

# Link the backend project so squash-baseline.sh / setup-local.sh can reach prod.
if [ -d "${GAZZ_DIR}/supabase" ]; then
  note "Linking Supabase project (${PROJECT_REF})"
  ( cd "$GAZZ_DIR" && supabase link --project-ref "$PROJECT_REF" ) \
    || warn "supabase link failed (re-run inside ${GAZZ_DIR} after Docker is up)."
fi

# ----------------------------------------------------------------------------
# 5. Detect a stale ~/Documents/Loopd-ios checkout and OFFER to move it
#    (offer only — never auto-move, per locked decision)
# ----------------------------------------------------------------------------
if [ -d "$OLD_IOS_DIR" ] && [ "$OLD_IOS_DIR" != "$IOS_DIR" ]; then
  note "Found an existing iOS checkout at ${OLD_IOS_DIR}"
  echo "  The new canonical location is ${IOS_DIR}."
  if [ -d "${IOS_DIR}/.git" ]; then
    echo "  (A fresh clone already exists at ${IOS_DIR}.)"
    if ask "  Move the OLD checkout to ${OLD_IOS_DIR}.bak so it isn't confused for canonical?"; then
      mv "$OLD_IOS_DIR" "${OLD_IOS_DIR}.bak"
      echo "  Moved -> ${OLD_IOS_DIR}.bak (delete it yourself once you're sure)."
    else
      echo "  Left ${OLD_IOS_DIR} in place. (It may contain unpushed work — check before deleting.)"
    fi
  else
    if ask "  Move it to the canonical path ${IOS_DIR} instead of cloning fresh?"; then
      mv "$OLD_IOS_DIR" "$IOS_DIR"
      echo "  Moved ${OLD_IOS_DIR} -> ${IOS_DIR}."
    else
      echo "  Left ${OLD_IOS_DIR} in place."
    fi
  fi
fi

# ----------------------------------------------------------------------------
# 6. Update the iOS CLAUDE.md canonical-path line (offer; show a diff)
#    Old line points at ~/Desktop/MyApp-TestClone. Repoint to ~/code/Loopd-ios.
# ----------------------------------------------------------------------------
CLAUDE_MD="${IOS_DIR}/CLAUDE.md"
if [ -f "$CLAUDE_MD" ] && grep -q "MyApp-TestClone" "$CLAUDE_MD"; then
  note "iOS CLAUDE.md still points at the old canonical path"
  echo "  File: ${CLAUDE_MD}"
  grep -n "MyApp-TestClone" "$CLAUDE_MD" | sed 's/^/    /'
  if ask "  Rewrite those references to ${IOS_DIR}?"; then
    # Portable in-place edit (BSD + GNU sed) via temp file.
    sed "s#/Users/[^/]*/Desktop/MyApp-TestClone#${IOS_DIR}#g; s#~/Desktop/MyApp-TestClone#${IOS_DIR}#g" \
      "$CLAUDE_MD" > "${CLAUDE_MD}.tmp" && mv "${CLAUDE_MD}.tmp" "$CLAUDE_MD"
    echo "  Updated. Review with: git -C ${IOS_DIR} diff CLAUDE.md"
  else
    echo "  Left CLAUDE.md unchanged. Manual edit needed:"
    echo "    change the 'Default Codebase' path to ${IOS_DIR}"
  fi
else
  [ -f "$CLAUDE_MD" ] && echo "  (CLAUDE.md has no MyApp-TestClone reference — nothing to update.)"
fi

# ----------------------------------------------------------------------------
# 7. Report installed versions
# ----------------------------------------------------------------------------
note "Installed versions"
for c in brew git supabase docker deno gh; do
  if command -v "$c" >/dev/null 2>&1; then
    printf '  %-10s %s\n' "$c" "$("$c" --version 2>&1 | head -1)"
  else
    printf '  %-10s NOT INSTALLED\n' "$c"
  fi
done

# ----------------------------------------------------------------------------
# 8. Next steps (the parts that need Docker actually running)
# ----------------------------------------------------------------------------
note "Next steps"
cat <<EOF
  1. Open Docker Desktop once (first launch provisions its VM), then wait
     until 'docker info' succeeds.
  2. cd ${GAZZ_DIR}
  3. ./scripts/squash-baseline.sh   # one-time: capture prod schema as a replayable baseline
  4. ./scripts/setup-local.sh       # boot local stack + reset (+ seed)   [NOTE: not yet in repo]
  5. supabase test db               # run pgTAP

  idb (multi-sim) is intentionally NOT installed — it's a Phase 3 concern.
EOF
