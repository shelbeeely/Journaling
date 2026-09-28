#include "app.h"
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>
#include "core/canvas.h"
#include "core/data.h"
#include "hal/hal.h"
#include "gen/assets.h"
#include "lib/qrcodegen.hpp"

// ---------------------------------------------------------------------------------------------
// Layout constants (portrait 480 x 800). The four front buttons sit under the screen, so every
// screen ends with a hint bar whose four slots line up with them: Back · Confirm · Left · Right.
// Up/Down are the side rocker. Long-press Back anywhere opens Support.
// ---------------------------------------------------------------------------------------------
static const int M = 28;          // side margin
static const int CW = Canvas::W - 2 * M;
static const int HINT_Y = 760;    // top of the hint bar
static const uint32_t IDLE_MS = 90000;  // go to sleep (showing Today) after 90 s untouched

enum class Scr { Today, Checkin, Menu, Month, Support, Plan, Sync, Clock };
struct State {
  Scr scr = Scr::Today;
  int dayOffset = 0;      // Today screen: browse other days with Left/Right
  int sel = 0;            // selected row on list screens
  int page = 0;           // Support / Plan pagination
  int monthOffset = 0;    // Month screen
  int changes = 0;        // fast refreshes since the last full one (ghosting control)
  Scr prev = Scr::Today;  // where Back goes from Support
  int scroll = 0;         // Check in: list offset in pixels
  int field = 0;          // Clock editor
  struct tm edit;
};
static uint8_t* FB;
static Canvas* C;
static State S;

static std::string today() { return dateStr(hal::now()); }

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------
static void hintBar(const char* a, const char* b, const char* c, const char* d) {
  C->hline(0, HINT_Y, Canvas::W, true);
  const char* L[4] = {a, b, c, d};
  for (int i = 0; i < 4; i++) {
    if (!L[i] || !*L[i]) continue;
    const int cx = Canvas::W * (2 * i + 1) / 8;
    C->textCenter(F_UI_S, cx, HINT_Y + 28, L[i], &F_SYM);
  }
}

static void header(const char* title, const char* sub, int icon = -1) {
  int x = M;
  if (icon >= 0) { C->icon(icon, M, 30, 36); x = M + 46; }
  C->text(F_TITLE, x, 62, title);
  if (sub && *sub) C->textRight(F_UI_S, Canvas::W - M, 60, sub, &F_SYM);
  C->fill(M, 80, CW, 3);
}

static void chip(int x, int baseline, const char* t, bool inverse) {
  const int w = C->width(F_UI_S, t) + 10;
  if (inverse) C->fill(x, baseline - 16, w, 21); else C->rect(x, baseline - 16, w, 21, 1);
  C->text(F_UI_S, x + 5, baseline, t, !inverse);
}

static int chips(int right, int baseline, const std::string& how) {
  // right-aligned row of TEXT / CALL / CHAT... chips; TEXT is black so it stands out
  std::vector<std::string> v; size_t a = 0;
  while (a < how.size()) { size_t b = how.find(' ', a); if (b == std::string::npos) b = how.size(); if (b > a) v.push_back(how.substr(a, b - a)); a = b + 1; }
  int x = right;
  for (int i = (int)v.size() - 1; i >= 0; i--) {
    const int w = C->width(F_UI_S, v[i].c_str()) + 10;
    x -= w; chip(x, baseline, v[i].c_str(), v[i] == "TEXT"); x -= 5;
  }
  return x;
}

static void battery(int x, int baseline) {
  const int p = hal::batteryPercent();
  if (p < 0) return;
  C->rect(x, baseline - 14, 30, 15, 2); C->fill(x + 30, baseline - 10, 3, 7);
  C->fill(x + 3, baseline - 11, 24 * p / 100, 9);
  char b[12]; snprintf(b, sizeof b, "%d%%", p);
  C->text(F_UI_S, x + 40, baseline, b);
}

