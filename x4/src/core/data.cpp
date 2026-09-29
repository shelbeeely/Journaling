#include "data.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <algorithm>
#include "../hal/hal.h"
#include "../gen/assets.h"

// ---------- time ----------
std::string addDays(const std::string& date, int n);
void timeInit() {
  setenv("TZ", "PST8PDT,M3.2.0,M11.1.0", 1);  // Pacific, US DST rules
  tzset();
}
static struct tm local(time_t t) { struct tm tm; localtime_r(&t, &tm); return tm; }
std::string dateStr(time_t t) { char b[16]; struct tm tm = local(t); strftime(b, sizeof b, "%Y-%m-%d", &tm); return b; }
std::string stampStr(time_t t) { char b[24]; struct tm tm = local(t); strftime(b, sizeof b, "%Y-%m-%dT%H:%M", &tm); return b; }
std::string clockStr(time_t t) {
  struct tm tm = local(t); char b[12];
  snprintf(b, sizeof b, "%d:%02d%c", tm.tm_hour % 12 ? tm.tm_hour % 12 : 12, tm.tm_min, tm.tm_hour < 12 ? 'a' : 'p');
  return b;
}
time_t nextLocalMidnight(time_t t, int minutesAfter) {
  struct tm tm = local(t);
  tm.tm_mday += 1; tm.tm_hour = 0; tm.tm_min = minutesAfter; tm.tm_sec = 0; tm.tm_isdst = -1;
  return mktime(&tm);
}
bool dayRolled(time_t t) { return local(t).tm_hour < DAY_STARTS_HOUR; }
std::string logDay(time_t t) { return dayRolled(t) ? addDays(dateStr(t), -1) : dateStr(t); }
time_t nextDayStart(time_t t, int minutesAfter) {
  struct tm tm = local(t);
  if (tm.tm_hour * 60 + tm.tm_min >= DAY_STARTS_HOUR * 60 + minutesAfter) tm.tm_mday += 1;
  tm.tm_hour = DAY_STARTS_HOUR; tm.tm_min = minutesAfter; tm.tm_sec = 0; tm.tm_isdst = -1;
  return mktime(&tm);
}
static bool parseDate(const std::string& d, struct tm& tm) {
  memset(&tm, 0, sizeof tm);
  if (sscanf(d.c_str(), "%d-%d-%d", &tm.tm_year, &tm.tm_mon, &tm.tm_mday) != 3) return false;
  tm.tm_year -= 1900; tm.tm_mon -= 1; tm.tm_hour = 12; tm.tm_isdst = -1;
  return true;
}
std::string addDays(const std::string& date, int n) {
  struct tm tm; if (!parseDate(date, tm)) return date;
  tm.tm_mday += n; time_t t = mktime(&tm); return dateStr(t);
}
time_t dateNoon(const std::string& date) {
  struct tm tm; if (!parseDate(date, tm)) return 0;
  return mktime(&tm);
}
std::string monthName(int m) {
  static const char* M[] = {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"};
  return (m >= 1 && m <= 12) ? M[m - 1] : "";
}
std::string prettyDate(const std::string& date) {
  struct tm tm; if (!parseDate(date, tm)) return date;
  mktime(&tm);
  static const char* W[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  char b[32]; snprintf(b, sizeof b, "%s, %.3s %d", W[tm.tm_wday], monthName(tm.tm_mon + 1).c_str(), tm.tm_mday);
  return b;
}

// ---------- day pack ----------
static std::vector<std::string> split(const std::string& s, char sep) {
  std::vector<std::string> v; size_t a = 0;
  for (;;) { size_t b = s.find(sep, a); v.push_back(s.substr(a, b == std::string::npos ? std::string::npos : b - a)); if (b == std::string::npos) break; a = b + 1; }
  return v;
}

// "# ... · built 2026-09-28" on the first line of a card file.
static std::string stampOf(const char* path) {
  std::string f; if (!hal::readFile(path, f)) return "";
  const size_t nl = f.find('\n'), p = f.find(" built ");
  if (p == std::string::npos || p > nl || p + 17 > f.size()) return "";
  std::string s = f.substr(p + 7, 10);
  return (s.size() == 10 && s[4] == '-' && s[7] == '-') ? s : "";
}
std::string builtStamp(const std::string& ym) {
  std::string s;
  if (ym.size() == 7) s = stampOf(("/kw/" + ym + ".txt").c_str());
  if (s.empty()) s = stampOf("/kw/support.txt");
  if (s.empty()) s = stampOf("/kw/checkins.txt");
  return s;
}

bool loadDay(const std::string& date, Day& d) {
  d = Day();
  std::string pack;
  const std::string path = "/kw/" + date.substr(0, 7) + ".txt";
  if (!hal::readFile(path.c_str(), pack)) return false;
  const std::string tag = "@" + date + "\n";
  size_t p = pack.find(tag);
  if (p == std::string::npos) return false;
  p += tag.size();
  size_t end = pack.find("\n@", p);
  if (end == std::string::npos) end = pack.size();
  d.ok = true; d.date = date;
  size_t a = p;
  while (a < end) {
    size_t b = pack.find('\n', a); if (b == std::string::npos || b > end) b = end;
    std::string line = pack.substr(a, b - a); a = b + 1;
    size_t eq = line.find('='); if (eq == std::string::npos) continue;
    std::string k = line.substr(0, eq), v = line.substr(eq + 1);
    if (k == "wd") d.weekday = v;
    else if (k == "planet") d.planet = v;
    else if (k == "moon") { auto f = split(v, '|'); if (f.size() >= 4) { d.moonDeg = atof(f[0].c_str()); d.lit = atoi(f[1].c_str()); d.phase = f[2]; d.moonSign = f[3]; } }
    else if (k == "moonin") d.moonIn = v;
    else if (k == "sun") { auto f = split(v, '|'); if (f.size() >= 4) { d.rise = f[0]; d.set = f[1]; d.daylight = f[2]; d.sunSign = f[3]; } }
    else if (k == "season") { auto f = split(v, '|'); d.season = f[0]; if (f.size() > 1) d.seasonNote = f[1]; }
    else if (k == "newseason") d.newSeason = v;
    else if (k == "note") d.notes.push_back(v);
    else if (k == "ev") d.events.push_back(v);
    else if (k == "rt") d.routines.push_back(v);
    else if (k == "page") d.page = atoi(v.c_str());
    else if (k == "fact") d.fact = v;
    else if (k == "prompt") d.prompt = v;
    else if (k == "pioneer") { auto f = split(v, '|'); for (int i = 0; i < 4 && i < (int)f.size(); i++) d.pioneer[i] = f[i]; }
  }
  return true;
}

// ---------- check-in items ----------
// X4 built-ins first (order = the paper page's reading order after the split), then the paper-owned keys, hidden.
Item ITEMS[MAX_ITEMS] = {
  {"spoons", "Spoons left", IC_SPOON, Kind::Count, 0, 12, 12, "Energy"},
  {"sleep", "Sleep (hours)", IC_SLEEP, Kind::Count, 0, 14, 7, "Energy"},
  {"anxiety", "Anxiety", IC_ANX, Kind::Scale, 0, 3, 0, "Feel"},
  {"shower", "Shower", IC_SHOWER, Kind::Toggle, 0, 1, 0, "Care"},
  {"teeth", "Teeth", IC_TEETH, Kind::Toggle, 0, 1, 0, "Care"},
  {"joy", "Did something I enjoy", IC_JOY, Kind::Toggle, 0, 1, 0, "Care"},
  {"texted", "Texted someone", IC_TEXT, Kind::Toggle, 0, 1, 0, "Care"},
  {"snack", "Snack", IC_SNACK, Kind::Toggle, 0, 1, 0, "Care"},
  // Paper-owned since the care split. Same keys as always, so old logs still count.
  {"med_am", "Morning meds", IC_AM, Kind::Toggle, 0, 1, 0, "Meds", true},
  {"med_pm", "Evening meds", IC_PM, Kind::Toggle, 0, 1, 0, "Meds", true},
  {"prn", "As-needed dose", IC_PRN, Kind::Stamp, 0, 0, 0, "Meds", true},
  {"meal1", "Meal 1", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food", true},
  {"meal2", "Meal 2", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food", true},
  {"meal3", "Meal 3", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food", true},
  {"mood", "Mood", IC_MID, Kind::Scale, -3, 3, 0, "Feel", true},
};
int ITEM_COUNT = BUILTIN_COUNT;

// ---------- custom check-ins (/kw/checkins.txt, written by tools/export_pack.py) ----------
static char CKEY[MAX_CUSTOM][65], CLABEL[MAX_CUSTOM][48], CGROUP[MAX_CUSTOM][40];
// Choice option text, pooled: every choice item takes its options from here in order (8 per item at most).
static char COPT[MAX_CUSTOM * CHOICE_MAX][OPT_BYTES];

// Copies at most n-1 bytes without cutting a UTF-8 sequence in half.
static void copyField(char* dst, int n, const char* s, int len) {
  if (len > n - 1) { len = n - 1; while (len > 0 && ((unsigned char)s[len] & 0xC0) == 0x80) len--; }
  memcpy(dst, s, len); dst[len] = 0;
}
static bool parseInt(const char* s, int len, int& out) {
  if (len <= 0 || len > 6) return false;
  char b[8]; memcpy(b, s, len); b[len] = 0;
  char* e; const long v = strtol(b, &e, 10);
  if (*e) return false;
  out = (int)v; return true;
}
static bool keyTaken(const char* k, int upto) {
  if (!strcmp(k, "prn_undo")) return true;
  for (int i = 0; i < upto; i++) if (!strcmp(k, ITEMS[i].key)) return true;
  return false;
}

int loadCheckins() {
  ITEM_COUNT = BUILTIN_COUNT;
  std::string f;
  if (!hal::readFile("/kw/checkins.txt", f)) return 0;
  const char* group = "";  // items before any @line get a separator but no heading
  const char* pending = nullptr; int pendingLen = 0, groups = 0, opts = 0;  // opts: used rows of COPT
  size_t a = 0;
  while (a < f.size() && ITEM_COUNT < MAX_ITEMS) {
    size_t b = f.find('\n', a); if (b == std::string::npos) b = f.size();
    const char* line = f.c_str() + a; int len = (int)(b - a); a = b + 1;
    while (len > 0 && (line[len - 1] == '\r' || line[len - 1] == ' ')) len--;
    if (len == 0 || line[0] == '#') continue;
    if (line[0] == '@') { pending = line + 1; pendingLen = len - 1; continue; }
    // key|label|kind|lo|hi|def|options  (anything after the 7th column is ignored)
    const char* fs[7]; int fl[7], nf = 0; const char* p = line; const char* end = line + len;
    while (nf < 7) {
      const char* q = (const char*)memchr(p, '|', end - p); if (!q) q = end;
      fs[nf] = p; fl[nf] = (int)(q - p); nf++;
      if (q == end) break;
      p = q + 1;
    }
    if (nf < 3 || fl[0] < 1 || fl[0] > 64 || fl[1] < 1) continue;
    bool ok = true;
    // Keys are opaque, but they go into the CSV log: printable ASCII with no comma or space.
    for (int i = 0; i < fl[0]; i++) { const char c = fs[0][i]; ok &= c > ' ' && c < 127 && c != ','; }
    const int n = ITEM_COUNT - BUILTIN_COUNT;
    copyField(CKEY[n], sizeof CKEY[n], fs[0], fl[0]);
    if (!ok || keyTaken(CKEY[n], ITEM_COUNT)) continue;
    const std::string kind(fs[2], fl[2]);
    int lo = 0, hi = 1, def = 0;
    const bool hasLo = nf > 3 && parseInt(fs[3], fl[3], lo), hasHi = nf > 4 && parseInt(fs[4], fl[4], hi);
    if (nf > 5 && !parseInt(fs[5], fl[5], def)) def = 0;
    Item it = {CKEY[n], CLABEL[n], -1, Kind::Toggle, 0, 1, 0, group};
    if (kind == "toggle") { it.kind = Kind::Toggle; lo = 0; hi = 1; }
    else if (kind == "dots") { it.kind = Kind::Dots; lo = 0; hi = 2; }
    else if (kind == "count") { it.kind = Kind::Count; lo = 0; if (!hasHi) hi = 99; if (hi < 1 || hi > 999) continue; }  // hi = the most it counts to
    else if (kind == "scale") { it.kind = Kind::Scale; if (!hasLo || !hasHi || hi <= lo || hi - lo > 10) continue; }  // up to 11 steps: 0..10, -5..+5
    else if (kind == "choice") {
      // Options come from the 7th column, ';'-separated. Empty ones are skipped; 2..8 are needed, all different, or the item is skipped.
      if (nf < 7) continue;
      it.kind = Kind::Choice; it.opts = COPT + opts; int no = 0; bool bad = false;
      const char* q = fs[6]; const char* qe = fs[6] + fl[6];
      while (q <= qe && !bad) {
        const char* sc = (const char*)memchr(q, ';', qe - q); if (!sc) sc = qe;
        int ol = (int)(sc - q);
        while (ol > 0 && q[0] == ' ') { q++; ol--; }
        while (ol > 0 && q[ol - 1] == ' ') ol--;
        if (ol > 0) {
          if (no >= CHOICE_MAX || opts + no >= MAX_CUSTOM * CHOICE_MAX) { bad = true; break; }
          char* dst = COPT[opts + no];
          int chars = 0, bytes = 0;  // at most CHOICE_LEN characters, never cutting a UTF-8 sequence
          for (int k = 0; k < ol && bytes < OPT_BYTES - 1; k++) {
            const unsigned char c = (unsigned char)q[k];
            if ((c & 0xC0) != 0x80) { if (chars == CHOICE_LEN) break; chars++; }
            dst[bytes++] = (c < ' ' || c == ',') ? ' ' : (char)c;  // the option is written to the CSV log as it is: no commas or control characters
          }
          dst[bytes] = 0;
          for (int k = 0; k < no; k++) if (!strcmp(COPT[opts + k], dst)) bad = true;  // duplicates would make the log ambiguous
          no++;
        }
        q = sc + 1;
      }
      if (bad || no < 2) continue;
      it.nopts = no; lo = 0; hi = no - 1;
    }
    else continue;
    it.lo = lo; it.hi = hi; it.def = def < lo ? lo : def > hi ? hi : def;
    if (pending) {  // the group heading is stored once, when its first item arrives
      copyField(CGROUP[groups], sizeof CGROUP[groups], pending, pendingLen);
      group = CGROUP[groups++]; it.group = group; pending = nullptr;
    }
    copyField(CLABEL[n], sizeof CLABEL[n], fs[1], fl[1]);
    opts += it.nopts;
    ITEMS[ITEM_COUNT++] = it;
  }
  return ITEM_COUNT - BUILTIN_COUNT;
}

bool DayLog::has(int i) const { return value[i] != INT_MIN; }
int DayLog::get(int i) const { return has(i) ? value[i] : ITEMS[i].def; }
int DayLog::doneCount() const {
  int n = 0;
  for (int i = 0; i < BUILTIN_COUNT; i++) if (!ITEMS[i].hidden && ITEMS[i].kind == Kind::Toggle && has(i) && value[i]) n++;
  return n;
}

// A logged value as the item's number. Choice rows hold the option's text; a text no option has any more
// (the words were edited) is INT_MIN: unset on screen, still in the CSV.
static int parseValue(int i, const std::string& v) {
  const Item& it = ITEMS[i];
  if (it.kind != Kind::Choice) return atoi(v.c_str());
  for (int k = 0; k < it.nopts; k++) if (v == it.opts[k]) return k;
  return INT_MIN;
}
static int itemIndex(const std::string& k) {
  for (int i = 0; i < ITEM_COUNT; i++) if (k == ITEMS[i].key) return i;
  return -1;
}

// Parses every line of a month log into per-day logs via a callback (the log is small: ~40 lines/day).
template <typename F> static void scanLog(const std::string& ym, F&& f) {
  std::string log;
  if (!hal::readFile(("/kw/log/" + ym + ".csv").c_str(), log)) return;
  size_t a = 0;
  while (a < log.size()) {
    size_t b = log.find('\n', a); if (b == std::string::npos) b = log.size();
    std::string line = log.substr(a, b - a); a = b + 1;
    auto c = split(line, ',');
    if (c.size() < 3 || c[0].size() < 10 || c[0][0] == '#') continue;
    f(c[0].substr(0, 10), c[0], c[1], c[2]);
  }
}

void loadDayLog(const std::string& date, DayLog& out) {
  out.date = date; out.stamps.clear(); out.orphans = 0;
  for (int i = 0; i < 32; i++) out.value[i] = INT_MIN;
  std::vector<std::string> old;  // keys from an earlier layout: kept in the log, counted so they are never invisible
  scanLog(date.substr(0, 7), [&](const std::string& d, const std::string& ts, const std::string& k, const std::string& v) {
    if (d != date) return;
    if (k == "prn") { out.stamps.push_back(v); return; }
    if (k == "prn_undo") { if (!out.stamps.empty()) out.stamps.pop_back(); return; }
    if (k.compare(0, 6, "focus_") == 0) return;  // the Focus timer's counts (core/focus.h): known keys, not check-ins
    const int i = itemIndex(k);
    if (i >= 0) {
      const int x = parseValue(i, v);
      if (x != INT_MIN) out.value[i] = x;
      else if (std::find(old.begin(), old.end(), k + "=" + v) == old.end()) old.push_back(k + "=" + v);  // a word she has since removed
    }
    else if (std::find(old.begin(), old.end(), k) == old.end()) old.push_back(k);
  });
  out.orphans = (int)old.size();
}

void saveItem(const std::string& date, int item, int value, time_t when) {
  // The row is stamped with the moment of the tap but keyed to the day being logged, so a
  // late-night "morning meds" for yesterday lands on yesterday.
  const Item& it = ITEMS[item];
  const std::string v = it.kind == Kind::Choice && value >= 0 && value < it.nopts ? std::string(it.opts[value]) : std::to_string(value);
  std::string line = date + stampStr(when).substr(10) + "," + it.key + "," + v;
  hal::appendLine(("/kw/log/" + date.substr(0, 7) + ".csv").c_str(), line);
}
int loggedCount(const std::string& date, const char* key) {
  int v = 0;
  scanLog(date.substr(0, 7), [&](const std::string& d, const std::string&, const std::string& k, const std::string& val) {
    if (d == date && k == key) v = atoi(val.c_str());  // last value wins
  });
  return v;
}
void logCount(const std::string& date, const char* key, int value, time_t when) {
  hal::appendLine(("/kw/log/" + date.substr(0, 7) + ".csv").c_str(), date + stampStr(when).substr(10) + "," + key + "," + std::to_string(value));
}
void saveStamp(const std::string& date, time_t when) {
  std::string line = date + stampStr(when).substr(10) + ",prn," + clockStr(when);
  hal::appendLine(("/kw/log/" + date.substr(0, 7) + ".csv").c_str(), line);
}

// ---------- month totals ----------
void monthStats(int year, int month, MonthStats& s) {
  s = MonthStats();
  char ym[8]; snprintf(ym, sizeof ym, "%04d-%02d", year, month);
  static const int DIM[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  s.days = DIM[month - 1] + (month == 2 && year % 4 == 0 ? 1 : 0);
  static DayLog L[32];  // static: ~5 KB would overflow the 8 KB loop-task stack
  bool seen[32] = {false};
  static int FR[32], FI[32];  // Focus counts per day (static, like L)
  for (int d = 0; d < 32; d++) FR[d] = FI[d] = 0;
  for (int d = 1; d <= s.days; d++) { L[d].date = ""; for (int i = 0; i < 32; i++) L[d].value[i] = INT_MIN; }
  scanLog(ym, [&](const std::string& d, const std::string&, const std::string& k, const std::string& v) {
    const int dd = atoi(d.c_str() + 8); if (dd < 1 || dd > 31) return;
    if (!strcmp(k.c_str(), KEY_FOCUS_ROUNDS)) { FR[dd] = atoi(v.c_str()); return; }         // last value of the day wins
    if (!strcmp(k.c_str(), KEY_FOCUS_INTERRUPTIONS)) { FI[dd] = atoi(v.c_str()); return; }
    if (k.compare(0, 6, "focus_") == 0) return;
    seen[dd] = true;
    const int i = itemIndex(k); if (i >= 0) { const int x = parseValue(i, v); if (x != INT_MIN) L[dd].value[i] = x; }
  });
  float spoons = 0, sleep = 0, anxiety = 0, mood = 0;
  for (int d = 1; d <= s.days; d++) {
    if (!seen[d]) continue;
    s.loggedDays++;
    const DayLog& l = L[d];
    auto on = [&](int i) { return l.has(i) && l.value[i]; };
    if (l.has(I_SPOONS)) { spoons += l.value[I_SPOONS]; s.spoonsN++; if (l.value[I_SPOONS] >= 4) s.goodSpoonDays++; }
    if (l.has(I_SLEEP)) { sleep += l.value[I_SLEEP]; s.sleepN++; }
    if (l.has(I_ANXIETY)) { anxiety += l.value[I_ANXIETY]; s.anxietyN++; }
    if (on(I_SHOWER)) s.showers++;
    if (on(I_TEETH)) s.teeth++;
    if (on(I_JOY)) s.joy++;
    if (on(I_TEXTED)) s.texted++;
    // Paper-owned keys from logs written before the split: still read, only shown as a quiet note.
    if (l.has(I_MOOD)) { mood += l.value[I_MOOD]; s.moodN++; }
    if (on(I_MED_AM) && on(I_MED_PM)) s.medsBoth++;
    if (on(I_MED_AM) || on(I_MED_PM)) s.medsAny++;
    s.doneByDay[d] = l.doneCount();
  }
  for (int d = 1; d <= s.days; d++) { s.focusRounds += FR[d]; s.focusInterruptions += FI[d]; if (FR[d]) s.focusDays++; }
  if (s.spoonsN) s.avgSpoons = spoons / s.spoonsN;
  if (s.anxietyN) s.avgAnxiety = anxiety / s.anxietyN;
  if (s.sleepN) s.avgSleep = sleep / s.sleepN;
  if (s.moodN) s.avgMood = mood / s.moodN;
}
