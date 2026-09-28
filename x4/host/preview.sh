#!/bin/sh
# Render every screen to PNG with the sample card (host/sample). Output: host/out/*.png
set -e
cd "$(dirname "$0")"; make -s
rm -rf out; mkdir out
run() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
run sleep KW_NOW="2026-10-14 00:31" KW_TIMER=1
run today KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run checkin KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down confirm down down down down right right"
run menu KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run month KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm"
run support KW_NOW="2026-10-14 13:10" KW_KEYS="backhold right right"
run plan KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm"
run sync KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down confirm"
run clock KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down confirm"
run holiday KW_NOW="2026-11-26 09:00" KW_KEYS="right"
python3 topng.py out
