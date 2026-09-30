#!/bin/sh
# Wi-Fi modes on a simulated network (see test_net.cpp), plus the "off" proof: nothing is sent anywhere, nothing wakes the radio by itself.
set -e
cd "$(dirname "$0")"; make -s
D=/tmp/kwsd-net; rm -rf $D; mkdir -p $D/kw
F="-std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation"
g++ $F -Wno-return-type -Dmain=kw_host_main -c -o /tmp/kw_hal_host3.o hal_host.cpp
g++ $F -o /tmp/kw_test_net test_net.cpp ../src/core/net.cpp phone_sim.cpp /tmp/kw_hal_host3.o
OUT=/tmp/kw_test_net.out
env KW_SD=$D KW_OUT=/tmp/kwsd-net-out KW_WIFI="HomeNet=hunter22:-48;Neighbor=secretpw1:-71;CoffeeShop=:-80" /tmp/kw_test_net > $OUT
tail -1 $OUT | grep -q 'net test: ok' || { grep FAIL $OUT; echo "FAIL: net test"; exit 1; }
fail() { echo "FAIL: $1"; exit 1; }
# 1. no password and no PIN in anything the device said (answers, radio log): the file on the card is the only place a password lives
for secret in hunter22 wrongpass1 secretpw1 'p@ss word'; do grep -q "$secret" $OUT && fail "a password appeared in the output: $secret"; done
# 2. the radio was only ever asked for the allowed things (start, scan, join THIS network, drop the hotspot, announce the name, stop)
grep '^net: ' $OUT | grep -Ev '^net: (start-ap|start-sta|scan|join [^ ]+.*|join-cancel|drop-ap|mdns [a-z0-9-]+\.local|stop)$' && fail "an unexpected radio call"
grep -q '^net: start-ap' $OUT && grep -q '^net: join ' $OUT && grep -q '^net: mdns ' $OUT || fail "the simulated network was never used"
echo "net test: ok ($(grep -c '^net: ' $OUT) radio calls, all allowed)"
