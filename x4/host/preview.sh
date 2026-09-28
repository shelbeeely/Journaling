#!/bin/sh
# Render every screen to PNG with the sample card (host/sample). Output: host/out/*.png
set -e
cd "$(dirname "$0")"; make -s
rm -rf out; mkdir out
run() { name=$1; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
run sleep KW_NOW="2026-10-14 04:31" KW_TIMER=1
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
run nopack KW_NOW="2026-08-05 10:00"
run holiday KW_NOW="2026-11-26 09:00" KW_KEYS="right"
# the day starts when she wakes (4 a.m.): a 00:40 check-in belongs to Oct 31, the page she still has open on paper
run midnight KW_NOW="2026-11-01 00:40" KW_KEYS="confirm down confirm back right left"
# regression check: the evening meds tapped at 00:40 on Nov 1 are filed under Oct 31 (October's log), not November
grep -q '^2026-10-31T00:40,med_pm,1$' /tmp/kwsd/kw/log/2026-10.csv && ! test -e /tmp/kwsd/kw/log/2026-11.csv || { echo "FAIL: after-midnight check-in went to the wrong day"; exit 1; }
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