// ---------------------------------------------------------------------------------------------
// TODAY — also the sleep screen. Everything a glance needs, nothing to operate.
// ---------------------------------------------------------------------------------------------
static void drawToday(bool sleeping) {
  const std::string date = addDays(today(), S.dayOffset);
  Day d; loadDay(date, d);
  DayLog log; loadDayLog(date, log);
  C->clear();
  int y;
  if (!d.ok) {
    header("Keeping Watch", prettyDate(date).c_str());
    C->wrap(F_BODY, M, 150, CW, ("No day pack for " + date.substr(0, 7) + " on the card. Copy it from the journal "
                                 "build to /kw/ on the SD card, or upload it from the Wi-Fi page (Menu → Wi-Fi sync).").c_str());
    hintBar("Menu", "Check in", "◀ day", "day ▶");
    return;
  }
  // Masthead: weekday · month, huge date numeral, moon on the right.
  int mon = atoi(date.substr(5, 2).c_str()), dd = atoi(date.substr(8, 2).c_str());
  std::string cap = d.weekday + " · " + monthName(mon);
  for (auto& ch : cap) if (ch >= 'a' && ch <= 'z') ch -= 32;
  C->text(F_UI_B, M, 52, cap.c_str());
  char num[4]; snprintf(num, sizeof num, "%d", dd);
  const int nx = C->text(F_HUGE, M - 4, 160, num);
  C->text(F_UI_S, nx + 10, 158, date.substr(0, 4).c_str());
  C->text(F_BODY, nx + 10, 132, d.planet.c_str(), true, &F_SYM);
  C->moon(Canvas::W - M - 50, 104, 46, d.moonDeg);
  char mp[64]; snprintf(mp, sizeof mp, "%d%% · %s", d.lit, d.moonSign.c_str());
  C->textRight(F_UI_S, Canvas::W - M, 176, mp, &F_SYM);
  if (S.dayOffset) C->textRight(F_UI_S, Canvas::W - M, 36, S.dayOffset > 0 ? "future day" : "past day");
  C->fill(M, 192, CW, 3);

  // Sun and season.
  y = 228;
  C->icon(IC_SUNRISE, M, y - 20); int x = C->text(F_UI, M + 30, y, d.rise.c_str());
  C->icon(IC_SUNSET, x + 22, y - 20); x = C->text(F_UI, x + 52, y, d.set.c_str());
  C->textRight(F_UI_S, Canvas::W - M, y, (d.daylight + " of light").c_str());
  y += 40;
  C->icon(IC_LEAF, M, y - 20);
  y = C->wrap(F_BODY_I, M + 32, y, CW - 32, d.season.c_str(), 2);
  if (!d.moonIn.empty()) { C->text(F_UI_S, M + 32, y - 4, ("Moon enters " + d.moonIn).c_str(), true, &F_SYM); y += 24; }
  y += 6;
  C->hline(M, y, CW); y += 34;

  // Notes (holidays bold), one-off events, routines as checkboxes.
  int shown = 0;
  for (auto& n : d.notes) {
    if (shown >= 3) break;
    const bool hol = n[0] == '!';
    C->text(hol ? F_UI_B : F_UI, M, y, hol ? n.c_str() + 1 : n.c_str(), true, &F_SYM); y += 30; shown++;
  }
  for (auto& e : d.events) {
    if (shown >= 5) break;
    C->circle(M + 7, y - 7, 6, 2); C->wrap(F_UI, M + 24, y, CW - 24, e.c_str(), 1); y += 30; shown++;
  }
  for (auto& r : d.routines) {
    if (shown >= 6) break;
    C->rect(M, y - 16, 16, 16, 2); C->wrap(F_UI, M + 24, y, CW - 24, r.c_str(), 1); y += 30; shown++;
  }
  if (!shown) { C->text(F_BODY_I, M, y, "Nothing on the calendar."); y += 30; }
  y += 4;
  C->hline(M, y, CW); y += 14;

  // Today's care at a glance: filled tile = done. Same icons as the paper page.
  C->text(F_UI_S, M, y + 14, "TODAY'S CARE");
  const int tiles[] = {0, 1, 3, 4, 5, 7, 8, 9, 10};
  y += 26;
  for (int i = 0; i < 9; i++) {
    const int tx = M + i * 47, idx = tiles[i];
    const bool on = log.has(idx) && log.get(idx);
    if (on) { C->fillRound(tx, y, 40, 40, 6); C->icon(ITEMS[idx].icon, tx + 8, y + 8, 24, false); }
    else { C->roundRect(tx, y, 40, 40, 6, 2); C->icon(ITEMS[idx].icon, tx + 8, y + 8, 24, true); }
  }
  y += 70;
  char feel[96];
  const int mood = log.get(11), anx = log.get(12), spoons = log.get(13);
  snprintf(feel, sizeof feel, "Mood %s%d  ·  Anxiety %d  ·  %d spoons", mood > 0 ? "+" : "", mood, anx, spoons);
  C->text(F_UI, M, y, (log.has(11) || log.has(12) || log.has(13)) ? feel : "No check-in yet today.");
  y += 22;

  // On this day (the footer fact from the paper page).
  if (!d.fact.empty()) {
    const int bh = HINT_Y - 18 - y;
    if (bh > 90) {
      C->rect(M, y, CW, bh, 2);
      C->text(F_UI_S, M + 14, y + 28, "ON THIS DAY");
      C->wrap(F_BODY, M + 14, y + 58, CW - 28, d.fact.c_str(), (bh - 50) / F_BODY.lineHeight);
    }
  }
  if (sleeping) {
    C->hline(0, HINT_Y, Canvas::W);
    battery(M, HINT_Y + 28);
    C->textRight(F_UI_S, Canvas::W - M, HINT_Y + 28,
                 hal::timeValid() ? ("Updated " + clockStr(hal::now()) + " · press power to wake").c_str() : "Clock not set · press power");
  } else {
    hintBar(S.dayOffset ? "Today" : "Menu", "Check in", "◀ day", "day ▶");
  }
}

// ---------------------------------------------------------------------------------------------
// CHECK IN — the paper page's care block, one button press per box.
// ---------------------------------------------------------------------------------------------
static const int ROW_H = 43, LIST_Y = 100, HEAD_H = 36, VIEW_H = HINT_Y - LIST_Y;

