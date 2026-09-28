#!/bin/sh
# Render every screen to PNG with the sample card (host/sample). Output: host/out/*.png
set -e
cd "$(dirname "$0")"; make -s
rm -rf out; mkdir out
run() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
run sleep KW_NOW="2026-10-14 04:31" KW_TIMER=1
run today KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run checkin KW_NOW="2026-10-14 13:10" KW_KEYS="confirm left left left down confirm right down right right down confirm down down confirm"
# custom check-ins (sample/kw/checkins.txt): scroll past the built-ins, tick, set, fill dots, count
run custom KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down confirm down down down right right down confirm confirm down confirm down down right right right up"
# bridge v2: zero-based 0-10 scale, signed -3..+3 scale, pick-one choice, capped count (sample/kw/checkins.txt "More" group)
run custom2 KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down down down down down down down down down confirm right right down confirm left left down right right down right right right"
# choices are logged by their text, so the history survives re-ordering the words; a word she removed later is kept in the CSV but shows as unset
grep -q '^2026-10-14T13:10,c_words_kind,stormy$' /tmp/kwsd/kw/log/2026-10.csv && grep -q ',c_scale_mood7,-2$' /tmp/kwsd/kw/log/2026-10.csv && grep -q ',c_scale_pain10,7$' /tmp/kwsd/kw/log/2026-10.csv || { echo "FAIL: bridge v2 values were not logged as expected"; exit 1; }
# forward compatible: unknown kinds and extra columns are ignored; bad choices (1 option, 9 options, repeated words) are skipped, the rest still load
mkdir -p out/compat; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd
printf "c_z1|Future kind|widget|0|1|0\nc_z2|One option|choice|0|0|0|only\nc_z3|Nine options|choice|0|8|0|a;b;c;d;e;f;g;h;i\nc_z4|Repeats|choice|0|1|0|x;x\nc_z5|Extra columns kept|toggle|0|1|0|ignored|ignored too\n" >> /tmp/kwsd/kw/checkins.txt
env KW_SD=/tmp/kwsd KW_OUT=out/compat KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down down down down down down down down down down down down down" ./kw_host >/dev/null
run menu KW_NOW="2026-10-14 13:10" KW_KEYS="back"
run month KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm"
run support KW_NOW="2026-10-14 13:10" KW_KEYS="backhold right right"
run plan KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm"
# a long plan (host/plan-long.txt): page to the end and past it, back up, then Support and back to page 1
runlong() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; cp plan-long.txt /tmp/kwsd/kw/me.txt; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
runlong planlong KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm down down down down up confirm confirm"
run sync KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down confirm"
run clock KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down confirm"
run nopack KW_NOW="2026-08-05 10:00"
run holiday KW_NOW="2026-11-26 09:00" KW_KEYS="right"
# the day starts when she wakes (4 a.m.): a 00:40 check-in belongs to Oct 31, the page she still has open on paper
run midnight KW_NOW="2026-11-01 00:40" KW_KEYS="confirm down down down confirm down confirm back right left"
# regression check: the teeth tapped at 00:40 on Nov 1 are filed under Oct 31 (October's log), not November
grep -q '^2026-10-31T00:40,teeth,1$' /tmp/kwsd/kw/log/2026-10.csv && ! test -e /tmp/kwsd/kw/log/2026-11.csv || { echo "FAIL: after-midnight check-in went to the wrong day"; exit 1; }
run midnightsleep KW_NOW="2026-11-01 00:31" KW_TIMER=1
# unlogged values show "–" (mood and spoons logged, anxiety not; then nothing logged) and month stats skip unset days
runlog() { name=$1; lines=$2; shift; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; printf "$lines" >> /tmp/kwsd/kw/log/2026-10.csv; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
runlog unset "2026-10-20T09:00,mood,1\n2026-10-20T09:01,spoons,5\n" KW_NOW="2026-10-20 13:10" KW_KEYS=""
runlog unsetnone "" KW_NOW="2026-10-21 13:10" KW_KEYS=""
# the first days of a month open This month on the month just finished; right reaches the new one
run firstmonth KW_NOW="2026-11-01 09:00" KW_KEYS="back down down confirm right"
# flat battery: the clock is not set, so Check in goes to Clock with a plain message; a clock before the books were built too
run clockunset KW_NOW="2026-10-14 13:10" KW_CLOCK=unset KW_KEYS="confirm"
run clockbehind KW_NOW="2025-03-02 09:00" KW_KEYS="confirm"
# many events: "+N more"; custom entries from an older layout are counted
mkdir -p out/manyevents; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd
printf "ev=9:00a Dentist\nev=10:30a Call the pharmacy\nev=12:00p Lunch with Sam\nev=2:00p Therapy\nev=4:30p Pick up parcel\nev=6:00p Movie night\nrt=Water plants\n" >> /tmp/kwsd/kw/2026-10.txt
printf "2026-10-31T09:00,c_old_key,1\n2026-10-31T09:01,c_other_old,2\n2026-10-31T09:02,mood,2\n" >> /tmp/kwsd/kw/log/2026-10.csv
env KW_SD=/tmp/kwsd KW_OUT=out/manyevents KW_NOW="2026-10-31 13:10" KW_KEYS="" ./kw_host >/dev/null
python3 topng.py out
./test_update.sh
./test_legacy.sh   # logs written before the care split (old keys for meds, meals, mood) still read and count
python3 ../tools/test_export.py
