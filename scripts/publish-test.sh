#!/usr/bin/env bash
# Publishes the current `dev` branch as the TEST site (https://platypuggames.github.io/platypug/test/).
# Run from a checkout of `dev`. It builds test/index.html from dev's src/, then commits ONLY test/index.html
# onto `main` (via a temporary worktree) and pushes both branches. The live game (main's index.html) is untouched.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ "$(git rev-parse --abbrev-ref HEAD)" = "dev" ] || { echo "publish-test: check out the dev branch first"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "publish-test: commit your dev changes first"; exit 1; }
tmp=$(mktemp -d)
node scripts/build-test.js "$tmp/out" >/dev/null
git push -q origin dev
git fetch -q origin main
git worktree add -q "$tmp/main" origin/main
mkdir -p "$tmp/main/test"
cp "$tmp/out/index.html" "$tmp/main/test/index.html"
cd "$tmp/main"
git add test/index.html
if git diff --cached --quiet; then echo "publish-test: test site already up to date"; else
  git -c user.name="platypuggames" -c user.email="platypuggames@users.noreply.github.com" commit -q -m "Test site: build from dev $(git -C "$OLDPWD" rev-parse --short HEAD)"
  git push -q origin HEAD:main
  echo "publish-test: pushed. Live in ~1-2 min at https://platypuggames.github.io/platypug/test/"
fi
cd - >/dev/null; git worktree remove --force "$tmp/main"; rm -rf "$tmp"
