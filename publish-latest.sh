#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

if [ "${REPO_GIT_USE_PROJECT_SSH:-0}" = "1" ]; then
  echo "Using project SSH key and pushing latest local commit to GitHub..."
else
  echo "Using your current GitHub SSH setup and pushing latest local commit to GitHub..."
fi

./repo-git push origin main

echo "Push finished. Vercel will start deploying automatically."
