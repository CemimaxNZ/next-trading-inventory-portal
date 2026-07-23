#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

if [ "${REPO_GIT_USE_PROJECT_SSH:-0}" = "1" ]; then
  echo "Using project SSH key and pushing latest local commit to GitHub..."
else
  echo "Using your current GitHub SSH setup and pushing latest local commit to GitHub..."
fi

echo "Fetching latest changes from GitHub..."
./repo-git fetch origin

echo "Rebasing local commits on top of origin/main..."
./repo-git rebase origin/main

echo "Pushing rebased commits to GitHub..."
./repo-git push origin main

echo "Push finished. Vercel will start deploying automatically."
