#!/bin/bash
# Double-click this file in Finder to push every queued commit to GitHub.
# It also clears any stuck git locks so the push doesn't fail half-way.
cd "$(dirname "$0")" || exit 1
rm -f .git/HEAD.lock .git/index.lock 2>/dev/null

echo "=== local commits ahead of origin ==="
git log --oneline origin/main..main 2>/dev/null || git log --oneline -5
echo ""
echo "=== pushing ==="
git push 2>&1
echo ""
echo "=== done — close this window when ready ==="
# Hold the Terminal window open after the script finishes
read -n 1 -s -r -p "Press any key to close..."
