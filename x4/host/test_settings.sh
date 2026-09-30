#!/bin/sh
# Settings file round trip, bad values and the button remap tables.
set -e
cd "$(dirname "$0")"
D=/tmp/kwsd-settings; rm -rf $D; mkdir -p $D/kw
F="-std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation"
g++ $F -Wno-return-type -Dmain=kw_host_main -c -o /tmp/kw_hal_host2.o hal_host.cpp
g++ $F -o /tmp/kw_test_settings test_settings.cpp ../src/core/settings.cpp /tmp/kw_hal_host2.o
KW_SD=$D KW_OUT=/tmp/kwsd-settings-out /tmp/kw_test_settings
