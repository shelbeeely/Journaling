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
# Focus (Menu > Focus, the last entry): setup with a custom work length, a run started (draws once, then deep sleep), the break after
# round 1, round 2 of 4, the long break, and Done. Each phase is a timer wake from a seeded /kw/focus.txt.
E=$(TZ=America/Los_Angeles date -d "2026-10-14 13:10" +%s)
run focussetup KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down confirm down right right up"
run focusing KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down confirm down down down confirm"
grep -q '^run=W,1,' /tmp/kwsd/kw/focus.txt || { echo "FAIL: starting Focus did not save the run"; exit 1; }
focusseed() { name=$1; seed=$2; shift; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; printf "$seed" > /tmp/kwsd/kw/focus.txt; [ -n "$FLOG" ] && printf "$FLOG" >> /tmp/kwsd/kw/log/2026-10.csv; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
focusseed focusbreak "plan=25,5,15,4\nrun=W,1,$E,0\n" KW_NOW="2026-10-14 13:10" KW_TIMER=1
grep -q ',focus_rounds,1$' /tmp/kwsd/kw/log/2026-10.csv || { echo "FAIL: the finished round was not logged"; exit 1; }
focusseed focusround2 "plan=25,5,15,4\nrun=W,2,$((E+1500)),1\n" KW_NOW="2026-10-14 13:10" KW_KEYS=""
focusseed focuslong "plan=25,5,15,4\nrun=W,4,$E,3\n" KW_NOW="2026-10-14 13:10" KW_TIMER=1
FLOG="2026-10-14T12:55,focus_rounds,3\\n" focusseed focusdone "plan=25,5,15,4\nrun=B,4,$E,3\n" KW_NOW="2026-10-14 13:10" KW_TIMER=1
focusseed focusinterrupt "plan=25,5,15,4\nrun=W,2,$((E+1500)),0\n" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm confirm"
grep -q ',focus_interruptions,2$' /tmp/kwsd/kw/log/2026-10.csv || { echo "FAIL: interruptions were not logged"; exit 1; }
# Accessibility settings (Menu > Settings, /kw/settings.txt): every main screen at large text, in bold, and with buttons remapped.
runset() { name=$1; set=$2; shift; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; printf "$set" > /tmp/kwsd/kw/settings.txt; env KW_SD=/tmp/kwsd KW_OUT=out/$name "$@" ./kw_host >/dev/null; }
LG="text=large\n"
runset l_sleep "$LG" KW_NOW="2026-10-14 04:31" KW_TIMER=1
runset l_today "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back"
runset l_today2 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="down"
runset l_today3 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="down down"
runset l_checkin "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm left left left down confirm right down right right down confirm"
runset l_custom "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down confirm down down down right right down confirm confirm down confirm down down right right right up"
runset l_custom2 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm down down down down down down down down down down down down down down down down confirm right right down confirm left left down right right down right right right"
runset l_menu "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down"
runset l_month "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm"
runset l_month2 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm down"
runset l_support "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold"
runset l_support2 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold right"
runset l_support3 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold right right"
runset l_plan "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm"
runset l_plan2 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm down"
runset l_plan3 "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm down down"
runset l_sync "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down confirm"
runset l_clock "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down confirm"
runset l_clockunset "$LG" KW_NOW="2026-10-14 13:10" KW_CLOCK=unset KW_KEYS="confirm"
runset l_focussetup "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down confirm"
runset l_settings "$LG" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down down confirm"
runset l_midnight "$LG" KW_NOW="2026-11-01 00:40" KW_KEYS=""
E=$(TZ=America/Los_Angeles date -d "2026-10-14 13:10" +%s)
mkdir -p out/l_focusrun; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; printf "$LG" > /tmp/kwsd/kw/settings.txt; printf "plan=25,5,15,4\nrun=W,2,$((E+1500)),1\n" > /tmp/kwsd/kw/focus.txt; env KW_SD=/tmp/kwsd KW_OUT=out/l_focusrun KW_NOW="2026-10-14 13:10" KW_KEYS="" ./kw_host >/dev/null
BD="contrast=bold\n"
runset b_today "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="back"
runset b_checkin "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm left left left down confirm right down right right down confirm"
runset b_month "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down confirm"
runset b_support "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold"
runset b_plan "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="backhold confirm"
runset b_menu "$BD" KW_NOW="2026-10-14 13:10" KW_KEYS="back"
runset bl_today "text=large\ncontrast=bold\n" KW_NOW="2026-10-14 13:10" KW_KEYS="back"
runset bl_checkin "text=large\ncontrast=bold\n" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm left left left down confirm right down right right down confirm"
runset r_left "buttons=left\n" KW_NOW="2026-10-14 13:10" KW_KEYS="back down"
runset r_swap "buttons=swap\n" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm"
runset r_both_menu "buttons=both\n" KW_NOW="2026-10-14 13:10" KW_KEYS="confirm"
runset settings "" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down down confirm down down"
# the settings screen changes and saves: large, bold, swap, sleep 5 min, clean 16, hold off
runset setchange "" KW_NOW="2026-10-14 13:10" KW_KEYS="back down down down down down down down down confirm confirm down confirm down right confirm down right down right down right right"
grep -q '^text=large$' /tmp/kwsd/kw/settings.txt && grep -q '^contrast=bold$' /tmp/kwsd/kw/settings.txt && grep -q '^buttons=swap$' /tmp/kwsd/kw/settings.txt && grep -q '^sleep=300$' /tmp/kwsd/kw/settings.txt && grep -q '^clean=16$' /tmp/kwsd/kw/settings.txt && grep -q '^hold=0$' /tmp/kwsd/kw/settings.txt || { echo "FAIL: settings were not saved as expected"; cat /tmp/kwsd/kw/settings.txt; exit 1; }
# Wi-Fi (Menu > Wi-Fi, the sixth entry): modes, saved networks, joining from the phone, errors. A simulated network stands in for the air
# (KW_WIFI=ssid=password:signal;...); phone-join is the phone's page posting the join; idle lets the screen poll the radio.
NETS='HomeNet=hunter22:-48;Neighbor=secretpw1:-71;CoffeeShop=:-80'
GO="back down down down down down confirm"
runnet() { name=$1; seed=$2; set=$3; shift; shift; shift; mkdir -p out/$name; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; [ -n "$seed" ] && printf "$seed" > /tmp/kwsd/kw/net.txt; printf "$set" > /tmp/kwsd/kw/settings.txt; env KW_SD=/tmp/kwsd KW_OUT=out/$name KW_NOW="2026-10-14 13:10" KW_WIFI="$NETS" KW_PHONE_SSID=HomeNet KW_PHONE_PASS=hunter22 "$@" ./kw_host >/dev/null; }
SEED3='name=keeping-watch\nlast=0\nnet=HomeNet\thunter22\nnet=Neighbor\tsecretpw1\nnet=Upstairs Family Room Mesh 5GHz\tpassword1\n'
runnet wifi_home "" "" KW_KEYS="$GO"
runnet wifi_none "" "" KW_KEYS="$GO down confirm"
runnet wifi_saved "$SEED3" "" KW_KEYS="$GO down confirm"
runnet wifi_forget "$SEED3" "" KW_KEYS="$GO down confirm down right"
runnet wifi_forgot "$SEED3" "" KW_KEYS="$GO down confirm down right confirm"
grep -q '^net=Neighbor' /tmp/kwsd/kw/net.txt && { echo "FAIL: a forgotten network is still in net.txt"; exit 1; }
runnet wifi_hotspot "" "" KW_KEYS="$GO confirm"
runnet wifi_join "" "" KW_KEYS="$GO down down confirm"
runnet wifi_joining "" "" KW_KEYS="$GO down down confirm phone-join idle"
runnet wifi_joined "" "" KW_KEYS="$GO down down confirm phone-join idle idle idle"
# the password the phone typed is saved on the card, the file says what it holds, and a wrong one is never saved
grep -q '^net=HomeNet	hunter22$' /tmp/kwsd/kw/net.txt && grep -q 'PLAIN TEXT' /tmp/kwsd/kw/net.txt || { echo "FAIL: joining did not save the network as expected"; exit 1; }
runnet wifi_badpass "" "" KW_PHONE_PASS=wrongpass1 KW_KEYS="$GO down down confirm phone-join idle idle idle"
[ ! -e /tmp/kwsd/kw/net.txt ] || { echo "FAIL: a wrong password was saved"; exit 1; }
runnet wifi_lan "$SEED3" "" KW_KEYS="$GO down confirm down confirm idle idle idle"
runnet wifi_failed 'net=Ghost\tpassword1\n' "" KW_KEYS="$GO down confirm idle idle idle"
runnet wifi_timeout 'net=HomeNet\thunter22\n' "" KW_WIFI_HANG=1 KW_KEYS="$GO down confirm idle idle skip26000 idle"
runnet wifi_locked 'net=HomeNet\thunter22\n' "" KW_KEYS="$GO down confirm idle idle idle phone-badpin phone-badpin phone-badpin phone-badpin phone-badpin idle"
runnet wifi_retry 'net=Ghost\tpassword1\n' "" KW_KEYS="$GO down confirm idle idle idle confirm idle idle idle"
# Large, Bold and remapped buttons on the new screens
runnet l_wifi_home "" "$LG" KW_KEYS="$GO"
runnet l_wifi_saved "$SEED3" "$LG" KW_KEYS="$GO down confirm"
runnet l_wifi_forget "$SEED3" "$LG" KW_KEYS="$GO down confirm down right"
runnet l_wifi_hotspot "" "$LG" KW_KEYS="$GO confirm"
runnet l_wifi_hotspot2 "" "$LG" KW_KEYS="$GO confirm down"
runnet l_wifi_join2 "" "$LG" KW_KEYS="$GO down down confirm down"
runnet l_wifi_joined "" "$LG" KW_KEYS="$GO down down confirm phone-join idle idle idle"
runnet l_wifi_joined2 "" "$LG" KW_KEYS="$GO down down confirm phone-join idle idle idle down"
runnet l_wifi_failed 'net=Ghost\tpassword1\n' "$LG" KW_KEYS="$GO down confirm idle idle idle"
runnet l_wifi_badpass "" "$LG" KW_PHONE_PASS=wrongpass1 KW_KEYS="$GO down down confirm phone-join idle idle idle down"
runnet b_wifi_home "" "$BD" KW_KEYS="$GO"
runnet b_wifi_saved "$SEED3" "$BD" KW_KEYS="$GO down confirm"
runnet b_wifi_joined "" "$BD" KW_KEYS="$GO down down confirm phone-join idle idle idle"
runnet bl_wifi_joined "" "text=large\ncontrast=bold\n" KW_KEYS="$GO down down confirm phone-join idle idle idle"
runnet r_left_wifi_saved "$SEED3" "buttons=left\n" KW_KEYS="back up up up up up confirm up confirm"
runnet r_swap_wifi_joined "" "buttons=swap\n" KW_KEYS="confirm down down down down down back down down back phone-join idle idle idle"
# Sync with Studio (Wi-Fi, the fifth row): the preview (log off, log on, two networks), a sent result, a refused certificate. sync.txt holds a made-up token.
runsync() { name=$1; log=$2; set=$3; shift; shift; shift; mkdir -p out/$name; rm -rf /tmp/kwsd /tmp/kw-prev-store; cp -r sample /tmp/kwsd
  printf 'name=keeping-watch\nlast=0\nnet=HomeNet\thunter22\n' > /tmp/kwsd/kw/net.txt; [ -n "$NET2" ] && printf 'net=Neighbor\tsecretpw1\n' >> /tmp/kwsd/kw/net.txt
  printf "server=studio.example.com\ntoken=kwd_0123456789ab_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd\nlog=$log\n" > /tmp/kwsd/kw/sync.txt
  printf -- '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n' > /tmp/kwsd/kw/studio-ca.pem; printf "$set" > /tmp/kwsd/kw/settings.txt
  env KW_SD=/tmp/kwsd KW_OUT=out/$name KW_SYNC_STORE=/tmp/kw-prev-store KW_NOW="2026-10-14 13:10" KW_WIFI="$NETS" "$@" ./kw_host >/dev/null; }
SY="$GO down down down down confirm"
runsync sync_off 0 "" KW_KEYS="$SY"
runsync sync_on 1 "" KW_KEYS="$SY"
NET2=1 runsync sync_nets 1 "" KW_KEYS="$SY left"
runsync sync_sent 1 "" KW_KEYS="$SY confirm"
runsync sync_cert 1 "" KW_SYNC=cert KW_KEYS="$SY confirm"
runsync sync_unauth 1 "" KW_SYNC=401 KW_KEYS="$SY confirm"
runsync sync_nobuild 1 "" KW_SYNC_BUILT=0 KW_KEYS="$SY confirm"
runsync l_sync_on 1 "$LG" KW_KEYS="$SY"
runsync l_sync_off 0 "$LG" KW_KEYS="$SY"
runsync l_sync_cert 1 "$LG" KW_SYNC=cert KW_KEYS="$SY confirm"
runsync l_sync_sent 1 "$LG" KW_KEYS="$SY confirm"
runsync b_sync_on 1 "$BD" KW_KEYS="$SY"
runsync bl_sync_unauth 1 "text=large\ncontrast=bold\n" KW_SYNC=401 KW_KEYS="$SY confirm"
mkdir -p out/sync_none; rm -rf /tmp/kwsd; cp -r sample /tmp/kwsd; printf 'net=HomeNet\thunter22\n' > /tmp/kwsd/kw/net.txt; env KW_SD=/tmp/kwsd KW_OUT=out/sync_none KW_NOW="2026-10-14 13:10" KW_WIFI="$NETS" KW_KEYS="$SY" ./kw_host >/dev/null
python3 topng.py out
./test_settings.sh   # settings file round trip, bad values, button remap tables
./test_update.sh
./test_net.sh      # saved networks, PIN, one client, joining on a simulated network
./test_sync.sh     # the sync client against a simulated Studio, and the screens end to end
./test_off.sh      # nothing is sent anywhere, nothing wakes the radio: the code, the app, and the radio log
./test_focus.sh    # round/break schedule, late wakes (also past the 4 a.m. roll), stale runs, month counts
./test_legacy.sh   # logs written before the care split (old keys for meds, meals, mood) still read and count
python3 ../tools/test_export.py
