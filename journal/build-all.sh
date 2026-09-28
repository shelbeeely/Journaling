#!/usr/bin/env bash
# Build everything: the Keeper, then every month in both sizes (interior, cover, EPUB), with overflow checks.
#   ICS=private/main.ics,private/birthdays.ics ./build-all.sh          # your books
#   ./build-all.sh                                                      # sample books from test.ics
#   MONTHS="2026-10 2026-11" SIZES=small HARDCOVER=1 ./build-all.sh      # a subset / hardcover padding
set -euo pipefail
cd "$(dirname "$0")"
ICS=${ICS:-test.ics}
MONTHS=${MONTHS:-"2026-10 2026-11 2026-12 2027-01 2027-02 2027-03 2027-04 2027-05 2027-06 2027-07 2027-08 2027-09"}
SIZES=${SIZES:-"small letter"}
node keeper.mjs && node cover.mjs keeper
fail=0
dirs=()
for m in $MONTHS; do
  for s in $SIZES; do
    if [ "$s" = letter ] && [ "${HARDCOVER:-}" = 1 ]; then echo "::notice::skipping 8.5x11 for $m: KDP has no 8.5x11 hardcover"; continue; fi
    if [ "$s" = letter ]; then export SIZE=letter; dir=m$m-letter; else unset SIZE; dir=m$m; fi
    node render.mjs month "$m" "$ICS"
    node cover.mjs month "$m"
    dirs+=("out/$dir")
    node check.mjs "$dir" || { echo "::error::overflow in $dir"; fail=1; }
    node check-spreads.mjs "out/$dir" || { echo "::error::Exchange/Reply not facing in $dir"; fail=1; }
    [ "$s" = small ] && python3 epub.py "m$m"
  done
done
unset SIZE
# scan codes: unique, decode from the PDF, every page mapped (DECODE=all for every page, DECODE=none to skip)
# page identity across books: shared pages (Key, Support, Safety ...) must be byte-identical in every book and both sizes
[ ${#dirs[@]} -eq 0 ] || node check-pages.mjs "${dirs[@]}" || { echo "::error::page identity"; fail=1; }
[ ${#dirs[@]} -eq 0 ] || node check-codes.mjs "${dirs[@]}" || { echo "::error::scan codes"; fail=1; }
node proof-test.mjs || fail=1   # KDP proof test sheet (both sizes), not part of the books
exit $fail
