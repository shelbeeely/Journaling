#!/usr/bin/env bash
# Assembles the public site into site/_out (or the folder you name): the page at the root and the editor demo under /editor/ and the docs index under /docs/ (titles only).
# The demo is built from the GENERIC profile and test.ics only. CI runs the same script (.github/workflows/editor.yml).
#   site/build.sh [outdir]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-site/_out}
( cd journal
  export KW_PROFILE=content/profile.example.json KW_OUT=out-demo EDITOR_DIST=editor/dist-demo/
  node render.mjs month 2026-10 test.ics
  node editor/build.mjs )
rm -rf "$OUT"; mkdir -p "$OUT/editor"
cp site/index.html site/style.css site/app.js "$OUT/"
cp -r site/img "$OUT/img"
cp journal/editor/dist-demo/demo/* journal/editor/dist-demo/demo/.nojekyll "$OUT/editor/"
touch "$OUT/.nojekyll"
node site/tools/build-docs.mjs "$OUT"
node site/check-links.mjs "$OUT"
# Privacy gate: no Spokane, Keeping Watch or Shelbee anywhere in the assembled site or the demo (the repo URL itself is allowed)
if grep -rIh "" "$OUT" | sed 's#github.com/shelbeeely/Journaling#REPO#g' | grep -iE "spokane|keeping watch|shelbee"; then echo "::error::personal words found in the assembled site (lines above)"; exit 1; fi
echo "privacy gate ok: no Spokane, Keeping Watch or Shelbee in $OUT"