// A custom group starts a new section; built-ins keep their original separators.
static bool newGroup(int i) {
  if (i == 0) return false;
  if (i < BUILTIN_COUNT) return strcmp(ITEMS[i - 1].group, ITEMS[i].group) != 0;
  return i == BUILTIN_COUNT || ITEMS[i - 1].group != ITEMS[i].group;
}
static bool hasHeading(int i) { return i >= BUILTIN_COUNT && newGroup(i) && ITEMS[i].group[0]; }
// Top of row i in list coordinates (before scrolling); headings sit above their first row.
static int rowTop(int i) {
  int y = 0;
  for (int k = 0; k <= i; k++) { if (hasHeading(k)) y += HEAD_H; if (k < i) y += ROW_H; }
  return y;
}

// One line, cut with "…" to fit `w` (wrap() lets a single long word run over).
static void fitText(const Font& f, int x, int baseline, int w, const char* s) {
  if (C->width(f, s) <= w) { C->text(f, x, baseline, s); return; }
  char b[64]; int n = (int)strlen(s); if (n > 60) n = 60;
  for (; n > 0; n--) {
    if (((unsigned char)s[n] & 0xC0) == 0x80) continue;  // never cut inside a UTF-8 sequence
    memcpy(b, s, n); strcpy(b + n, "…");
    if (C->width(f, b) <= w) break;
  }
  if (n > 0) C->text(f, x, baseline, b);
}

// Dots item: an empty, half-filled or full circle (1-bit).
static void dotState(int cx, int cy, int r, int v) {
  if (v >= 2) { C->fillCircle(cx, cy, r); return; }
  C->circle(cx, cy, r, 2);
  if (v == 1) for (int dx = -r; dx <= 0; dx++) {
    int h = 0; while ((h + 1) * (h + 1) + dx * dx <= r * r) h++;
    C->vline(cx + dx, cy - h, 2 * h + 1);
  }
}

static void drawCheckin() {
  const std::string date = addDays(today(), S.dayOffset);
  DayLog log; loadDayLog(date, log);
  C->clear();
  header("Check in", prettyDate(date).c_str(), IC_CHECK);
  // Scroll only when the list is taller than the screen (never with the built-ins alone).
  const int total = rowTop(ITEM_COUNT - 1) + ROW_H;
  if (total <= VIEW_H) S.scroll = 0;
  else {
    const int top = rowTop(S.sel) - (hasHeading(S.sel) ? HEAD_H : 0), bottom = rowTop(S.sel) + ROW_H;
    if (top < S.scroll) S.scroll = top;
    if (bottom > S.scroll + VIEW_H) S.scroll = bottom - VIEW_H;
    if (S.sel == 0) S.scroll = 0;
  }
  for (int i = 0; i < ITEM_COUNT; i++) {
    const Item& it = ITEMS[i];
    const int ry = rowTop(i) - S.scroll;
    if (hasHeading(i) && ry - HEAD_H >= 0 && ry <= VIEW_H) {
      std::string H = it.group; for (auto& ch : H) if (ch >= 'a' && ch <= 'z') ch -= 32;
      C->hline(M, LIST_Y + ry - HEAD_H, CW);
      C->wrap(F_UI_S, M, LIST_Y + ry - HEAD_H + 27, CW, H.c_str(), 1);
    }
    if (ry < 0 || ry + ROW_H > VIEW_H) continue;  // off screen: rows are drawn whole or not at all
    const int y = LIST_Y + ry;
    if (newGroup(i) && !hasHeading(i)) C->hline(M, y, CW);
    const int base = y + 29;
    if (it.icon >= 0) C->icon(it.icon, M + 4, y + 9);
    else C->fillCircle(M + 16, y + 21, 4);  // custom items: a neutral dot
    const int R = Canvas::W - M - 8;
    int ctrl = 0;  // width of the control on the right, so long custom labels can be cut short
    switch (it.kind) {
      case Kind::Toggle: C->checkbox(R - 24, y + 9, 26, log.get(i)); ctrl = 26; break;
      case Kind::Dots: dotState(R - 12, y + 21, 12, log.get(i)); ctrl = 26; break;
      case Kind::Stamp: {
        std::string t = log.stamps.empty() ? "tap to log time" : log.stamps.back();
        if (log.stamps.size() > 1) t += " (" + std::to_string(log.stamps.size()) + ")";
        C->textRight(F_UI, R, base, t.c_str());
        break;
      }
      case Kind::Scale: {
        const int n = it.hi - it.lo + 1, r = 9, gap = 7, w = n * (2 * r) + (n - 1) * gap;
        C->bubbles(R - w, y + 21, n, log.has(i) ? log.get(i) - it.lo : -1, r, gap);
        ctrl = w;
        break;
      }
      case Kind::Count: {
        char b[16]; snprintf(b, sizeof b, "%d", log.get(i));
        if (i == 13) {  // spoons: draw them, filled = left
          for (int k = 0; k < 12; k++) {
            const int sx = R - (12 - k) * 15, on = k < log.get(i);
            if (on) { C->fillCircle(sx + 5, y + 16, 5); C->fill(sx + 4, y + 20, 3, 11); }
            else { C->circle(sx + 5, y + 16, 5, 2); C->vline(sx + 5, y + 21, 10); }
          }
        } else {
          C->textRight(F_UI_B, R, base, log.has(i) ? b : "–");
          ctrl = C->width(F_UI_B, "999");
        }
        break;
      }
    }
    if (i < BUILTIN_COUNT) C->text(F_UI, M + 40, base, it.label);
    else fitText(F_UI, M + 40, base, R - ctrl - 16 - (M + 40), it.label);
    if (i == S.sel) C->invert(M - 8, y + 2, CW + 16, ROW_H - 4);
  }
  if (total > VIEW_H) {  // a quiet scroll bar in the right margin
    const int barH = VIEW_H * VIEW_H / total, barY = LIST_Y + (VIEW_H - barH) * S.scroll / (total - VIEW_H);
    C->vline(Canvas::W - 10, LIST_Y, VIEW_H);
    C->fill(Canvas::W - 12, barY, 5, barH);
  }
  const Item& cur = ITEMS[S.sel];
  const bool adjustable = cur.kind == Kind::Scale || cur.kind == Kind::Count || cur.kind == Kind::Dots;
  const char* ok = cur.kind == Kind::Stamp ? "Log now" : cur.kind == Kind::Toggle ? "Tick" : cur.kind == Kind::Dots ? "Fill" : "Set";
  hintBar("Done", ok, adjustable ? "−" : "", adjustable ? "+" : "");
}

