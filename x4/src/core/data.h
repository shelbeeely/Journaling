#pragma once
#include <string>
#include <vector>
#include <time.h>

// ---------- day pack (/kw/YYYY-MM.txt, written by tools/export_pack.py) ----------
struct Day {
  bool ok = false;
  std::string date, weekday, planet;             // "2026-10-01", "Thursday", "♃ Jupiter"
  float moonDeg = 0; int lit = 0;
  std::string phase, moonSign, moonIn;           // "Waning Gibbous", "♊ Gemini", "♋ Cancer 12:54p"
  std::string rise, set, daylight, sunSign;
  std::string season, seasonNote, newSeason;     // Spokane micro-season
  std::vector<std::string> notes, events, routines;  // notes starting with '!' are holidays
  std::string fact, prompt;
  std::string pioneer[4];                        // name, years, what, useless fact
};
bool loadDay(const std::string& date, Day& out);

// ---------- local time (Pacific) ----------
void timeInit();                                 // sets TZ to Pacific with DST
std::string dateStr(time_t t);                   // "2026-10-01" local
std::string clockStr(time_t t);                  // "8:05p"
std::string stampStr(time_t t);                  // "2026-10-01T20:05"
time_t nextLocalMidnight(time_t t, int minutesAfter = 1);
std::string addDays(const std::string& date, int n);
std::string prettyDate(const std::string& date); // "Thu, Oct 1"
std::string monthName(int m);                    // 1..12

// ---------- check-ins (/kw/log/YYYY-MM.csv, one line per change, last value wins) ----------
enum class Kind { Toggle, Scale, Count, Stamp, Dots };  // Dots: 0 empty, 1 half, 2 full
struct Item {
  const char* key; const char* label; int icon; Kind kind; int lo, hi, def; const char* group;  // icon -1 = generic dot
};
// The 15 built-ins (same order as the paper page), then up to 16 custom items from /kw/checkins.txt.
// Static storage: loadCheckins() only rewrites fixed arrays, it never allocates for the list.
static const int BUILTIN_COUNT = 15, MAX_CUSTOM = 16, MAX_ITEMS = BUILTIN_COUNT + MAX_CUSTOM;
extern Item ITEMS[MAX_ITEMS];
extern int ITEM_COUNT;
// Reads /kw/checkins.txt (one "@group" line per group, "key|label|kind|lo|hi|def" per item).
// Missing file or bad lines: those items are skipped, the built-ins always stay. Returns custom count.
int loadCheckins();

struct DayLog {
  std::string date;
  int value[32];            // per ITEMS index (MAX_ITEMS <= 32); INT32_MIN = not set
  std::vector<std::string> stamps;  // as-needed dose times
  bool has(int i) const;
  int get(int i) const;     // falls back to the item's default
  int doneCount() const;    // how many built-in care items are done today (Today strip, month dots)
};
void loadDayLog(const std::string& date, DayLog& out);
void saveItem(const std::string& date, int item, int value, time_t when);
void saveStamp(const std::string& date, time_t when);

// ---------- month totals for the Keeper handoff ----------
struct MonthStats {
  int days = 0, loggedDays = 0;
  float avgMood = 0, avgSleep = 0; int moodN = 0, sleepN = 0;
  int showers = 0, medsBoth = 0, medsAny = 0, goodSpoonDays = 0, joy = 0, texted = 0;
  int doneByDay[32] = {0};  // care items done, per day of month
};
void monthStats(int year, int month, MonthStats& out);
