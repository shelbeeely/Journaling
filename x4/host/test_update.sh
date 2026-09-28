#!/bin/sh
# Card-update test: /kw-update moves into /kw on boot, and her log and safety plan survive untouched.
set -e
cd "$(dirname "$0")"; make -s
D=/tmp/kwsd-update; rm -rf $D; cp -r sample $D
printf '#Signs\nMY EDITED PLAN\n' > $D/kw/me.txt
printf '2026-10-14T13:05,med_am,1\n' > $D/kw/log/2026-10.csv   # her real log
cp $D/kw/me.txt /tmp/kwsd-me.before; cp $D/kw/log/2026-10.csv /tmp/kwsd-log.before
mkdir -p $D/kw-update/library $D/kw-update/kw-update-subdir
echo "@2026-12-01" > $D/kw-update/2026-12.txt          # new pack
echo "NEW SUPPORT" > $D/kw-update/support.txt          # replaces the old one
printf '#BLANK PLAN\n' > $D/kw-update/me.txt           # must NOT replace her plan
echo x > $D/kw-update/me.example.txt; echo x > $D/kw-update/.DS_Store; echo x > $D/kw-update/notes.docx
echo pdf > $D/kw-update/library/book.pdf; echo x > $D/kw-update/library/cover.png
echo "log/ must survive a moved folder" > $D/kw/log/keep.txt
env KW_SD=$D KW_OUT=/tmp/kwsd-out KW_NOW="2026-10-14 13:10" KW_KEYS="back" ./kw_host >/dev/null
fail() { echo "FAIL: $1"; exit 1; }
cmp -s $D/kw/me.txt /tmp/kwsd-me.before || fail "me.txt changed"
cmp -s $D/kw/log/2026-10.csv /tmp/kwsd-log.before || fail "log changed"
[ -f $D/kw/log/keep.txt ] || fail "log folder touched"
grep -q "@2026-12-01" $D/kw/2026-12.txt || fail "new pack not moved in"
grep -q "NEW SUPPORT" $D/kw/support.txt || fail "support.txt not replaced"
[ -f $D/kw/library/book.pdf ] || fail "library pdf not moved"
[ ! -e $D/kw/library/cover.png ] || fail "non-book adopted"
[ ! -e $D/kw/me.example.txt ] && [ ! -e $D/kw/.DS_Store ] && [ ! -e $D/kw/notes.docx ] || fail "junk adopted"
[ -d $D/kw-update/kw-update-subdir ] && echo "note: a stray subfolder keeps /kw-update (harmless)"
rmdir $D/kw-update/kw-update-subdir; env KW_SD=$D KW_OUT=/tmp/kwsd-out KW_NOW="2026-10-14 13:10" KW_KEYS="back" ./kw_host >/dev/null
[ ! -e $D/kw-update ] || fail "/kw-update not removed once empty"
# first-time card: no me.txt yet, so the update's me.txt is taken; a later update never replaces it
rm -rf $D; mkdir -p $D/kw $D/kw-update; printf '#FIRST\n' > $D/kw-update/me.txt
env KW_SD=$D KW_OUT=/tmp/kwsd-out KW_NOW="2026-10-14 13:10" KW_KEYS="back" ./kw_host >/dev/null
grep -q FIRST $D/kw/me.txt || fail "first-time me.txt not taken"
echo "update test: ok"
