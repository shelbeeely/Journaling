#!/bin/sh
# Focus timer arithmetic (round/break schedule, late wakes, the 4 a.m. day roll, stale runs, month CSV counts).
set -e
cd "$(dirname "$0")"
D=/tmp/kwsd-focus; rm -rf $D; mkdir -p $D/kw/log
F="-std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation"
g++ $F -Wno-return-type -Dmain=kw_host_main -c -o /tmp/kw_hal_host.o hal_host.cpp
g++ $F -o /tmp/kw_test_focus test_focus.cpp ../src/core/data.cpp ../src/core/focus.cpp /tmp/kw_hal_host.o
KW_SD=$D KW_OUT=/tmp/kwsd-focus-out KW_NOW="2026-10-14 13:10" /tmp/kw_test_focus