static void checkinPress(Btn b) {
  const std::string date = addDays(today(), S.dayOffset);
  DayLog log; loadDayLog(date, log);
  const Item& it = ITEMS[S.sel];
  const time_t now = hal::now();
  if (b == Btn::Confirm) {
    if (it.kind == Kind::Toggle) saveItem(date, S.sel, log.get(S.sel) ? 0 : 1, now);
    else if (it.kind == Kind::Stamp) saveStamp(date, now);
    else if (it.kind == Kind::Dots) saveItem(date, S.sel, (log.get(S.sel) + 1) % 3, now);  // empty → half → full
    else if (!log.has(S.sel)) saveItem(date, S.sel, it.def, now);  // "Set" confirms the default value
  } else if ((b == Btn::Left || b == Btn::Right) && (it.kind == Kind::Scale || it.kind == Kind::Count || it.kind == Kind::Dots)) {
    int v = log.get(S.sel) + (b == Btn::Right ? 1 : -1);
    if (v < it.lo) v = it.lo;
    if (v > it.hi) v = it.hi;
    saveItem(date, S.sel, v, now);
  }
}

// ---------------------------------------------------------------------------------------------
// MENU
// ---------------------------------------------------------------------------------------------
struct MenuEntry { const char* label; const char* sub; int icon; Scr to; };
static const MenuEntry MENU[] = {
  {"Today", "the almanac page", IC_CAL, Scr::Today},
  {"Check in", "meds, meals, care, mood, spoons", IC_CHECK, Scr::Checkin},
  {"This month", "totals for your Keeper handoff", IC_CHART, Scr::Month},
  {"Support", "numbers to text or call", IC_HEART, Scr::Support},
  {"My safety plan", "and people to text", IC_PERSON, Scr::Plan},
  {"Wi-Fi sync", "upload packs, download your log", IC_WIFI, Scr::Sync},
  {"Clock", "set the date and time", IC_GEAR, Scr::Clock},
};
static const int MENU_N = sizeof(MENU) / sizeof(MENU[0]);
static void drawMenu() {
  C->clear();
  header("Keeping Watch", prettyDate(today()).c_str());
  for (int i = 0; i < MENU_N; i++) {
    const int y = 110 + i * 86;
    C->icon(MENU[i].icon, M + 4, y + 14, 36);
    C->text(F_UI_B, M + 60, y + 34, MENU[i].label);
    C->text(F_UI_S, M + 60, y + 60, MENU[i].sub);
    if (i < MENU_N - 1) C->hline(M, y + 82, CW);
    if (i == S.sel) C->invert(M - 8, y + 4, CW + 16, 76);
  }
  battery(M, HINT_Y - 16);
  hintBar("Close", "Open", "", "");
}

