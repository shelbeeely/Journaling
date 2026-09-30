#!/bin/sh
# The "off" test (BUILD-PLAN section 19 checks): in N1 nothing is sent anywhere, and nothing wakes the radio or the chip by itself.
#  A. the firmware source has no call that could reach a host, run a timer or wake in the background (an audit of the code itself);
#  B. the app, run on the simulated network, leaves the radio off on every way out and sleeps on the idle rules;
#  C. the radio log of a whole session holds only the joined network's own access point (join), the hotspot, the name announcement and stop.
# Sync (slice N2) will add a deliberate, user-started connection; this test then changes on purpose, not by accident.
set -e
cd "$(dirname "$0")"; make -s
fail() { echo "FAIL: $1"; exit 1; }

# ---------- A. the code ----------
SRC=$(ls ../src/*.cpp ../src/*.h ../src/core/* ../src/hal/* ../src/net/* | grep -v 'tlsprobe.cpp')
# nothing that opens an outbound connection, resolves a name, sets the clock from the internet, runs a timer or talks to another radio
BAD='HTTPClient|WiFiClientSecure|WiFiUDP|configTime|sntp_|esp_http_client|SecureClient|SecureHttpClient|NearbyTransfer|Opds|getaddrinfo|gethostbyname|hostByName|esp_sleep_enable_wifi|xTimerCreate|esp_timer_create|Ticker|esp_now|ESP_NOW|BLEDevice|BluetoothSerial|PubSubClient|ArduinoOTA|httpUpdate|esp_wifi_set_promiscuous'
grep -nE "$BAD" $SRC && fail "the source names a call that could send data or run in the background"
# WiFiClient only as the server's own accepted socket (streaming a download to whoever asked)
grep -n 'WiFiClient' $SRC | grep -v 'WiFiClient c = server->client();' && fail "WiFiClient used for something other than answering a request"
# the only place a network is joined is wifiJoin, and the only wake source is the deep-sleep timer set in sleepUntil
[ "$(grep -c 'WiFi\.begin(' ../src/hal/hal_x4.cpp)" = 1 ] || fail "WiFi.begin must appear once (wifiJoin)"
grep -B3 'WiFi\.begin(' ../src/hal/hal_x4.cpp | grep -q 'bool wifiJoin' || fail "WiFi.begin is outside wifiJoin"
[ "$(grep -c 'esp_sleep_enable' ../src/hal/hal_x4.cpp)" = 1 ] || fail "only one wake source (sleepUntil's timer) is allowed"
grep -n 'sleepUntil(' ../src/app.cpp | grep -Ev 'nextDayStart\(hal::now\(\)\)|FRUN\.end \+ 5' && fail "sleepUntil called with a wake time that is not the day start or the Focus phase end"
# no output that could carry a password or the PIN
grep -nE 'Serial\.(print|printf|println)' $SRC | grep -iE 'pass|pend|pwd|pin|token|cookie' && fail "a log line could carry a secret"
# the saved-network file is not on any list the page can download or replace
sed -n '/static String uploadDir/,/^}/p' ../src/hal/hal_x4.cpp | grep -q 'net' && fail "uploadDir mentions net"
grep -n '/api/lib\|/api/log\|sendFile' ../src/hal/hal_x4.cpp | grep -q 'net.txt' && fail "a download route mentions net.txt"
echo "off test A: the code has no way to reach a host, run a timer, or wake by itself"

# ---------- B. the app on the simulated network ----------
D=/tmp/kwsd-off
card() { rm -rf $D; cp -r sample $D; printf 'name=keeping-watch\nnet=HomeNet\thunter22\n' > $D/kw/net.txt; }
NOW='2026-10-14 13:10'
run() { card; env KW_SD=$D KW_OUT=/tmp/kwsd-off-out KW_NOW="$NOW" KW_WIFI='HomeNet=hunter22:-48;Neighbor=secretpw1:-71' KW_PHONE_SSID=Neighbor KW_PHONE_PASS=secretpw1 KW_KEYS="$1" ./kw_host > /tmp/kw_off.out; }
GO='back down down down down down confirm'      # Menu > Wi-Fi
# 1. opening the Wi-Fi screen starts nothing; leaving it starts nothing
run "$GO back"
grep -q '^net: ' /tmp/kw_off.out && fail "the radio was touched just by opening the Wi-Fi screen"
grep -q 'radio at end: off' /tmp/kw_off.out || fail "radio not off after leaving the screen"
# 2. every way out of every mode leaves the radio off (Back, Power, the Support hold)
for K in "$GO confirm back" "$GO down down confirm back" "$GO down confirm idle idle idle back" "$GO down down confirm phone-join idle idle idle idle back"; do
  run "$K"; grep -q 'radio at end: off' /tmp/kw_off.out || fail "radio left on after: $K"
done
run "$GO confirm power";  grep -q 'radio at sleep: off' /tmp/kw_off.out || fail "radio on at sleep after the hotspot"
run "$GO down confirm idle idle idle power"; grep -q 'radio at sleep: off' /tmp/kw_off.out && grep -q 'net: stop' /tmp/kw_off.out || fail "radio on at sleep after joining"
run "$GO confirm backhold"; grep -q 'net: stop' /tmp/kw_off.out || fail "Support hold did not stop the radio"
# 3. idle sleep, by the settings from the accessibility PR: never under 15 minutes on this screen, a request from the page counts as activity
run "$GO confirm skip120000 idle back"; grep -q 'deep sleep' /tmp/kw_off.out && fail "slept after 2 minutes while a phone may be typing a password"
run "$GO confirm skip900000 idle";      grep -q 'deep sleep' /tmp/kw_off.out && grep -q 'radio at sleep: off' /tmp/kw_off.out || fail "did not sleep after 15 quiet minutes"
run "$GO confirm skip800000 phone-ping skip800000 idle back"; grep -q 'deep sleep' /tmp/kw_off.out && fail "slept although the page was used 13 minutes ago"
run "$GO confirm skip800000 phone-ping skip800000 idle skip200000 idle"; grep -q 'deep sleep' /tmp/kw_off.out || fail "did not sleep 16 minutes after the last request"
grep 'deep sleep until' /tmp/kw_off.out | grep -q '2026-10-15 04:31' || fail "the only wake time is the next day start"
echo "off test B: radio off on every way out; sleeps on the idle rules"

# ---------- C. a whole session's radio log ----------
run "$GO down down confirm phone-join idle idle idle idle idle idle idle back"
grep '^net: ' /tmp/kw_off.out | grep -Ev '^net: (start-ap|start-sta|scan|join [^ ]+.*|join-cancel|drop-ap|mdns [a-z0-9-]+\.local|stop)$' && fail "unexpected radio call"
grep '^net: ' /tmp/kw_off.out | tr '\n' ',' | sed 's/,$//'; echo
grep -q hunter22 /tmp/kw_off.out && fail "a password reached the output"
grep -q secretpw1 /tmp/kw_off.out && fail "a password reached the output"
echo "off test: ok"
