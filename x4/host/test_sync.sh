#!/bin/sh
# Sync client (BUILD-PLAN N2): the device's core/sync.cpp against a simulated Studio, then the screens end to end (preview, Send, nothing sent without Send).
set -e
cd "$(dirname "$0")"; make -s
F="-std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation"
g++ $F -Wno-return-type -Dmain=kw_host_main -c -o /tmp/kw_hal_host4.o hal_host.cpp
g++ $F -o /tmp/kw_test_sync test_sync.cpp ../src/core/sync.cpp ../src/core/net.cpp /tmp/kw_hal_host4.o
OUT=/tmp/kw_test_sync.out
/tmp/kw_test_sync > $OUT || { grep FAIL $OUT; echo "FAIL: sync test"; exit 1; }
tail -1 $OUT | grep -q 'sync test: ok' || { grep FAIL $OUT; echo "FAIL: sync test"; exit 1; }
fail() { echo "FAIL: $1"; exit 1; }
# the token never reaches any output line
grep -q 'kwd_' $OUT && fail "the token appeared in the output"
grep '^sync: ' $OUT | grep -Ev '^sync: (open [a-z0-9.-]+:[0-9]+ ca=pinned|close|GET /api/device/info offset=-1 len=0 auth=bearer|POST /api/device/log/[0-9]{4}-[0-9]{2} offset=[0-9]+ len=[0-9]+ auth=bearer)$' && fail "an unexpected sync call"

# the screens: the Sync row (5th in Wi-Fi), the preview, Send. Menu > Wi-Fi is the sixth entry.
D=/tmp/kwsd-syncapp
card() { rm -rf $D /tmp/kw-app-store; cp -r sample $D; printf 'name=keeping-watch\nnet=HomeNet\thunter22\n' > $D/kw/net.txt
  printf 'server=studio.example.com\ntoken=kwd_0123456789ab_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd\nlog=%s\n' "$1" > $D/kw/sync.txt
  printf -- '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n' > $D/kw/studio-ca.pem; }
run() { env KW_SD=$D KW_OUT=/tmp/kwsd-syncapp-out KW_SYNC_STORE=/tmp/kw-app-store KW_NOW='2026-10-14 13:10' KW_WIFI='HomeNet=hunter22:-48' KW_KEYS="$1" ./kw_host > /tmp/kw_syncapp.out; }
GO='back down down down down down confirm'
SYNC="$GO down down down down confirm"      # the Sync row, then the preview
card 1; ls $D/kw/log/*.csv >/dev/null 2>&1 || fail "the sample card has no log to send"
# 1. opening the preview, even leaving it with Back, sends nothing and touches no radio
run "$SYNC back back back"
grep -q '^sync: \|^net: ' /tmp/kw_syncapp.out && fail "opening the Sync preview used the network"
grep -q 'radio at end: off' /tmp/kw_syncapp.out || fail "radio not off"
# 2. the log switch is on the preview: with it off, Send sends nothing
card 0; run "$SYNC confirm"
grep -q '^sync: \|^net: ' /tmp/kw_syncapp.out && fail "Send with the log off used the network"
# 3. Send with the log on: one session, the log goes up, the radio is left off
card 1; run "$SYNC confirm confirm"
grep -q '^sync: open studio.example.com:443 ca=pinned' /tmp/kw_syncapp.out || fail "Send did not reach the Studio"
grep '^net: ' /tmp/kw_syncapp.out | tr '\n' ' ' | grep -q '^net: start-sta-sync net: join HomeNet net: stop $' || fail "sync radio calls: $(grep '^net: ' /tmp/kw_syncapp.out | tr '\n' ' ')"
grep -q 'radio at end: off' /tmp/kw_syncapp.out || fail "radio left on after Send"
for f in $D/kw/log/*.csv; do cmp -s $f /tmp/kw-app-store/$(basename $f) || fail "the Studio's copy of $(basename $f) differs"; done
grep -q 'kwd_\|hunter22' /tmp/kw_syncapp.out && fail "a secret appeared in the output"
# 4. the switch on the preview saves log=1 and keeps the token
card 0; run "$SYNC right back back back"
grep -q '^log=1$' $D/kw/sync.txt && grep -q '^token=kwd_' $D/kw/sync.txt || fail "the log switch did not save as expected"
# 5. the default firmware (no TLS) shows the Sync row and sends nothing
card 1; env KW_SYNC_BUILT=0 KW_SD=$D KW_OUT=/tmp/kwsd-syncapp-out KW_NOW='2026-10-14 13:10' KW_WIFI='HomeNet=hunter22:-48' KW_KEYS="$SYNC confirm" ./kw_host > /tmp/kw_syncapp.out
grep -q '^sync: ' /tmp/kw_syncapp.out && fail "the default build tried to sync"
echo "sync test: ok"