// ---------------------------------------------------------------------------------------------
// THIS MONTH — the numbers the Keeper's "Closing <month>" page asks for, already added up.
// ---------------------------------------------------------------------------------------------
static void drawMonth() {
  time_t t = hal::now(); struct tm tm; localtime_r(&t, &tm);
  int y0 = tm.tm_year + 1900, m0 = tm.tm_mon + 1 + S.monthOffset;
  while (m0 < 1) { m0 += 12; y0--; }
  while (m0 > 12) { m0 -= 12; y0++; }
  MonthStats s; monthStats(y0, m0, s);
  char sub[32]; snprintf(sub, sizeof sub, "%d", y0);
  C->clear();
  header(monthName(m0).c_str(), sub, IC_CHART);
  struct Stat { const char* label; char val[16]; const char* unit; };
  Stat st[6];
  auto set = [&](int i, const char* l, const char* u, const char* fmt, double v, bool have) {
    st[i].label = l; st[i].unit = u; if (have) snprintf(st[i].val, 16, fmt, v); else strcpy(st[i].val, "–");
  };
  set(0, "Avg mood", "−3…+3", "%+.1f", s.avgMood, s.moodN);
  set(1, "Avg sleep", "hours", "%.1f", s.avgSleep, s.sleepN);
  char u2[16]; snprintf(u2, sizeof u2, "of %d days", s.days);
  set(2, "Showers", u2, "%.0f", s.showers, s.loggedDays);
  set(3, "Meds, both doses", "days", "%.0f", s.medsBoth, s.loggedDays);
  set(4, "Good-spoon days", "4+ left", "%.0f", s.goodSpoonDays, s.loggedDays);
  set(5, "Enjoyed something", "days", "%.0f", s.joy, s.loggedDays);
  for (int i = 0; i < 6; i++) {
    const int col = i % 2, row = i / 2, x = M + col * (CW / 2 + 6), y = 104 + row * 108;
    C->rect(x, y, CW / 2 - 6, 96, 2);
    C->text(F_UI_S, x + 12, y + 26, st[i].label);
    const int ex = C->text(F_UI_XL, x + 12, y + 76, st[i].val);
    C->text(F_UI_S, ex + 8, y + 76, st[i].unit);
  }
  // Calendar: each day's dot grows with the care boxes ticked that day.
  int y = 450;
  C->text(F_UI_S, M, y, "CARE BOXES TICKED, BY DAY"); y += 16;
  struct tm first = {}; first.tm_year = y0 - 1900; first.tm_mon = m0 - 1; first.tm_mday = 1; first.tm_hour = 12; mktime(&first);
  const int lead = (first.tm_wday + 6) % 7, cellW = CW / 7, cellH = 44;
  static const char* WD = "MTWTFSS";
  for (int i = 0; i < 7; i++) { char b[2] = {WD[i], 0}; C->textCenter(F_UI_S, M + i * cellW + cellW / 2, y + 18, b); }
  y += 26;
  for (int d = 1; d <= s.days; d++) {
    const int k = lead + d - 1, cx = M + (k % 7) * cellW + cellW / 2, cy = y + (k / 7) * cellH + cellH / 2;
    const int n = s.doneByDay[d];
    char b[4]; snprintf(b, sizeof b, "%d", d);
    if (n) C->fillCircle(cx, cy, 5 + n * 12 / 9 > 18 ? 18 : 5 + n * 12 / 9);
    else C->circle(cx, cy, 5, 1);
    if (!n) C->text(F_UI_S, cx + 8, cy - 6, b);
  }
  // Where it goes in the Keeper.
  std::string pack; int kp = 0;
  char path[24]; snprintf(path, sizeof path, "/kw/%04d-%02d.txt", y0, m0);
  if (hal::readFile(path, pack)) { size_t p = pack.find("\nkeeper="); if (p != std::string::npos) kp = atoi(pack.c_str() + p + 8); }
  char foot[96];
  if (kp) snprintf(foot, sizeof foot, "Copy these to your Keeper, page %d.", kp);
  else snprintf(foot, sizeof foot, "Copy these to your Keeper's handoff page.");
  C->text(F_BODY_I, M, HINT_Y - 18, foot);
  hintBar("Back", "", "◀ month", "month ▶");
}

// ---------------------------------------------------------------------------------------------
// SUPPORT — high contrast, big type, text-first. Long-press Back from anywhere.
// ---------------------------------------------------------------------------------------------
struct Entry { std::string h, name, detail, how; };
static std::vector<Entry> loadEntries(const char* path) {
  std::vector<Entry> v; std::string f, h;
  if (!hal::readFile(path, f)) return v;
  size_t a = 0;
  while (a < f.size()) {
    size_t b = f.find('\n', a); if (b == std::string::npos) b = f.size();
    std::string line = f.substr(a, b - a); a = b + 1;
    if (line.empty() || line[0] == ' ') continue;
    if (line[0] == '#') { if (line.size() > 1 && line[1] != ' ') h = line.substr(1); continue; }
    Entry e; e.h = h;
    size_t p1 = line.find('|'), p2 = p1 == std::string::npos ? p1 : line.find('|', p1 + 1);
    e.name = line.substr(0, p1);
    if (p1 != std::string::npos) e.detail = line.substr(p1 + 1, p2 == std::string::npos ? std::string::npos : p2 - p1 - 1);
    if (p2 != std::string::npos) e.how = line.substr(p2 + 1);
    v.push_back(e);
  }
  return v;
}

