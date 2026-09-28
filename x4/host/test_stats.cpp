// Care split test: a log written BEFORE the split (old keys for meds, meals and mood) must still read and count.
// Built against the real data.cpp with the host HAL (hal_host.cpp, its main renamed), run by test_legacy.sh:
//   KW_SD=<card folder with kw/log/2026-10.csv> ./test_stats
#include <stdio.h>
#include <string.h>
#include <math.h>
#include "../src/core/data.h"
#include "../src/hal/hal.h"

void appMain() {}  // hal_host.cpp's main calls it; unused here

static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while (0)

int main() {
  hal::begin();  // the host HAL reads KW_SD here
  // The keys are the history: the split must not rename, drop or re-type any of them.
  static const char* KEYS[] = {"spoons", "sleep", "anxiety", "shower", "teeth", "joy", "texted", "snack",
                               "med_am", "med_pm", "prn", "meal1", "meal2", "meal3", "mood"};
  for (int i = 0; i < BUILTIN_COUNT; i++) CHECK(!strcmp(ITEMS[i].key, KEYS[i]));
  // X4 items first, in the order the paper page reads; paper-owned keys hidden.
  for (int i = 0; i < SHOWN_BUILTINS; i++) CHECK(!ITEMS[i].hidden);
  for (int i = SHOWN_BUILTINS; i < BUILTIN_COUNT; i++) CHECK(ITEMS[i].hidden);
  CHECK(I_SPOONS == 0 && I_SLEEP == 1 && I_ANXIETY == 2 && I_SNACK == 7 && I_MOOD == 14);
  CHECK(!strcmp(ITEMS[I_SPOONS].label, "Spoons left"));
  CHECK(ITEMS[I_MOOD].lo == -3 && ITEMS[I_MOOD].hi == 3);  // old mood values still fit their scale

  DayLog d1, d3;
  loadDayLog("2026-10-01", d1);
  CHECK(d1.has(I_MED_AM) && d1.get(I_MED_AM) == 1 && d1.has(I_MED_PM) && d1.has(I_MEAL1) && d1.get(I_MOOD) == 2);
  CHECK(d1.orphans == 0);            // old keys are known keys, not "older custom entries"
  CHECK(d1.doneCount() == 2);        // care ticks only (shower, teeth): meds and meals are paper's now
  loadDayLog("2026-10-03", d3);
  CHECK(d3.stamps.size() == 1 && d3.stamps[0] == "1:05p");  // as-needed times still read

  MonthStats s; monthStats(2026, 10, s);
  CHECK(s.days == 31 && s.loggedDays == 3);
  CHECK(s.spoonsN == 2 && fabs(s.avgSpoons - 4.0) < 0.01 && s.goodSpoonDays == 1);
  CHECK(s.sleepN == 1 && fabs(s.avgSleep - 7.0) < 0.01);
  CHECK(s.anxietyN == 1 && fabs(s.avgAnxiety - 1.0) < 0.01);
  CHECK(s.showers == 1 && s.teeth == 1 && s.joy == 1 && s.texted == 1);
  // Read for history, not shown as Keeper boxes.
  CHECK(s.moodN == 2 && fabs(s.avgMood - 0.5) < 0.01);
  CHECK(s.medsBoth == 1 && s.medsAny == 3);
  CHECK(s.doneByDay[1] == 2 && s.doneByDay[2] == 2 && s.doneByDay[3] == 0);

  if (fails) { printf("%d failed\n", fails); return 1; }
  printf("ok: old-key logs still read and count\n");
  return 0;
}
