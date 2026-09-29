#pragma once
// Focus timer: round/break arithmetic and persistence. No drawing, no buttons, so the host test can run it.
// A session is W1 B1 W2 B2 ... Wn LB: `rounds` work rounds, a short break after each but the last, then one long break.
// The X4 draws each phase ONCE and deep-sleeps until its end (no sound, no per-minute refresh), so the run is
// stored on the card (/kw/focus.txt) and walked forward from the wall clock whenever the device wakes.
#include <stdint.h>
#include <time.h>
#include <string>
#include "data.h"

struct FocusPlan { int work = 25, brk = 5, longBrk = 15, rounds = 4; };
enum class FPhase : uint8_t { Idle, Work, Break, Done };
struct FocusRun {
  FPhase phase = FPhase::Idle;
  int round = 0;              // 1..rounds; a Break with round == rounds is the long break
  time_t end = 0;             // when this phase ends (UTC)
  int interruptions = 0;      // this session
};
// A phase that ended more than this long before the device looked (flat battery, card out) is not credited: the
// session is dropped instead of counting rounds nobody can vouch for. Done clears itself after the same time.
static const int FOCUS_STALE_MIN = 120, FOCUS_DONE_MIN = 30;
static const int FOCUS_WORK_MIN = 5, FOCUS_WORK_MAX = 90, FOCUS_BREAK_MIN = 1, FOCUS_BREAK_MAX = 30;

struct FocusCredits { int n = 0; char day[4][11] = {}; };  // work rounds finished by a call, each filed under the day it STARTED (4 a.m. rule)

void focusStart(const FocusPlan& p, time_t now, FocusRun& r);
// Walks the run forward to `now`, catching up any phases whose end has passed. Credits go to `out`.
void focusAdvance(const FocusPlan& p, FocusRun& r, time_t now, FocusCredits& out);
inline bool focusActive(const FocusRun& r) { return r.phase == FPhase::Work || r.phase == FPhase::Break; }
inline bool focusLong(const FocusPlan& p, const FocusRun& r) { return r.phase == FPhase::Break && r.round >= p.rounds; }

// Files the credits and interruptions in the month CSV under focus_rounds / focus_interruptions (data.h).
void focusLogRounds(const FocusCredits& c, time_t when);
void focusLogInterruption(time_t when);   // filed under logDay(when)

// /kw/focus.txt: "plan=25,5,15,4" and "run=W,2,<end epoch>,<interruptions>". Missing or bad = defaults / idle.
void focusSave(const FocusPlan& p, const FocusRun& r);
void focusLoad(FocusPlan& p, FocusRun& r);