static int supportPages = 1;
static void drawSupport() {
  auto v = loadEntries("/kw/support.txt");
  C->clear();
  C->fill(0, 0, Canvas::W, 92);
  C->icon(IC_HEART, M, 28, 36, false);
  C->text(F_TITLE, M + 48, 62, "Support", false);
  C->text(F_UI_B, Canvas::W - M - C->width(F_UI_B, "Emergency 911"), 60, "Emergency 911", false);
  // paginate: lay out entries top to bottom, a page ends when the next entry would not fit
  int page = 0, y = 120; std::string lastH;
  supportPages = 1;
  for (size_t i = 0; i < v.size(); i++) {
    const Entry& e = v[i];
    const int need = (e.h != lastH ? 40 : 0) + 30 + 26 * ((C->width(F_UI, e.detail.c_str()) / (CW - 10)) + 1) + 12;
    if (y + need > HINT_Y - 10) { page++; y = 120; lastH = ""; supportPages = page + 1; }
    const bool draw = page == S.page;
    if (e.h != lastH) {
      if (draw) { std::string H = e.h; for (auto& ch : H) if (ch >= 'a' && ch <= 'z') ch -= 32; C->text(F_UI_S, M, y + 10, H.c_str()); C->hline(M, y + 18, CW); }
      y += 40; lastH = e.h;
    }
    if (draw) {
      // Only TEXT gets a badge: it is the one thing worth spotting at a glance.
      const bool canText = e.how.find("TEXT") != std::string::npos;
      const int nameW = canText ? CW - 64 : CW;
      C->wrap(F_UI_B, M, y, nameW, e.name.c_str(), 1);
      if (canText) chip(Canvas::W - M - 54, y, "TEXT", true);
      C->wrap(F_UI, M, y + 28, CW, e.detail.c_str(), 3);
    }
    y += 30 + 26 * ((C->width(F_UI, e.detail.c_str()) / (CW - 10)) + 1) + 12;
  }
  if (v.empty()) C->wrap(F_BODY, M, 150, CW, "Call or text 988, any hour. Text HOME to 741741. Copy support.txt to /kw/ on the card for the full list.");
  char pg[16]; snprintf(pg, sizeof pg, "%d / %d", S.page + 1, supportPages);
  hintBar("Back", "Safety plan", S.page ? "◀ page" : "", S.page + 1 < supportPages ? "page ▶" : "");
  C->textRight(F_UI_S, Canvas::W - M, HINT_Y - 10, pg);
}

static void drawPlan() {
  std::string f; hal::readFile("/kw/me.txt", f);
  C->clear();
  header("My safety plan", "", IC_PERSON);
  int y = 120;
  size_t a = 0; bool any = false; std::string h;
  std::vector<std::pair<std::string, std::string>> sec;
  while (a < f.size()) {
    size_t b = f.find('\n', a); if (b == std::string::npos) b = f.size();
    std::string line = f.substr(a, b - a); a = b + 1;
    if (line.rfind("# ", 0) == 0 || line.empty()) continue;
    if (line[0] == '#') { sec.push_back({line.substr(1), ""}); continue; }
    if (!sec.empty()) { if (!sec.back().second.empty()) sec.back().second += "; "; sec.back().second += line; any = true; }
  }
  int n = 1;
  for (auto& s : sec) {
    if (y > HINT_Y - 200) break;
    char h2[96]; snprintf(h2, sizeof h2, "%d. %s", n++, s.first.c_str());
    C->text(F_UI_B, M, y, h2); y += 28;
    y = s.second.empty() ? (C->dotted(M + 24, y - 6, CW - 24), y + 16) : C->wrap(F_BODY, M + 24, y, CW - 24, s.second.c_str(), 3) + 8;
  }
  if (!any) C->wrap(F_BODY_I, M, y + 4, CW, "Empty for now. Fill it in on the Wi-Fi page, or use the safety plan page at the back of your journal.", 3);
  const int by = HINT_Y - 150;
  C->rect(M, by, CW, 130, 3);
  C->text(F_UI_S, M + 14, by + 28, "WHEN TALKING IS TOO HARD, SEND:");
  C->wrap(F_BODY, M + 14, by + 60, CW - 28, "“Hey, I’m having a hard time. I’m not up for a call. Can you text with me for a bit?”", 3);
  hintBar("Back", "Support", "", "");
}

