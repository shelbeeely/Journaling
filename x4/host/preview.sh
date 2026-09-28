#!/bin/sh
# Render every screen to PNG with the sample card (host/sample). Output: host/out/*.png
set -e
cd "$(dirname "$0")"; make -s
rm -rf out; mkdir out
run() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
run sleep KW_NOW="2026-10-14 00:31" KW_TIMER=1
run today KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run checkin KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down confirm down down down down right right"
# custom check-ins (sample/kw/checkins.txt): scroll past the built-ins, tick, set, fill dots, count
run custom KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down down down down down down down down confirm down down down right right down confirm confirm down confirm down down right right right up"
run menu KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run month KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm"
run support KW_NOW="2026-10-14 13:10" KW_KEYS="backhold right right"
run plan KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm"
# a long plan (host/plan-long.txt): page to the end and past it, back up, then Support and back to page 1
runlong() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; cp plan-long.txt /tmp/kwsd/kw/me.txt; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
runlong planlong KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm down down down down up confirm confirm"
run sync KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down confirm"
run clock KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down confirm"
run holiday KW_NOW="2026-11-26 09:00" KW_KEYS="right"
python3 topng.py out
