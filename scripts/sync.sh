#!/usr/bin/env bash
# SyncedIn — one-command deploy.
# Vercel is connected to github.com/theguysaccount/syncedin and auto-builds
# from `main` on every push. So syncing = deploying.
#
# Usage:
#   bash scripts/sync.sh                     # auto-message
#   bash scripts/sync.sh "your message here" # custom message
#
# This script:
#   1. Initializes git if needed (first run only).
#   2. Stages everything (.gitignore already excludes secrets).
#   3. Commits + pushes to GitHub using GITHUB_TOKEN from .env.local.
#   4. Vercel sees the push and ships to production in ~60s.
set -u
cd "$(dirname "$0")/.."

# Load token + repo from .env.local
if [ ! -f .env.local ]; then
  echo "✗ .env.local missing — can't find GITHUB_TOKEN."
  exit 1
fi
TOKEN=$(grep -E "^GITHUB_TOKEN=" .env.local | head -n1 | cut -d'=' -f2-)
REPO=$(grep -E "^GITHUB_REPO=" .env.local | head -n1 | cut -d'=' -f2-)
if [ -z "$TOKEN" ] || [ -z "$REPO" ]; then
  echo "✗ GITHUB_TOKEN or GITHUB_REPO missing in .env.local"
  exit 1
fi
REMOTE_URL="https://${TOKEN}@github.com/${REPO}.git"

# If .git exists but is in a broken/partial state (no commits, stale locks,
# or unreadable from this user), blow it away and start clean. Otherwise
# initialize fresh.
NEEDS_INIT=0
if [ ! -d .git ]; then
  NEEDS_INIT=1
elif [ -f .git/index.lock ] || ! git rev-parse HEAD >/dev/null 2>&1; then
  echo "→ Detected broken .git from a prior run — cleaning up…"
  rm -rf .git
  NEEDS_INIT=1
fi
if [ "$NEEDS_INIT" -eq 1 ]; then
  echo "→ Initializing fresh git repo…"
  git init -b main >/dev/null
  git config user.email "${GIT_USER_EMAIL:-jacksonjezio@gmail.com}"
  git config user.name "${GIT_USER_NAME:-Jack Jesionowski}"
fi

# Make sure the remote is current.
if git remote | grep -q "^origin$"; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

# Stage + commit. If nothing changed, just push the existing HEAD.
git add -A
MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M:%S')}"
if ! git diff --cached --quiet; then
  git commit -m "$MSG" >/dev/null
  echo "✓ committed: $MSG"
else
  echo "· nothing to commit (will still push HEAD)."
fi

# Push (force-with-lease is safe and overwrites stale remote state if needed)
echo "→ pushing to $REPO…"
if git push -u origin main 2>&1; then
  echo "✓ Pushed. Vercel is now building from this commit."
  echo "→ Watch the deploy: https://vercel.com/jacksonjezio-7345s-projects"
else
  echo "✗ Push failed. If this is the first push and the repo has content,"
  echo "  run: git pull --rebase origin main && bash scripts/sync.sh"
  exit 1
fi