// ---------------------------------------------------------------------------------------------
// WI-FI SYNC — a hotspot plus a local web page. The QR code joins the network in one scan.
// ---------------------------------------------------------------------------------------------
static char SSID[24], PASS[16];
static void drawQr(const char* text, int x, int y, int size) {
  using qrcodegen::QrCode;
  const QrCode qr = QrCode::encodeText(text, QrCode::Ecc::MEDIUM);
  const int n = qr.getSize(), s = size / (n + 4), off = (size - s * n) / 2;
  C->fill(x, y, size, size, false);
  for (int j = 0; j < n; j++) for (int i = 0; i < n; i++) if (qr.getModule(i, j)) C->fill(x + off + i * s, y + off + j * s, s, s);
}
static void drawSync(bool up) {
  C->clear();
  header("Wi-Fi sync", up ? "hotspot on" : "starting…", IC_WIFI);
  if (!up) { C->wrap(F_BODY, M, 150, CW, "Starting the hotspot…"); hintBar("Stop", "", "", ""); return; }
  char wifi[96]; snprintf(wifi, sizeof wifi, "WIFI:T:WPA;S:%s;P:%s;;", SSID, PASS);
  drawQr(wifi, (Canvas::W - 300) / 2, 104, 300);
  int y = 440;
  C->textCenter(F_UI_S, Canvas::W / 2, y, "1. SCAN TO JOIN, OR CONNECT TO"); y += 34;
  C->textCenter(F_UI_B, Canvas::W / 2, y, SSID); y += 30;
  char pw[40]; snprintf(pw, sizeof pw, "password %s", PASS);
  C->textCenter(F_UI, Canvas::W / 2, y, pw); y += 50;
  C->textCenter(F_UI_S, Canvas::W / 2, y, "2. OPEN"); y += 40;
  C->textCenter(F_TITLE, Canvas::W / 2, y, "192.168.4.1"); y += 44;
  C->wrap(F_UI_S, M, y, CW, "Upload month packs, download your check-in log, edit your safety plan, and set the clock from your phone. Nothing leaves this device.", 4);
  char cl[32]; snprintf(cl, sizeof cl, "%d connected", hal::wifiClients());
  C->textRight(F_UI_S, Canvas::W - M, HINT_Y - 10, cl);
  hintBar("Stop", "", "", "");
}

// ---------------------------------------------------------------------------------------------
// CLOCK — set date and time with buttons when there is no phone handy.
// ---------------------------------------------------------------------------------------------
static void drawClock() {
  C->clear();
  header("Clock", hal::timeValid() ? "running" : "not set", IC_GEAR);
  char f[5][16];
  snprintf(f[0], 16, "%04d", S.edit.tm_year + 1900); snprintf(f[1], 16, "%02d", S.edit.tm_mon + 1);
  snprintf(f[2], 16, "%02d", S.edit.tm_mday); snprintf(f[3], 16, "%02d", S.edit.tm_hour); snprintf(f[4], 16, "%02d", S.edit.tm_min);
  const char* L[5] = {"YEAR", "MONTH", "DAY", "HOUR", "MIN"};
  const int xs[5] = {M, M + 150, M + 250, M + 60, M + 200}, ys[5] = {230, 230, 230, 420, 420};
  for (int i = 0; i < 5; i++) {
    C->text(F_UI_S, xs[i], ys[i] - 70, L[i]);
    C->text(F_UI_XL, xs[i], ys[i], f[i]);
    if (i == S.field) C->fill(xs[i], ys[i] + 12, C->width(F_UI_XL, f[i]), 4);
  }
  C->text(F_UI_XL, M + 150, 420, ":");
  C->wrap(F_BODY_I, M, 520, CW, "Pacific time; daylight saving is handled for you. The Wi-Fi page can also set this from your phone in one tap.", 3);
  hintBar("Cancel", "Save", "◀ field", "field ▶");
}

// ---------------------------------------------------------------------------------------------
// Refresh policy. E-ink is at its best when it barely moves: moving a selection is a fast partial
// refresh with no flash; changing screens is a half refresh; every 8th fast update, or anything
// shown for long (sleep), gets a full refresh so ghosting never builds up.
// ---------------------------------------------------------------------------------------------
static void render(bool sameScreen, bool sleeping = false) {
  switch (S.scr) {
    case Scr::Today: drawToday(sleeping); break;
    case Scr::Checkin: drawCheckin(); break;
    case Scr::Menu: drawMenu(); break;
    case Scr::Month: drawMonth(); break;
    case Scr::Support: drawSupport(); break;
    case Scr::Plan: drawPlan(); break;
    case Scr::Sync: drawSync(hal::wifiClients() >= 0 && SSID[0]); break;
    case Scr::Clock: drawClock(); break;
  }
  Refresh r = Refresh::Half;
  if (sleeping) r = Refresh::Full;
  else if (sameScreen) { r = (++S.changes % 8 == 0) ? Refresh::Half : Refresh::Fast; }
  else S.changes = 0;
  static const char* NAMES[] = {"today", "checkin", "menu", "month", "support", "plan", "sync", "clock"};
  hal::show(r, NAMES[(int)S.scr]);
}

[[noreturn]] static void goToSleep() {
  hal::wifiStop();
  S.scr = Scr::Today; S.dayOffset = 0;
  render(false, true);
  hal::sleepUntil(nextLocalMidnight(hal::now(), 31));  // 12:31 a.m. leaves room for RTC drift
}

static void go(Scr s) { S.prev = S.scr; S.scr = s; S.sel = 0; S.page = 0; S.scroll = 0; render(false); }

