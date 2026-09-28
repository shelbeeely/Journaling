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
  int page = 0;                                  // printed page of this day in the paper book (0 = unknown)
};
bool loadDay(const std::string& date, Day& out);
// Build stamp ("2026-09-28") written into the header of every pack, support.txt and checkins.txt by
// tools/export_pack.py, and printed on the paper book's title page. Tries the pack for `ym`
// ("2026-10"), then support.txt, then checkins.txt. "" when the card has none.
std::string builtStamp(const std::string& ym = "");

// ---------- local time (Pacific) ----------
void timeInit();                                 // sets TZ to Pacific with DST
std::string dateStr(time_t t);                   // "2026-10-01" local
std::string clockStr(time_t t);                  // "8:05p"
std::string stampStr(time_t t);                  // "2026-10-01T20:05"
time_t nextLocalMidnight(time_t t, int minutesAfter = 1);
// The paper day starts when she wakes, not at midnight: check-ins made before DAY_STARTS_HOUR belong
// to the day just lived. logDay() is the date the Today and Check in screens open on.
static const int DAY_STARTS_HOUR = 4;
bool dayRolled(time_t t);                        // between 00:00 and DAY_STARTS_HOUR
std::string logDay(time_t t);                    // previous calendar day while dayRolled()
time_t nextDayStart(time_t t, int minutesAfter = 31);  // next DAY_STARTS_HOUR:minutesAfter (drift slack)
time_t dateNoon(const std::string& date);        // local noon of "YYYY-MM-DD" (0 if unparsable)
std::string addDays(const std::string& date, int n);
std::string prettyDate(const std::string& date); // "Thu, Oct 1"
std::string monthName(int m);                    // 1..12

// ---------- check-ins (/kw/log/YYYY-MM.csv, one line per change, last value wins) ----------
enum class Kind { Toggle, Scale, Count, Stamp, Dots, Choice };  // Dots: 0 empty, 1 half, 2 full; Choice: index of the picked option
// Choice options: at most CHOICE_MAX per item, at most CHOICE_LEN characters each (4 bytes of UTF-8 each at most, so OPT_BYTES holds 12 whole characters).
static const int CHOICE_MAX = 8, CHOICE_LEN = 12, OPT_BYTES = 49;
struct Item {
  const char* key; const char* label; int icon; Kind kind; int lo, hi, def; const char* group;  // icon -1 = generic dot
  bool hidden = false;  // paper-owned (the care split): kept so old logs still read, never shown on Check in or Today
  // Scale: lo..hi is what is stored (1..N, 0..N-1 or -k..+k, as printed on the paper block). Count: 0..hi.
  // Choice: lo = 0, hi = nopts - 1; the CSV log holds the option's TEXT, so history survives reordering the words.
  int nopts = 0; const char (*opts)[OPT_BYTES] = nullptr;
};
// The care split: paper keeps meds, meals, water and mood; the X4 keeps spoons left, sleep, anxiety and the care ticks.
// The 8 X4 built-ins come first, in the order the paper page reads (D5: spoons, sleep, anxiety, care ticks). The 7
// paper-owned keys (med_am, med_pm, prn, meal1-3, mood) stay in the table, hidden, so logs written before the split
// keep their keys and are still read for history and This month; nothing is renamed or migrated on the card.
// Then up to 16 custom items from /kw/checkins.txt. Static storage: loadCheckins() only rewrites fixed arrays.
enum BuiltinItem { I_SPOONS, I_SLEEP, I_ANXIETY, I_SHOWER, I_TEETH, I_JOY, I_TEXTED, I_SNACK,
                   I_MED_AM, I_MED_PM, I_PRN, I_MEAL1, I_MEAL2, I_MEAL3, I_MOOD };
static const int SHOWN_BUILTINS = 8, BUILTIN_COUNT = 15, MAX_CUSTOM = 16, MAX_ITEMS = BUILTIN_COUNT + MAX_CUSTOM;
extern Item ITEMS[MAX_ITEMS];
extern int ITEM_COUNT;
// Reads /kw/checkins.txt (one "@group" line per group, "key|label|kind|lo|hi|def[|opt1;opt2;...]" per item).
// Columns after the 7th and kinds it doesn't know are ignored (older firmware, newer file).
// Missing file or bad lines: those items are skipped, the built-ins always stay. Returns custom count.
int loadCheckins();

struct DayLog {
  std::string date;
  int value[32];            // per ITEMS index (MAX_ITEMS <= 32); INT32_MIN = not set
  std::vector<std::string> stamps;  // as-needed dose times
  int orphans = 0;          // distinct keys logged this day that no longer match any item (layout changed)
  bool has(int i) const;
  int get(int i) const;     // falls back to the item's default
  int doneCount() const;    // how many care ticks (shower, teeth, joy, texted, snack) are done today (Today strip, month dots)
};
void loadDayLog(const std::string& date, DayLog& out);
void saveItem(const std::string& date, int item, int value, time_t when);
void saveStamp(const std::string& date, time_t when);

// ---------- month totals for the Keeper handoff ----------
// What the X4 records now: spoons left (average, good-spoon days = 4+ left), sleep, anxiety, and the care ticks.
// Mood, meds and meals belong to the paper tracker; older logs may still hold them, so they are read too (moodN,
// avgMood, medsBoth, medsAny) for a quiet "earlier entries" line, never as Keeper boxes.
struct MonthStats {
  int days = 0, loggedDays = 0;
  float avgSpoons = 0, avgSleep = 0, avgAnxiety = 0; int spoonsN = 0, sleepN = 0, anxietyN = 0;
  int goodSpoonDays = 0, showers = 0, teeth = 0, joy = 0, texted = 0;
  float avgMood = 0; int moodN = 0, medsBoth = 0, medsAny = 0;  // from logs written before the split
  int doneByDay[32] = {0};  // care ticks done, per day of month
};
void monthStats(int year, int month, MonthStats& out);
