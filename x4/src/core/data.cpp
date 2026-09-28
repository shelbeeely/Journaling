#include "data.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include "../hal/hal.h"
#include "../gen/assets.h"

// ---------- time ----------
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
    else if (k == "fact") d.fact = v;
    else if (k == "prompt") d.prompt = v;
    else if (k == "pioneer") { auto f = split(v, '|'); for (int i = 0; i < 4 && i < (int)f.size(); i++) d.pioneer[i] = f[i]; }
  }
  return true;
}

// ---------- check-in items (same order and icons as the paper day page) ----------
Item ITEMS[MAX_ITEMS] = {
  {"med_am", "Morning meds", IC_AM, Kind::Toggle, 0, 1, 0, "Meds"},
  {"med_pm", "Evening meds", IC_PM, Kind::Toggle, 0, 1, 0, "Meds"},
  {"prn", "As-needed dose", IC_PRN, Kind::Stamp, 0, 0, 0, "Meds"},
  {"meal1", "Meal 1", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food"},
  {"meal2", "Meal 2", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food"},
  {"meal3", "Meal 3", IC_MEAL, Kind::Toggle, 0, 1, 0, "Food"},
  {"snack", "Snack", IC_SNACK, Kind::Toggle, 0, 1, 0, "Food"},
  {"shower", "Shower", IC_SHOWER, Kind::Toggle, 0, 1, 0, "Care"},
  {"teeth", "Teeth", IC_TEETH, Kind::Toggle, 0, 1, 0, "Care"},
  {"joy", "Did something I enjoy", IC_JOY, Kind::Toggle, 0, 1, 0, "Care"},
  {"texted", "Texted someone", IC_TEXT, Kind::Toggle, 0, 1, 0, "Care"},
  {"mood", "Mood", IC_MID, Kind::Scale, -3, 3, 0, "Feel"},
  {"anxiety", "Anxiety", IC_ANX, Kind::Scale, 0, 3, 0, "Feel"},
  {"spoons", "Spoons left", IC_SPOON, Kind::Count, 0, 12, 12, "Energy"},
  {"sleep", "Sleep (hours)", IC_SLEEP, Kind::Count, 0, 14, 7, "Energy"},
};
int ITEM_COUNT = BUILTIN_COUNT;

// ---------- custom check-ins (/kw/checkins.txt, written by tools/export_pack.py) ----------
static char CKEY[MAX_CUSTOM][65], CLABEL[MAX_CUSTOM][48], CGROUP[MAX_CUSTOM][40];

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
  const char* pending = nullptr; int pendingLen = 0, groups = 0;
  size_t a = 0;
  while (a < f.size() && ITEM_COUNT < MAX_ITEMS) {
    size_t b = f.find('\n', a); if (b == std::string::npos) b = f.size();
    const char* line = f.c_str() + a; int len = (int)(b - a); a = b + 1;
    while (len > 0 && (line[len - 1] == '\r' || line[len - 1] == ' ')) len--;
    if (len == 0 || line[0] == '#') continue;
    if (line[0] == '@') { pending = line + 1; pendingLen = len - 1; continue; }
    // key|label|kind|lo|hi|def
    const char* fs[6]; int fl[6], nf = 0; const char* p = line; const char* end = line + len;
    while (nf < 6) {
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
    else if (kind == "count") { it.kind = Kind::Count; lo = 0; if (!hasHi) hi = 99; if (hi < 1 || hi > 999) continue; }
    else if (kind == "scale") { it.kind = Kind::Scale; if (!hasLo || !hasHi || hi <= lo || hi - lo > 9) continue; }
    else continue;
    it.lo = lo; it.hi = hi; it.def = def < lo ? lo : def > hi ? hi : def;
    if (pending) {  // the group heading is stored once, when its first item arrives
      copyField(CGROUP[groups], sizeof CGROUP[groups], pending, pendingLen);
      group = CGROUP[groups++]; it.group = group; pending = nullptr;
    }
    copyField(CLABEL[n], sizeof CLABEL[n], fs[1], fl[1]);
    ITEMS[ITEM_COUNT++] = it;
  }
  return ITEM_COUNT - BUILTIN_COUNT;
}

bool DayLog::has(int i) const { return value[i] != INT_MIN; }
int DayLog::get(int i) const { return has(i) ? value[i] : ITEMS[i].def; }
int DayLog::doneCount() const {
  int n = 0;
  for (int i = 0; i < BUILTIN_COUNT; i++) if (ITEMS[i].kind == Kind::Toggle && has(i) && value[i]) n++;
  return n;
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
  out.date = date; out.stamps.clear();
  for (int i = 0; i < 32; i++) out.value[i] = INT_MIN;
  scanLog(date.substr(0, 7), [&](const std::string& d, const std::string& ts, const std::string& k, const std::string& v) {
    if (d != date) return;
    if (k == "prn") { out.stamps.push_back(v); return; }
    if (k == "prn_undo") { if (!out.stamps.empty()) out.stamps.pop_back(); return; }
    const int i = itemIndex(k); if (i >= 0) out.value[i] = atoi(v.c_str());
  });
}

void saveItem(const std::string& date, int item, int value, time_t when) {
  // The row is stamped with the moment of the tap but keyed to the day being logged, so a
  // late-night "morning meds" for yesterday lands on yesterday.
  std::string line = date + stampStr(when).substr(10) + "," + ITEMS[item].key + "," + std::to_string(value);
  hal::appendLine(("/kw/log/" + date.substr(0, 7) + ".csv").c_str(), line);
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
  for (int d = 1; d <= s.days; d++) { L[d].date = ""; for (int i = 0; i < 32; i++) L[d].value[i] = INT_MIN; }
  scanLog(ym, [&](const std::string& d, const std::string&, const std::string& k, const std::string& v) {
    const int dd = atoi(d.c_str() + 8); if (dd < 1 || dd > 31) return;
    seen[dd] = true;
    const int i = itemIndex(k); if (i >= 0) L[dd].value[i] = atoi(v.c_str());
  });
  const int iMood = itemIndex("mood"), iSleep = itemIndex("sleep"), iSpoons = itemIndex("spoons");
  const int iAm = itemIndex("med_am"), iPm = itemIndex("med_pm"), iShower = itemIndex("shower");
  const int iJoy = itemIndex("joy"), iText = itemIndex("texted");
  float mood = 0, sleep = 0;
  for (int d = 1; d <= s.days; d++) {
    if (!seen[d]) continue;
    s.loggedDays++;
    const DayLog& l = L[d];
    if (l.has(iMood)) { mood += l.value[iMood]; s.moodN++; }
    if (l.has(iSleep)) { sleep += l.value[iSleep]; s.sleepN++; }
    if (l.has(iShower) && l.value[iShower]) s.showers++;
    const bool am = l.has(iAm) && l.value[iAm], pm = l.has(iPm) && l.value[iPm];
    if (am && pm) s.medsBoth++;
    if (am || pm) s.medsAny++;
    if (l.has(iSpoons) && l.value[iSpoons] >= 4) s.goodSpoonDays++;
    if (l.has(iJoy) && l.value[iJoy]) s.joy++;
    if (l.has(iText) && l.value[iText]) s.texted++;
    s.doneByDay[d] = l.doneCount();
  }
  if (s.moodN) s.avgMood = mood / s.moodN;
  if (s.sleepN) s.avgSleep = sleep / s.sleepN;
}
