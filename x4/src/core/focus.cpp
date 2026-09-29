#include "focus.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../hal/hal.h"

void focusStart(const FocusPlan& p, time_t now, FocusRun& r) {
  r = FocusRun(); r.phase = FPhase::Work; r.round = 1; r.end = now + p.work * 60;
}

void focusAdvance(const FocusPlan& p, FocusRun& r, time_t now, FocusCredits& out) {
  while (focusActive(r) && now >= r.end) {
    if (now - r.end > FOCUS_STALE_MIN * 60) { r = FocusRun(); return; }  // too long ago to vouch for
    if (r.phase == FPhase::Work) {
      if (out.n < 4) {
        const std::string d = logDay(r.end - p.work * 60);  // the day the round started
        strncpy(out.day[out.n], d.c_str(), 10); out.day[out.n][10] = 0; out.n++;
      }
      r.phase = FPhase::Break; r.end += (r.round >= p.rounds ? p.longBrk : p.brk) * 60;
    } else if (r.round >= p.rounds) {
      r.phase = FPhase::Done; // r.end stays: when the long break finished
    } else {
      r.phase = FPhase::Work; r.round++; r.end += p.work * 60;
    }
  }
  if (r.phase == FPhase::Done && now - r.end > FOCUS_DONE_MIN * 60) r = FocusRun();
}

void focusLogRounds(const FocusCredits& c, time_t when) {
  for (int i = 0; i < c.n; i++) {
    const std::string d = c.day[i];
    logCount(d, KEY_FOCUS_ROUNDS, loggedCount(d, KEY_FOCUS_ROUNDS) + 1, when);
  }
}
void focusLogInterruption(time_t when) {
  const std::string d = logDay(when);
  logCount(d, KEY_FOCUS_INTERRUPTIONS, loggedCount(d, KEY_FOCUS_INTERRUPTIONS) + 1, when);
}

void focusSave(const FocusPlan& p, const FocusRun& r) {
  char b[128]; const char ph = r.phase == FPhase::Work ? 'W' : r.phase == FPhase::Break ? 'B' : r.phase == FPhase::Done ? 'D' : 'I';
  snprintf(b, sizeof b, "plan=%d,%d,%d,%d\nrun=%c,%d,%lld,%d\n", p.work, p.brk, p.longBrk, p.rounds, ph, r.round, (long long)r.end, r.interruptions);
  hal::writeFile("/kw/focus.txt", b);
}
static int clampi(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }
void focusLoad(FocusPlan& p, FocusRun& r) {
  p = FocusPlan(); r = FocusRun();
  std::string f;
  if (!hal::readFile("/kw/focus.txt", f)) return;
  int w, b, l, n; char ph; int rd, in; long long e;
  const char* pl = strstr(f.c_str(), "plan=");
  if (pl && sscanf(pl, "plan=%d,%d,%d,%d", &w, &b, &l, &n) == 4) {
    p.work = clampi(w, FOCUS_WORK_MIN, FOCUS_WORK_MAX); p.brk = clampi(b, FOCUS_BREAK_MIN, FOCUS_BREAK_MAX);
    p.longBrk = clampi(l, FOCUS_BREAK_MIN, 60); p.rounds = clampi(n, 1, 4);
  }
  const char* ru = strstr(f.c_str(), "run=");
  if (ru && sscanf(ru, "run=%c,%d,%lld,%d", &ph, &rd, &e, &in) == 4 && rd >= 1 && rd <= p.rounds && (ph == 'W' || ph == 'B' || ph == 'D')) {
    r.phase = ph == 'W' ? FPhase::Work : ph == 'B' ? FPhase::Break : FPhase::Done; r.round = rd; r.end = (time_t)e; r.interruptions = in < 0 ? 0 : in;
  }
}
