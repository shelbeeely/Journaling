// Focus timer arithmetic: the round/break schedule, catching up after a late wake (even one that lands after the
// 4 a.m. day roll), stale runs, and the month CSV counts. Built against the real data.cpp/focus.cpp with the host HAL.
#include <stdio.h>
#include <string.h>
#include "../src/core/focus.h"
#include "../src/hal/hal.h"

void appMain() {}
static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while (0)

static time_t at(const char* ymdhm) {  // local Pacific time
  struct tm tm = {}; sscanf(ymdhm, "%d-%d-%d %d:%d", &tm.tm_year, &tm.tm_mon, &tm.tm_mday, &tm.tm_hour, &tm.tm_min);
  tm.tm_year -= 1900; tm.tm_mon -= 1; tm.tm_isdst = -1; return mktime(&tm);
}
static const int MIN = 60;

int main() {
  hal::begin(); timeInit();
  FocusPlan p;  // 25 / 5, long break 15 after 4 rounds
  CHECK(p.work == 25 && p.brk == 5 && p.longBrk == 15 && p.rounds == 4);
  FocusRun r; FocusCredits c;

  // Schedule: W1 B1 W2 B2 W3 B3 W4 LB = 4*25 + 3*5 + 15 = 130 minutes.
  const time_t t0 = at("2026-10-14 13:10");
  focusStart(p, t0, r);
  CHECK(r.phase == FPhase::Work && r.round == 1 && r.end == t0 + 25 * MIN);
  focusAdvance(p, r, t0 + 25 * MIN - 1, c); CHECK(c.n == 0 && r.phase == FPhase::Work);          // not yet
  focusAdvance(p, r, t0 + 25 * MIN + 5, c);                                                      // the timer wake, 5 s late
  CHECK(c.n == 1 && !strcmp(c.day[0], "2026-10-14") && r.phase == FPhase::Break && r.round == 1 && r.end == t0 + 30 * MIN && !focusLong(p, r));
  c = FocusCredits(); focusAdvance(p, r, t0 + 30 * MIN + 5, c);
  CHECK(c.n == 0 && r.phase == FPhase::Work && r.round == 2 && r.end == t0 + 55 * MIN);          // breaks anchor to the schedule, not to the wake
  // Long break after round 4, then Done.
  focusStart(p, t0, r); c = FocusCredits(); focusAdvance(p, r, t0 + 100 * MIN + 5, c);
  CHECK(c.n == 3 && r.phase == FPhase::Work && r.round == 4);   // W1 W2 W3 finished, W4 running
  c = FocusCredits(); focusAdvance(p, r, t0 + 115 * MIN + 5, c);
  CHECK(c.n == 1 && r.phase == FPhase::Break && r.round == 4 && focusLong(p, r) && r.end == t0 + 130 * MIN);
  c = FocusCredits(); focusAdvance(p, r, t0 + 130 * MIN + 5, c);
  CHECK(c.n == 0 && r.phase == FPhase::Done);
  focusAdvance(p, r, t0 + 130 * MIN + (FOCUS_DONE_MIN + 1) * MIN, c);
  CHECK(r.phase == FPhase::Idle);                                                                 // Done clears itself

  // One late look (device asleep through several phases, all within the stale limit) catches up: 4 rounds, Done.
  focusStart(p, t0, r); c = FocusCredits(); focusAdvance(p, r, t0 + 131 * MIN, c);
  CHECK(c.n == 4 && r.phase == FPhase::Done);
  // Too late to vouch for (flat battery): nothing is credited and the run is dropped.
  focusStart(p, t0, r); c = FocusCredits(); focusAdvance(p, r, t0 + 25 * MIN + (FOCUS_STALE_MIN + 1) * MIN, c);
  CHECK(c.n == 0 && r.phase == FPhase::Idle);

  // The day rolls at 4 a.m.: a round that STARTED at 03:50 finishes at 04:15 and belongs to the day before.
  // The wake lands at 04:31, after the roll. The next round starts at 04:20 and belongs to the new day.
  const time_t s = at("2026-11-01 03:50");
  focusStart(p, s, r); c = FocusCredits(); focusAdvance(p, r, at("2026-11-01 04:31"), c);
  CHECK(c.n == 1 && !strcmp(c.day[0], "2026-10-31"));
  CHECK(r.phase == FPhase::Work && r.round == 2 && r.end == at("2026-11-01 04:45"));
  c = FocusCredits(); focusAdvance(p, r, at("2026-11-01 04:50"), c);
  CHECK(c.n == 1 && !strcmp(c.day[0], "2026-11-01"));
  // The sleep screen's own wake still targets 4:31 a.m. (existing behaviour, unchanged).
  CHECK(nextDayStart(at("2026-11-01 04:20")) == at("2026-11-01 04:31") && nextDayStart(at("2026-11-01 04:40")) == at("2026-11-02 04:31"));
  // Daylight saving: 25 minutes is 25 minutes on the night the clocks change (2026-11-01 02:00 PDT -> 01:00 PST).
  focusStart(p, at("2026-11-01 00:50"), r); CHECK(r.end == at("2026-11-01 00:50") + 25 * MIN);

  // Different settings: 45 / 10, 2 rounds.
  FocusPlan q; q.work = 45; q.brk = 10; q.rounds = 2;
  focusStart(q, t0, r); c = FocusCredits(); focusAdvance(q, r, t0 + 45 * MIN + 1, c);
  CHECK(c.n == 1 && r.phase == FPhase::Break && r.end == t0 + 55 * MIN && !focusLong(q, r));
  c = FocusCredits(); focusAdvance(q, r, t0 + 100 * MIN + 1, c);
  CHECK(c.n == 1 && focusLong(q, r) && r.end == t0 + 115 * MIN);

  // Save / load round trip, and bad files fall back to defaults.
  focusStart(p, t0, r); r.interruptions = 2; focusSave(q, r);
  FocusPlan lp; FocusRun lr; focusLoad(lp, lr);
  CHECK(lp.work == 45 && lp.brk == 10 && lp.rounds == 2 && lr.phase == FPhase::Work && lr.round == 1 && lr.end == r.end && lr.interruptions == 2);
  hal::writeFile("/kw/focus.txt", "plan=999,0,x\nrun=Q,9\n");
  focusLoad(lp, lr); CHECK(lp.work == 25 && lp.brk == 5 && lr.phase == FPhase::Idle);

  // Counts in the month CSV: last value wins, filed under the stable keys; the keys are not "older custom entries".
  CHECK(!strcmp(KEY_FOCUS_ROUNDS, "focus_rounds") && !strcmp(KEY_FOCUS_INTERRUPTIONS, "focus_interruptions"));
  hal::writeFile("/kw/log/2026-10.csv", "");
  FocusCredits two; two.n = 2; strcpy(two.day[0], "2026-10-14"); strcpy(two.day[1], "2026-10-14");
  focusLogRounds(two, t0); focusLogInterruption(t0);
  CHECK(loggedCount("2026-10-14", KEY_FOCUS_ROUNDS) == 2 && loggedCount("2026-10-14", KEY_FOCUS_INTERRUPTIONS) == 1);
  focusLogInterruption(at("2026-10-15 02:10"));  // 2:10 a.m. still belongs to Oct 14
  CHECK(loggedCount("2026-10-14", KEY_FOCUS_INTERRUPTIONS) == 2 && loggedCount("2026-10-15", KEY_FOCUS_INTERRUPTIONS) == 0);
  DayLog dl; loadDayLog("2026-10-14", dl); CHECK(dl.orphans == 0);
  MonthStats ms; monthStats(2026, 10, ms);
  CHECK(ms.focusRounds == 2 && ms.focusInterruptions == 2 && ms.focusDays == 1 && ms.loggedDays == 0);  // a focus-only day is not a check-in day

  if (fails) { printf("%d failed\n", fails); return 1; }
  printf("ok: focus rounds, wakes, day roll, stale runs, counts\n");
  return 0;
}
