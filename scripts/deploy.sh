#!/usr/bin/env bash
# Builds with .env.local (Supabase URL + publishable key) and publishes dist/ to the gh-pages branch.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env.local || { echo "Missing .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_KEY)"; exit 1; }
npm test
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -qm "deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -qf https://github.com/ls693600/pititi-watchers.git gh-pages
rm -rf .git
echo "Deployed: https://ls693600.github.io/pititi-watchers/"
