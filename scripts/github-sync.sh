#!/bin/bash
set -e

GITHUB_REPO="https://github.com/RahithaKS/BLM001_Phase01.git"

if [ -z "$GITHUB_PAT" ]; then
  echo "ERROR: GITHUB_PAT secret is not set. Add it in the Replit Secrets tab."
  exit 1
fi

REMOTE_URL="https://${GITHUB_PAT}@github.com/RahithaKS/BLM001_Phase01.git"

if git remote get-url github &>/dev/null; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushing branch '$BRANCH' to GitHub ($GITHUB_REPO)..."
git push github "$BRANCH" --force
echo "GitHub sync complete."