void appMain() {
  hal::begin();
  timeInit();
  FB = hal::framebuffer();
  static Canvas canvas(FB); C = &canvas;
  if (hal::woke_by_timer()) goToSleep();  // midnight: redraw today's page and go straight back to sleep
  loadCheckins();  // custom check-ins from the day page layout, if the card has them

  render(false);
  for (;;) {
    const Btn b = hal::waitButton(S.scr == Scr::Sync ? 250 : IDLE_MS);
    if (b == Btn::None) {
      if (S.scr == Scr::Sync) { static uint32_t last = 0; hal::wifiLoop(); if (hal::millis() - last > 20000) { last = hal::millis(); render(true); } continue; }
      goToSleep();
    }
    if (b == Btn::Power || b == Btn::PowerHold) goToSleep();
    if (b == Btn::BackHold) {
      if (S.scr == Scr::Sync) { SSID[0] = 0; loadCheckins(); }
      if (S.scr != Scr::Support) { hal::wifiStop(); go(Scr::Support); }
      continue;
    }

    switch (S.scr) {
      case Scr::Today:
        if (b == Btn::Confirm) go(Scr::Checkin);
        else if (b == Btn::Left || b == Btn::Right) { S.dayOffset += (b == Btn::Right) ? 1 : -1; render(true); }
        else if (b == Btn::Back) { if (S.dayOffset) { S.dayOffset = 0; render(true); } else go(Scr::Menu); }
        else if (b == Btn::Up || b == Btn::Down) go(Scr::Menu);
        break;
      case Scr::Checkin:
        if (b == Btn::Back) { S.scr = Scr::Today; render(false); }
        else if (b == Btn::Up) { S.sel = (S.sel + ITEM_COUNT - 1) % ITEM_COUNT; render(true); }
        else if (b == Btn::Down) { S.sel = (S.sel + 1) % ITEM_COUNT; render(true); }
        else { checkinPress(b); render(true); }
        break;
      case Scr::Menu:
        if (b == Btn::Back) { S.scr = Scr::Today; S.dayOffset = 0; render(false); }
        else if (b == Btn::Up || b == Btn::Left) { S.sel = (S.sel + MENU_N - 1) % MENU_N; render(true); }
        else if (b == Btn::Down || b == Btn::Right) { S.sel = (S.sel + 1) % MENU_N; render(true); }
        else if (b == Btn::Confirm) {
          const Scr to = MENU[S.sel].to;
          if (to == Scr::Today) S.dayOffset = 0;
          if (to == Scr::Month) S.monthOffset = 0;
          if (to == Scr::Sync) {
            uint32_t r = (uint32_t)hal::now() * 2654435761u ^ hal::millis();
            snprintf(SSID, sizeof SSID, "KeepingWatch-%04X", (unsigned)(r & 0xFFFF));
            snprintf(PASS, sizeof PASS, "%08u", (unsigned)((r >> 3) % 100000000u));
            S.scr = Scr::Sync; render(false);
            if (!hal::wifiStart(SSID, PASS)) { SSID[0] = 0; }
            render(false);
            break;
          }
          if (to == Scr::Clock) { time_t t = hal::timeValid() ? hal::now() : (time_t)1790000000; localtime_r(&t, &S.edit); S.field = 0; }
          go(to);
        }
        break;
      case Scr::Month:
        if (b == Btn::Back) go(Scr::Menu);
        else if (b == Btn::Left || b == Btn::Up) { S.monthOffset--; render(true); }
        else if (b == Btn::Right || b == Btn::Down) { if (S.monthOffset < 0) S.monthOffset++; render(true); }
        break;
      case Scr::Support:
        if (b == Btn::Back) { S.scr = S.prev == Scr::Support ? Scr::Today : S.prev; S.sel = 0; render(false); }
        else if (b == Btn::Confirm) { S.prev = Scr::Support; S.scr = Scr::Plan; render(false); }
        else if ((b == Btn::Right || b == Btn::Down) && S.page + 1 < supportPages) { S.page++; render(true); }
        else if ((b == Btn::Left || b == Btn::Up) && S.page > 0) { S.page--; render(true); }
        break;
      case Scr::Plan:
        if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = 4; render(false); }
        else if (b == Btn::Confirm) { S.prev = Scr::Plan; S.scr = Scr::Support; S.page = 0; render(false); }
        break;
      case Scr::Sync:
        if (b == Btn::Back) { hal::wifiStop(); SSID[0] = 0; loadCheckins(); S.scr = Scr::Menu; S.sel = 5; render(false); }
        break;
      case Scr::Clock:
        if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = 6; render(false); }
        else if (b == Btn::Left) { S.field = (S.field + 4) % 5; render(true); }
        else if (b == Btn::Right) { S.field = (S.field + 1) % 5; render(true); }
        else if (b == Btn::Up || b == Btn::Down) {
          const int d = b == Btn::Up ? 1 : -1;
          int* F[5] = {&S.edit.tm_year, &S.edit.tm_mon, &S.edit.tm_mday, &S.edit.tm_hour, &S.edit.tm_min};
          *F[S.field] += d;
          S.edit.tm_isdst = -1; S.edit.tm_sec = 0; time_t t = mktime(&S.edit); localtime_r(&t, &S.edit);
          render(true);
        } else if (b == Btn::Confirm) {
          S.edit.tm_isdst = -1; hal::setTime(mktime(&S.edit));
          S.scr = Scr::Today; S.dayOffset = 0; render(false);
        }
        break;
    }
  }
}
