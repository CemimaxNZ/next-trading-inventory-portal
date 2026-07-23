#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

echo "Using project SSH key and pushing latest local commit to GitHub..."
REPO_GIT_USE_PROJECT_SSH=1 ./repo-git push origin main

echo "Push finished. Vercel will start deploying automatically."

