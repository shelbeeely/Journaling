#!/bin/sh
# Care split test: a check-in log written before the split (old keys for meds, meals and mood) still counts.
# Builds test_stats.cpp against the real data.cpp with the host HAL, feeds it an old-style log, checks the numbers.
set -e
cd "$(dirname "$0")"
D=/tmp/kwsd-legacy; rm -rf $D; mkdir -p $D/kw/log
cat > $D/kw/log/2026-10.csv <<'EOF'
# a log from before the care split: every key is one the old firmware wrote
2026-10-01T08:00,med_am,1
2026-10-01T20:00,med_pm,1
2026-10-01T13:00,meal1,1
2026-10-01T21:00,mood,2
2026-10-01T21:00,spoons,5
2026-10-01T08:30,sleep,7
2026-10-01T21:00,anxiety,1
2026-10-01T16:00,shower,1
2026-10-01T10:00,teeth,1
2026-10-02T09:00,med_am,1
2026-10-02T21:00,mood,-1
2026-10-02T21:00,spoons,3
2026-10-02T18:00,joy,1
2026-10-02T19:00,texted,1
2026-10-03T20:00,med_pm,1
2026-10-03T13:05,prn,1:05p
EOF
F="-std=gnu++17 -O1 -Wall -Wno-unused-function -Wno-format-truncation"
g++ $F -Wno-return-type -Dmain=kw_host_main -c -o /tmp/kw_hal_host.o hal_host.cpp   # hal_host.cpp's own main is not wanted here
g++ $F -o /tmp/kw_test_stats test_stats.cpp ../src/core/data.cpp /tmp/kw_hal_host.o
KW_SD=$D KW_OUT=/tmp/kwsd-legacy-out KW_NOW="2026-10-14 13:10" /tmp/kw_test_stats
