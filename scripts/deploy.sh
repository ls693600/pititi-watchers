#!/usr/bin/env bash
# Builds with .env.local (Supabase URL + publishable key) and publishes dist/ to the gh-pages branch.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env.local || { echo "Missing .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_KEY)"; exit 1; }
npm test
# Real screens on iPhone Safari and Android Chrome engines; a failure stops the release
npm run test:e2e
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -qm "deploy $(date -u +%Y-%m-%dT%H:%MZ)"
# Publishes to the repo this checkout came from (moves with the repo to another account)
git push -qf "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
APP_URL=$(grep -E '^VITE_APP_URL=' ../.env.local | cut -d= -f2- || true)
echo "Deployed: ${APP_URL:-https://ls693600.github.io/pititi-watchers/}"
