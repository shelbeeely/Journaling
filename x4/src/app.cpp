#include "app.h"
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>
#include "core/canvas.h"
#include "core/data.h"
#include "core/focus.h"
#include "core/net.h"
#include "core/sync.h"
#include "core/settings.h"
#include "core/update.h"
#include "hal/hal.h"
#include "gen/assets.h"
#include "gen/assets_large.h"
#include "lib/qrcodegen.hpp"

// ---------------------------------------------------------------------------------------------
// Layout constants (portrait 480 x 800). The four front buttons sit under the screen, so every
// screen ends with a hint bar whose four slots line up with them: Back · Confirm · Left · Right.
// Up/Down are the side rocker. Long-press Back anywhere opens Support.
// ---------------------------------------------------------------------------------------------
static const int M = 28;          // side margin
static const int CW = Canvas::W - 2 * M;
static int HINT_Y = 760;          // top of the hint bar (taller in large text, so labels can take two lines)

enum class Scr { Today, Checkin, Menu, Month, Support, Plan, Sync, Clock, Focus, Settings };
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

// ---------------------------------------------------------------------------------------------
// Settings (Menu, Settings; /kw/settings.txt): large text, bold, button remap, sleep and refresh timing.
// Every screen asks these accessors for its type, so large text is one switch, not a second app.
// ---------------------------------------------------------------------------------------------
static Settings ST;
static bool LG() { return ST.large; }
static const Font& fS() { return LG() ? FL_UI_S : F_UI_S; }        // captions, hint labels
static const Font& fUI() { return LG() ? FL_UI : F_UI; }           // rows, buttons
static const Font& fB() { return LG() ? FL_UI_B : F_UI_B; }        // emphasis
static const Font& fXL() { return LG() ? FL_UI_XL : F_UI_XL; }     // big numbers
static const Font& fBody() { return LG() ? FL_UI : F_BODY; }       // reading text (large text is Inter: Lora is only cut at one size)
static const Font& fBodyI() { return LG() ? FL_UI : F_BODY_I; }
static const Font& fTitle() { return LG() ? FL_TITLE : F_TITLE; }
static const Font& fSym() { return LG() ? FL_SYM : F_SYM; }
// Vertical rhythm that changes with the type size.
static int ROW_H = 43, LIST_Y = 100, HEAD_H = 36, VIEW_H = 660;   // Check in rows
static void applyStyle() {
  HINT_Y = LG() ? 724 : 760;
  ROW_H = LG() ? 62 : 43; HEAD_H = LG() ? 44 : 36; VIEW_H = HINT_Y - LIST_Y;
  C->setBold(ST.bold);
}

// The day she is living: before 4 a.m. that is still yesterday (README: "day rolls over at 4 a.m."),
// so a 00:40 "Evening meds" lands on the page she has open on paper. Today's Left/Right steps from here.
static std::string baseDay() { return logDay(hal::now()); }
static bool rolledBack() { return dayRolled(hal::now()); }

// The clock must be right before anything is saved: entries are filed under its date. It is wrong
// after a flat battery (device: not trusted) or when it says a date before the books were built.
static std::string clockProblem() {  // "" = fine
  if (!hal::timeValid()) return "The clock isn't set. Check-ins are filed under today's date, so set it first.";
  const std::string built = builtStamp(dateStr(hal::now()).substr(0, 7));
  if (!built.empty() && dateStr(hal::now()) < addDays(built, -1))
    return "The clock is behind your books (built " + built + "). Set the right date before checking in.";
  return "";
}
static bool clockOk() { return clockProblem().empty(); }

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------
// Labels are given in the order Back, Confirm, Left, Right. The four slots line up with the four front buttons, and with a
// button remap (Settings) a slot triggers a different action, so each label moves to the slot that now does it.
static void hintBar(const char* a, const char* b, const char* c, const char* d) {
  C->hline(0, HINT_Y, Canvas::W, true);
  const char* L[4] = {a, b, c, d};
  static const Btn LOGICAL[4] = {Btn::Back, Btn::Confirm, Btn::Left, Btn::Right};
  for (int slot = 0; slot < 4; slot++) {
    const char* t = nullptr;
    for (int k = 0; k < 4; k++) if (settingsMap(ST, LOGICAL[slot]) == LOGICAL[k]) t = L[k];  // the action this physical button now does
    if (!t || !*t) continue;
    const int cx = Canvas::W * (2 * slot + 1) / 8;
    if (!LG()) { C->textCenter(fS(), cx, HINT_Y + 28, t, &fSym()); continue; }
    // Large text: a label wider than its slot breaks at its last space onto a second line.
    const int room = Canvas::W / 4 - 6;
    char one[40]; snprintf(one, sizeof one, "%s", t);
    char* sp = strrchr(one, ' ');
    if (C->width(fS(), t, &fSym()) <= room || !sp) { C->textCenter(fS(), cx, HINT_Y + 46, t, &fSym()); continue; }
    *sp = 0;
    C->textCenter(fS(), cx, HINT_Y + 34, one, &fSym());
    C->textCenter(fS(), cx, HINT_Y + 62, sp + 1, &fSym());
  }
}

static void header(const char* title, const char* sub, int icon = -1) {
  int x = M;
  if (icon >= 0) { C->icon(icon, M, LG() ? 26 : 30, 36); x = M + 46; }
  C->text(fTitle(), x, 62, title);
  if (sub && *sub) C->textRight(fS(), Canvas::W - M, 60, sub, &fSym());
  C->fill(M, 80, CW, 3);
}

static void chip(int x, int baseline, const char* t, bool inverse) {
  const int w = C->width(fS(), t) + 10, up = LG() ? 21 : 16, h = LG() ? 28 : 21;
  if (inverse) C->fill(x, baseline - up, w, h); else C->rect(x, baseline - up, w, h, 1);
  C->text(fS(), x + 5, baseline, t, !inverse);
}

static int chips(int right, int baseline, const std::string& how) {
  // right-aligned row of TEXT / CALL / CHAT... chips; TEXT is black so it stands out
  std::vector<std::string> v; size_t a = 0;
  while (a < how.size()) { size_t b = how.find(' ', a); if (b == std::string::npos) b = how.size(); if (b > a) v.push_back(how.substr(a, b - a)); a = b + 1; }
  int x = right;
  for (int i = (int)v.size() - 1; i >= 0; i--) {
    const int w = C->width(fS(), v[i].c_str()) + 10;
    x -= w; chip(x, baseline, v[i].c_str(), v[i] == "TEXT"); x -= 5;
  }
  return x;
}

// Break text into lines no wider than w, greedily by words (same rule as Canvas::wrap), without
// drawing. A word wider than the box is split between code points so nothing runs off the edge.
static void breakLines(const Font& f, const std::string& s, int w, std::vector<std::string>& out) {
  std::string line;
  size_t i = 0;
  while (i < s.size()) {
    while (i < s.size() && s[i] == ' ') i++;
    if (i >= s.size()) break;
    size_t j = s.find(' ', i); if (j == std::string::npos) j = s.size();
    std::string word = s.substr(i, j - i); i = j;
    std::string trial = line.empty() ? word : line + " " + word;
    if (C->width(f, trial.c_str()) <= w) { line = trial; continue; }
    if (!line.empty()) { out.push_back(line); line.clear(); }
    while (C->width(f, word.c_str()) > w) {  // one over-long word: hard-split it
      size_t k = 0, fit = 0;
      while (k < word.size()) {
        size_t n = k + 1; while (n < word.size() && (word[n] & 0xC0) == 0x80) n++;
        if (fit && C->width(f, word.substr(0, n).c_str()) > w) break;
        fit = k = n;
      }
      out.push_back(word.substr(0, fit)); word.erase(0, fit);
    }
    line = word;
  }
  if (!line.empty()) out.push_back(line);
}

// Draws every line of `text` (no cutting, no "…"), one after another. Returns the baseline after the last line.
static int wrapAll(const Font& f, int x, int baseline, int w, const std::string& text, int lineH = 0, const Font* sym = nullptr) {
  std::vector<std::string> ls; breakLines(f, text, w, ls);
  const int lh = lineH ? lineH : f.lineHeight + 3;
  for (auto& l : ls) { C->text(f, x, baseline, l.c_str(), true, sym); baseline += lh; }
  return baseline;
}

static void battery(int x, int baseline) {
  const int p = hal::batteryPercent();
  if (p < 0) return;
  C->rect(x, baseline - 14, 30, 15, 2); C->fill(x + 30, baseline - 10, 3, 7);
  C->fill(x + 3, baseline - 11, 24 * p / 100, 9);
  char b[12]; snprintf(b, sizeof b, "%d%%", p);
  C->text(fS(), x + 40, baseline, b);
}

// ---------------------------------------------------------------------------------------------
// TODAY — also the sleep screen. Everything a glance needs, nothing to operate.
// ---------------------------------------------------------------------------------------------
// Large text: Today does not shrink to fit. Page 1 is the glance (date, sun, the first three calendar lines, care ticks,
// spoons/sleep/anxiety); Down goes on to the rest: every calendar line (only when there are more than three), then the
// season, the moon and "on this day". The sleep screen is always page 1.
static int todayPages = 1;
static void drawTodayLarge(bool sleeping, const std::string& date, const Day& d, const DayLog& log) {
  struct Row { int kind; std::string t; };  // 0 holiday, 1 note, 2 event, 3 routine
  std::vector<Row> rows;
  for (auto& n : d.notes) { const bool hol = n[0] == '!'; rows.push_back({hol ? 0 : 1, hol ? n.substr(1) : n}); }
  for (auto& e : d.events) rows.push_back({2, e});
  for (auto& r : d.routines) rows.push_back({3, r});
  const bool calPage = rows.size() > 3;
  todayPages = 1 + (calPage ? 1 : 0) + 1;
  if (sleeping || S.page >= todayPages) S.page = sleeping ? 0 : todayPages - 1;
  const int pg = S.page;
  const int aboutPg = todayPages - 1;
  auto rowMark = [&](const Row& r, int y) {  // the same marks as the small page
    if (r.kind == 2) C->circle(M + 9, y - 10, 8, 2);
    else if (r.kind == 3) C->icon(IC_PRN, M - 2, y - 26, 36);
  };
  const int mon = atoi(date.substr(5, 2).c_str()), dd = atoi(date.substr(8, 2).c_str());
  int y;
  if (pg == 0) {
    std::string cap = d.weekday + " · " + monthName(mon);
    for (auto& ch : cap) if (ch >= 'a' && ch <= 'z') ch -= 32;
    C->text(fB(), M, 44, cap.c_str());
    if (rolledBack() && S.dayOffset == 0) C->text(fS(), M, 72, ("last night · ▶ " + prettyDate(addDays(date, 1)).substr(5)).c_str(), true, &fSym());
    else if (rolledBack() && S.dayOffset == 1) C->text(fS(), M, 72, "new day · ◀ back", true, &fSym());
    else if (S.dayOffset) C->text(fS(), M, 72, S.dayOffset > 0 ? "future day" : "past day");
    char num[4]; snprintf(num, sizeof num, "%d", dd);
    const int nx = C->text(F_HUGE, M - 4, 178, num);
    C->text(fS(), nx + 10, 150, date.substr(0, 4).c_str());
    if (d.page > 0) { char pgs[24]; snprintf(pgs, sizeof pgs, "book p. %d", d.page); C->text(fS(), nx + 10, 178, pgs); }
    C->moon(Canvas::W - M - 42, 112, 40, d.moonDeg);
    char mp[64]; snprintf(mp, sizeof mp, "%d%% lit", d.lit);
    C->textRight(fS(), Canvas::W - M, 176, mp, &fSym());
    C->fill(M, 194, CW, 3);
    // Sun: two icons and times on one row, the length of the day under it.
    y = 240;
    C->icon(IC_SUNRISE, M, y - 28, 36); int x = C->text(fUI(), M + 44, y, d.rise.c_str());
    C->icon(IC_SUNSET, x + 22, y - 28, 36); C->text(fUI(), x + 66, y, d.set.c_str());
    C->text(fS(), M + 44, y + 30, (d.daylight + " of light").c_str());
    y += 46;
    C->hline(M, y, CW); y += 40;
    int shown = 0;
    for (auto& r : rows) {
      if (shown >= 3) break;
      rowMark(r, y);
      const int tx = r.kind >= 2 ? M + 34 : M;
      if (C->width(r.kind == 0 ? fB() : fUI(), r.t.c_str(), &fSym()) > CW - (tx - M)) { std::vector<std::string> one; breakLines(fUI(), r.t, CW - (tx - M) - 34, one); std::string cut = one.empty() ? r.t : one[0] + "…"; C->text(fUI(), tx, y, cut.c_str(), true, &fSym()); }
      else C->text(r.kind == 0 ? fB() : fUI(), tx, y, r.t.c_str(), true, &fSym());
      y += 40; shown++;
    }
    if (!shown) { C->text(fBodyI(), M, y, "Nothing on the calendar."); y += 40; }
    else if ((int)rows.size() > shown) { C->text(fS(), M + 34, y - 6, (calPage ? "+" + std::to_string(rows.size() - shown) + " more: press down" : "").c_str()); y += 30; }
    y += 2;
    C->hline(M, y, CW); y += 16;
    static const int tiles[] = {I_SHOWER, I_TEETH, I_JOY, I_TEXTED, I_SNACK};
    for (int i = 0; i < 5; i++) {
      const int tx = M + i * 84, idx = tiles[i];
      const bool on = log.has(idx) && log.get(idx);
      if (on) { C->fillRound(tx, y, 68, 60, 6); C->icon(ITEMS[idx].icon, tx + 16, y + 12, 36, false); }
      else { C->roundRect(tx, y, 68, 60, 6, 2); C->icon(ITEMS[idx].icon, tx + 16, y + 12, 36, true); }
    }
    y += 62 + 34;
    char a[32], b[40], sv[8] = "–", zv[8] = "–", av[8] = "–";
    if (log.has(I_SPOONS)) snprintf(sv, sizeof sv, "%d", log.get(I_SPOONS));
    if (log.has(I_SLEEP)) snprintf(zv, sizeof zv, "%dh", log.get(I_SLEEP));
    if (log.has(I_ANXIETY)) snprintf(av, sizeof av, "%d", log.get(I_ANXIETY));
    if (log.has(I_SPOONS) || log.has(I_SLEEP) || log.has(I_ANXIETY)) {
      snprintf(a, sizeof a, "%s spoons left", sv); snprintf(b, sizeof b, "Sleep %s · Anxiety %s", zv, av);
      C->text(fUI(), M, y, a); C->text(fUI(), M, y + 36, b, true, &fSym()); y += 36;
    } else C->text(fUI(), M, y, "No check-in yet today.");
    y += 32;
    C->text(fS(), M, y, "Meds, meals, water, mood: on paper");
    if (log.orphans) { y += 28; C->text(fS(), M, y, (std::to_string(log.orphans) + " older custom entr" + (log.orphans == 1 ? "y" : "ies") + " kept").c_str()); }
  } else if (calPage && pg == 1) {
    header("Calendar", prettyDate(date).c_str(), IC_CAL);
    y = 134;
    for (auto& r : rows) {
      if (y > HINT_Y - 40) break;
      const int tx = r.kind >= 2 ? M + 34 : M;
      rowMark(r, y);
      const int ny = wrapAll(r.kind == 0 ? fB() : fUI(), tx, y, CW - (tx - M), r.t, 34, &fSym());
      y = ny + 12;
    }
  } else {
    header("This day", prettyDate(date).c_str(), IC_LEAF);
    y = 128;
    C->icon(IC_LEAF, M, y - 30, 36);
    y = wrapAll(fBodyI(), M + 46, y, CW - 46, d.season, 34);
    { char mp[80]; snprintf(mp, sizeof mp, "Moon %d%% lit · %s", d.lit, d.moonSign.c_str()); C->text(fS(), M + 46, y, mp, true, &fSym()); y += 30; }
    if (!d.moonIn.empty()) { C->text(fS(), M + 46, y, ("enters " + d.moonIn).c_str(), true, &fSym()); y += 34; }
    y += 8; C->hline(M, y, CW); y += 36;
    if (!d.fact.empty()) {
      C->text(fS(), M, y, "ON THIS DAY"); y += 38;
      wrapAll(fBody(), M, y, CW, d.fact, 34);
    }
  }
  (void)aboutPg;
  if (sleeping) {
    C->hline(0, HINT_Y, Canvas::W);
    battery(M, HINT_Y + 34);
    C->textRight(fS(), Canvas::W - M, HINT_Y + 34, clockOk() ? ("Updated " + clockStr(hal::now())).c_str() : "Clock not set");
    C->textCenter(fS(), Canvas::W / 2, HINT_Y + 66, "Press power to wake");
  } else {
    hintBar(S.dayOffset ? "Today" : "Menu", "Check in", "◀ day", "day ▶");
    if (todayPages > 1) {
      char pgs[24]; snprintf(pgs, sizeof pgs, "%d / %d  down: more", pg + 1, todayPages);
      if (pg + 1 == todayPages) snprintf(pgs, sizeof pgs, "%d / %d  up: back", pg + 1, todayPages);
      C->textRight(fS(), Canvas::W - M, HINT_Y - 10, pgs, &fSym());
    }
  }
}

static void drawToday(bool sleeping) {
  todayPages = 1;
  const std::string date = addDays(baseDay(), S.dayOffset);
  Day d; loadDay(date, d);
  DayLog log; loadDayLog(date, log);
  C->clear();
  int y;
  if (!d.ok) {
    header("Keeping Watch", prettyDate(date).c_str());
    C->wrap(fBody(), M, 150, CW, ("No day pack for " + date.substr(0, 7) + " on the card. Copy the kw-update folder "
                                 "from the journal build to the SD card, or upload it from the Wi-Fi page (Menu, then Wi-Fi sync).").c_str());
    hintBar("Menu", "Check in", "◀ day", "day ▶");
    return;
  }
  if (LG()) { drawTodayLarge(sleeping, date, d, log); return; }
  // Masthead: weekday · month, huge date numeral, moon on the right.
  int mon = atoi(date.substr(5, 2).c_str()), dd = atoi(date.substr(8, 2).c_str());
  std::string cap = d.weekday + " · " + monthName(mon);
  for (auto& ch : cap) if (ch >= 'a' && ch <= 'z') ch -= 32;
  C->text(fB(), M, 52, cap.c_str());
  char num[4]; snprintf(num, sizeof num, "%d", dd);
  const int nx = C->text(F_HUGE, M - 4, 160, num);
  C->text(fS(), nx + 10, 158, date.substr(0, 4).c_str());
  C->text(fBody(), nx + 10, 132, d.planet.c_str(), true, &fSym());
  C->moon(Canvas::W - M - 50, 104, 46, d.moonDeg);
  char mp[64]; snprintf(mp, sizeof mp, "%d%% · %s", d.lit, d.moonSign.c_str());
  C->textRight(fS(), Canvas::W - M, 176, mp, &fSym());
  if (rolledBack() && S.dayOffset == 0) C->textRight(fS(), Canvas::W - M, 36, ("last night · ▶ " + prettyDate(addDays(date, 1)).substr(5)).c_str(), &fSym());
  else if (rolledBack() && S.dayOffset == 1) C->textRight(fS(), Canvas::W - M, 36, "new day · ◀ back", &fSym());
  else if (S.dayOffset) C->textRight(fS(), Canvas::W - M, 36, S.dayOffset > 0 ? "future day" : "past day");
  if (d.page > 0) { char pgs[24]; snprintf(pgs, sizeof pgs, "book p. %d", d.page); C->text(fS(), nx + 10, 184, pgs); }
  C->fill(M, 192, CW, 3);

  // Sun and season.
  y = 228;
  C->icon(IC_SUNRISE, M, y - 20); int x = C->text(fUI(), M + 30, y, d.rise.c_str());
  C->icon(IC_SUNSET, x + 22, y - 20); x = C->text(fUI(), x + 52, y, d.set.c_str());
  C->textRight(fS(), Canvas::W - M, y, (d.daylight + " of light").c_str());
  y += 40;
  C->icon(IC_LEAF, M, y - 20);
  y = C->wrap(fBodyI(), M + 32, y, CW - 32, d.season.c_str(), 2);
  if (!d.moonIn.empty()) { C->text(fS(), M + 32, y - 4, ("Moon enters " + d.moonIn).c_str(), true, &fSym()); y += 24; }
  y += 6;
  C->hline(M, y, CW); y += 34;

  // Notes (holidays bold), one-off events, routines. Routines are text with a clock: paper is where they get ticked (S13).
  int shown = 0;
  const int total = (int)(d.notes.size() + d.events.size() + d.routines.size());
  for (auto& n : d.notes) {
    if (shown >= 3) break;
    const bool hol = n[0] == '!';
    C->text(hol ? fB() : fUI(), M, y, hol ? n.c_str() + 1 : n.c_str(), true, &fSym()); y += 30; shown++;
  }
  for (auto& e : d.events) {
    if (shown >= 5) break;
    C->circle(M + 7, y - 7, 6, 2); C->wrap(fUI(), M + 24, y, CW - 24, e.c_str(), 1); y += 30; shown++;
  }
  for (auto& r : d.routines) {
    if (shown >= 6) break;
    C->icon(IC_PRN, M - 2, y - 20, 24); C->wrap(fUI(), M + 30, y, CW - 30, r.c_str(), 1); y += 30; shown++;
  }
  if (!shown) { C->text(fBodyI(), M, y, "Nothing on the calendar."); y += 30; }
  else if (total > shown) { C->text(fS(), M + 24, y - 6, ("+" + std::to_string(total - shown) + " more on paper").c_str()); y += 26; }
  y += 4;
  C->hline(M, y, CW); y += 14;

  // Today's care at a glance, the X4's half of the split: filled tile = done. Same icons as the paper page.
  C->text(fS(), M, y + 14, "CARE TICKS");
  static const int tiles[] = {I_SHOWER, I_TEETH, I_JOY, I_TEXTED, I_SNACK};
  y += 26;
  for (int i = 0; i < 5; i++) {
    const int tx = M + i * 60, idx = tiles[i];
    const bool on = log.has(idx) && log.get(idx);
    if (on) { C->fillRound(tx, y, 48, 48, 6); C->icon(ITEMS[idx].icon, tx + 12, y + 12, 24, false); }
    else { C->roundRect(tx, y, 48, 48, 6, 2); C->icon(ITEMS[idx].icon, tx + 12, y + 12, 24, true); }
  }
  y += 78;
  // Only what was actually logged shows as a value; anything else is "–" (never a guessed default).
  // Mood, meds, meals and water are paper's: Today says so instead of showing a value.
  char feel[96], av[8] = "–", sv[8] = "–", zv[8] = "–";
  if (log.has(I_SPOONS)) snprintf(sv, sizeof sv, "%d", log.get(I_SPOONS));
  if (log.has(I_SLEEP)) snprintf(zv, sizeof zv, "%dh", log.get(I_SLEEP));
  if (log.has(I_ANXIETY)) snprintf(av, sizeof av, "%d", log.get(I_ANXIETY));
  snprintf(feel, sizeof feel, "%s spoons left  ·  Sleep %s  ·  Anxiety %s", sv, zv, av);
  C->text(fUI(), M, y, (log.has(I_SPOONS) || log.has(I_SLEEP) || log.has(I_ANXIETY)) ? feel : "No check-in yet today.");
  y += 26;
  C->text(fS(), M, y, "Meds, meals, water, mood: on paper");
  y += 16;
  if (log.orphans) { C->text(fS(), M, y + 6, (std::to_string(log.orphans) + " older custom entr" + (log.orphans == 1 ? "y" : "ies") + " kept in the log").c_str()); y += 26; }

  // On this day (the footer fact from the paper page).
  if (!d.fact.empty()) {
    const int bh = HINT_Y - 18 - y;
    if (bh > 90) {
      C->rect(M, y, CW, bh, 2);
      C->text(fS(), M + 14, y + 28, "ON THIS DAY");
      C->wrap(fBody(), M + 14, y + 58, CW - 28, d.fact.c_str(), (bh - 50) / fBody().lineHeight);
    }
  }
  if (sleeping) {
    C->hline(0, HINT_Y, Canvas::W);
    battery(M, HINT_Y + 28);
    C->textRight(fS(), Canvas::W - M, HINT_Y + 28,
                 clockOk() ? ("Updated " + clockStr(hal::now()) + " · press power to wake").c_str() : "Clock not set · press power");
  } else {
    hintBar(S.dayOffset ? "Today" : "Menu", "Check in", "◀ day", "day ▶");
  }
}

// ---------------------------------------------------------------------------------------------
// CHECK IN — the X4's half of the care split (spoons left, sleep, anxiety, care ticks), one press per item.
// ---------------------------------------------------------------------------------------------

// Paper-owned built-ins (meds, meals, mood) stay in ITEMS so old logs read, but they are not rows here.
static int prevShown(int i) { for (int k = i - 1; k >= 0; k--) if (!ITEMS[k].hidden) return k; return -1; }
static int lastShown() { for (int k = ITEM_COUNT - 1; k >= 0; k--) if (!ITEMS[k].hidden) return k; return 0; }
static int stepSel(int from, int dir) {  // next shown row up or down, wrapping
  int i = from;
  do { i = (i + dir + ITEM_COUNT) % ITEM_COUNT; } while (ITEMS[i].hidden);
  return i;
}
// A custom group starts a new section; built-ins keep their original separators.
static bool newGroup(int i) {
  const int p = prevShown(i);
  if (p < 0) return false;
  if (i < BUILTIN_COUNT) return strcmp(ITEMS[p].group, ITEMS[i].group) != 0;
  return i == BUILTIN_COUNT || ITEMS[i - 1].group != ITEMS[i].group;
}
static bool hasHeading(int i) { return i >= BUILTIN_COUNT && newGroup(i) && ITEMS[i].group[0]; }
// Top of row i in list coordinates (before scrolling); headings sit above their first row.
static int rowTop(int i) {
  int y = 0;
  for (int k = 0; k <= i; k++) { if (ITEMS[k].hidden) continue; if (hasHeading(k)) y += HEAD_H; if (k < i) y += ROW_H; }
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

// Large text: a label that does not fit its width goes onto two lines of the caption size instead of being cut at "…".
static void labelLarge(int x, int y, int w, const char* s) {
  if (C->width(fUI(), s, &fSym()) <= w) { C->text(fUI(), x, y + 40, s, true, &fSym()); return; }
  std::vector<std::string> ls; breakLines(fS(), s, w, ls);
  if (ls.size() < 2) { fitText(fS(), x, y + 40, w, s); return; }
  C->text(fS(), x, y + 27, ls[0].c_str());
  std::string rest = ls[1]; for (size_t k = 2; k < ls.size(); k++) rest += " " + ls[k];
  fitText(fS(), x, y + 55, w, rest.c_str());
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
  const std::string date = addDays(baseDay(), S.dayOffset);
  DayLog log; loadDayLog(date, log);
  C->clear();
  // The date it will log to, always in the corner; "last night" when it is after midnight but before 4 a.m.
  std::string sub = prettyDate(date);
  if (rolledBack() && S.dayOffset == 0) sub += " · last night";
  header("Check in", sub.c_str(), IC_CHECK);
  // Scroll only when the list is taller than the screen (never with the built-ins alone).
  const int total = rowTop(lastShown()) + ROW_H;
  if (total <= VIEW_H) S.scroll = 0;
  else {
    const int top = rowTop(S.sel) - (hasHeading(S.sel) ? HEAD_H : 0), bottom = rowTop(S.sel) + ROW_H;
    if (top < S.scroll) S.scroll = top;
    if (bottom > S.scroll + VIEW_H) S.scroll = bottom - VIEW_H;
    if (S.sel == 0) S.scroll = 0;
  }
  for (int i = 0; i < ITEM_COUNT; i++) {
    const Item& it = ITEMS[i];
    if (it.hidden) continue;
    const int ry = rowTop(i) - S.scroll;
    if (hasHeading(i) && ry - HEAD_H >= 0 && ry <= VIEW_H) {
      std::string H = it.group; for (auto& ch : H) if (ch >= 'a' && ch <= 'z') ch -= 32;
      C->hline(M, LIST_Y + ry - HEAD_H, CW);
      C->wrap(fS(), M, LIST_Y + ry - HEAD_H + (LG() ? 32 : 27), CW, H.c_str(), 1);
    }
    if (ry < 0 || ry + ROW_H > VIEW_H) continue;  // off screen: rows are drawn whole or not at all
    const int y = LIST_Y + ry;
    if (newGroup(i) && !hasHeading(i)) C->hline(M, y, CW);
    const bool lg = LG();
    const int base = y + (lg ? 40 : 29), mid = y + ROW_H / 2, lx = M + (lg ? 56 : 40);
    if (it.icon >= 0) { if (lg) C->icon(it.icon, M + 2, y + 13, 36); else C->icon(it.icon, M + 4, y + 9); }
    else C->fillCircle(M + (lg ? 20 : 16), mid, lg ? 6 : 4);  // custom items: a neutral dot
    const int R = Canvas::W - M - 8;
    int ctrl = 0;  // width of the control on the right, so long custom labels can be cut short
    switch (it.kind) {
      case Kind::Toggle: if (lg) C->checkbox(R - 34, y + 14, 34, log.get(i)); else C->checkbox(R - 24, y + 9, 26, log.get(i)); ctrl = lg ? 34 : 26; break;
      case Kind::Dots: dotState(R - (lg ? 16 : 12), mid, lg ? 16 : 12, log.get(i)); ctrl = lg ? 34 : 26; break;
      case Kind::Stamp: {
        std::string t = log.stamps.empty() ? "tap to log time" : log.stamps.back();
        if (log.stamps.size() > 1) t += " (" + std::to_string(log.stamps.size()) + ")";
        C->textRight(fUI(), R, base, t.c_str());
        break;
      }
      case Kind::Scale: {
        if (lg && it.hi - it.lo + 1 > 6) {  // large text: a long scale is its number ("7 / 10", "-2"), not eleven small circles
          char nb[24];
          if (!log.has(i)) strcpy(nb, "–");
          else if (it.lo < 0) snprintf(nb, sizeof nb, log.get(i) > 0 ? "+%d" : "%d", log.get(i));
          else snprintf(nb, sizeof nb, "%d / %d", log.get(i), it.hi);
          C->textRight(fB(), R, base, nb, &fSym());
          ctrl = C->width(fB(), it.lo < 0 ? "+0" : "00 / 00", &fSym());
          break;
        }
        const int n = it.hi - it.lo + 1, r = lg ? (n > 8 ? 9 : 12) : (n > 8 ? 7 : 9), gap = n > 8 ? 4 : (lg ? 8 : 7), w = n * (2 * r) + (n - 1) * gap;
        C->bubbles(R - w, mid, n, log.has(i) ? log.get(i) - it.lo : -1, r, gap);
        ctrl = w;
        if (i >= BUILTIN_COUNT) {  // custom scales can start at 0 or run -k..+k, so say the number: "+2", "-1", "0", "–" when unset
          char nb[12]; if (log.has(i)) snprintf(nb, sizeof nb, it.lo < 0 && log.get(i) > 0 ? "+%d" : "%d", log.get(i)); else strcpy(nb, "–");
          C->textRight(fB(), R - w - 10, base, nb, &fSym());
          ctrl += 10 + C->width(fB(), "+00", &fSym());
        }
        break;
      }
      case Kind::Choice: {  // the chosen word (–  when unset); the label gives way to the longest option so it never jumps as you cycle
        C->textRight(fB(), R, base, log.has(i) ? it.opts[log.get(i)] : "–", &fSym());
        for (int k = 0; k < it.nopts; k++) { const int cw = C->width(fB(), it.opts[k], &fSym()); if (cw > ctrl) ctrl = cw; }
        break;
      }
      case Kind::Count: {
        char b[16]; snprintf(b, sizeof b, "%d", log.get(i));
        if (i == I_SPOONS && lg) {  // large text: the number, not twelve small spoons
          char sb[16]; snprintf(sb, sizeof sb, "%s / 12", log.has(i) ? b : "–");
          C->textRight(fB(), R, base, sb);
          ctrl = C->width(fB(), "12 / 12");
        } else if (i == I_SPOONS) {  // spoons: draw them, filled = left
          for (int k = 0; k < 12; k++) {
            const int sx = R - (12 - k) * 15, on = log.has(i) && k < log.get(i);  // unset: all outlines, not 12 full
            if (on) { C->fillCircle(sx + 5, y + 16, 5); C->fill(sx + 4, y + 20, 3, 11); }
            else { C->circle(sx + 5, y + 16, 5, 2); C->vline(sx + 5, y + 21, 10); }
          }
        } else {
          if (i >= BUILTIN_COUNT && it.hi < 99) {  // a capped count says its cap: "3 / 10"
            char cb[24]; snprintf(cb, sizeof cb, "%s / %d", log.has(i) ? b : "–", it.hi);
            C->textRight(fB(), R, base, cb);
            ctrl = C->width(fB(), "99 / 99");
          } else {
            C->textRight(fB(), R, base, log.has(i) ? b : "–");
            ctrl = C->width(fB(), "999");
          }
        }
        break;
      }
    }
    if (lg) labelLarge(lx, y, R - ctrl - 16 - lx, it.label);
    else if (i < BUILTIN_COUNT) C->text(fUI(), lx, base, it.label);
    else fitText(fUI(), lx, base, R - ctrl - 16 - lx, it.label);
    if (i == S.sel) C->invert(M - 8, y + 2, CW + 16, ROW_H - 4);
  }
  if (total > VIEW_H) {  // a quiet scroll bar in the right margin
    const int barH = VIEW_H * VIEW_H / total, barY = LIST_Y + (VIEW_H - barH) * S.scroll / (total - VIEW_H);
    C->vline(Canvas::W - 10, LIST_Y, VIEW_H);
    C->fill(Canvas::W - 12, barY, 5, barH);
  }
  const Item& cur = ITEMS[S.sel];
  const bool adjustable = cur.kind == Kind::Scale || cur.kind == Kind::Count || cur.kind == Kind::Dots || cur.kind == Kind::Choice;
  const char* ok = cur.kind == Kind::Stamp ? "Log now" : cur.kind == Kind::Toggle ? "Tick" : cur.kind == Kind::Dots ? "Fill"
                   : cur.kind == Kind::Choice ? (log.has(S.sel) ? "Next" : "Set") : "Set";
  const bool ch = cur.kind == Kind::Choice;
  hintBar("Done", ok, adjustable ? (ch ? "◀" : "−") : "", adjustable ? (ch ? "▶" : "+") : "");
}

static void checkinPress(Btn b) {
  const std::string date = addDays(baseDay(), S.dayOffset);
  DayLog log; loadDayLog(date, log);
  const Item& it = ITEMS[S.sel];
  const time_t now = hal::now();
  if (b == Btn::Confirm) {
    if (it.kind == Kind::Toggle) saveItem(date, S.sel, log.get(S.sel) ? 0 : 1, now);
    else if (it.kind == Kind::Stamp) saveStamp(date, now);
    else if (it.kind == Kind::Dots) saveItem(date, S.sel, (log.get(S.sel) + 1) % 3, now);  // empty → half → full
    else if (it.kind == Kind::Choice) saveItem(date, S.sel, log.has(S.sel) ? (log.get(S.sel) + 1) % it.nopts : it.def, now);  // first press sets the default, then next word
    else if (!log.has(S.sel)) saveItem(date, S.sel, it.def, now);  // "Set" confirms the default value
  } else if ((b == Btn::Left || b == Btn::Right) && it.kind == Kind::Choice) {
    saveItem(date, S.sel, (log.get(S.sel) + (b == Btn::Right ? 1 : it.nopts - 1)) % it.nopts, now);  // wraps round the words
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
  {"Check in", "spoons, sleep, anxiety, care ticks", IC_CHECK, Scr::Checkin},
  {"This month", "totals for your Keeper handoff", IC_CHART, Scr::Month},
  {"Support", "numbers to text or call", IC_HEART, Scr::Support},
  {"My safety plan", "and people to text", IC_PERSON, Scr::Plan},
  {"Wi-Fi", "hotspot, your Wi-Fi, sync", IC_WIFI, Scr::Sync},
  {"Clock", "set the date and time", IC_PRN, Scr::Clock},
  {"Focus", "silent work rounds and breaks", IC_WORK, Scr::Focus},
  {"Settings", "text size, buttons, sleep", IC_GEAR, Scr::Settings},
};
static const int MENU_N = sizeof(MENU) / sizeof(MENU[0]);
static int menuIndex(Scr s) { for (int i = 0; i < MENU_N; i++) if (MENU[i].to == s) return i; return 0; }
static void drawMenu() {
  C->clear();
  header("Keeping Watch", LG() ? "" : prettyDate(baseDay()).c_str());
  const int rh = LG() ? 58 : 66;
  for (int i = 0; i < MENU_N; i++) {
    const int y = 100 + i * rh;
    C->icon(MENU[i].icon, M + 4, y + (rh - 36) / 2, 36);
    if (LG()) C->text(fB(), M + 60, y + 38, MENU[i].label);  // large text: the one-line description of the highlighted entry goes below the list
    else { C->text(fB(), M + 60, y + 28, MENU[i].label); C->text(fS(), M + 60, y + 50, MENU[i].sub); }
    if (i < MENU_N - 1) C->hline(M, y + rh - 4, CW);
    if (i == S.sel) C->invert(M - 8, y + 2, CW + 16, rh - 8);
  }
  if (LG()) {
    wrapAll(fS(), M, HINT_Y - 74, CW - 96, MENU[S.sel].sub, 29);
    battery(Canvas::W - M - 84, HINT_Y - 14);
  } else battery(M, HINT_Y - 16);
  hintBar("Close", "Open", "", "");
}

// ---------------------------------------------------------------------------------------------
// THIS MONTH — the numbers the Keeper's "Closing <month>" page asks for, already added up.
// ---------------------------------------------------------------------------------------------
static int monthPages = 1;
static void drawMonth() {
  monthPages = 1;
  const std::string bd = baseDay();
  int y0 = atoi(bd.c_str()), m0 = atoi(bd.c_str() + 5) + S.monthOffset;
  while (m0 < 1) { m0 += 12; y0--; }
  while (m0 > 12) { m0 -= 12; y0++; }
  MonthStats s; monthStats(y0, m0, s);
  char ym[8]; snprintf(ym, sizeof ym, "%04d-%02d", y0, m0);
  const std::string built = builtStamp(ym);  // which build the pack on the card comes from (the book prints the same date)
  char sub[16]; snprintf(sub, sizeof sub, "%d", y0);
  C->clear();
  header(monthName(m0).c_str(), sub, IC_CHART);
  if (!built.empty()) C->textRight(fS(), Canvas::W - M, LG() ? 32 : 36, ("pack " + built).c_str());
  // Two big tiles are Keeper boxes (labels match the Closing page and the Keeper: journal/handoff.mjs, check-handoff.mjs);
  // the rest is what only the X4 counts. Mood, meds, meals and work hours are on the paper tracker.
  struct Stat { const char* label; char val[16]; const char* unit; };
  Stat st[4];
  auto set = [&](int i, const char* l, const char* u, const char* fmt, double v, bool have) {
    st[i].label = l; st[i].unit = u; if (have) snprintf(st[i].val, 16, fmt, v); else strcpy(st[i].val, "–");
  };
  set(0, "Good-spoon days", "4+ left", "%.0f", s.goodSpoonDays, s.spoonsN);
  set(1, "Avg sleep", "hours", "%.1f", s.avgSleep, s.sleepN);
  set(2, "Avg spoons left", "of 12", "%.1f", s.avgSpoons, s.spoonsN);
  set(3, "Avg anxiety", "0–3", "%.1f", s.avgAnxiety, s.anxietyN);
  if (LG()) {
    // Large text: page 1 is the two Keeper boxes, the other two averages and the care-tick counts; page 2 is the calendar
    // of care ticks by day (Up/Down turn pages, Left/Right change month).
    monthPages = 2;
    if (S.page >= monthPages) S.page = monthPages - 1;
    if (S.page == 0) {
      // The two Keeper boxes are full-width rows (their labels are long); the two other averages sit side by side under them.
      for (int i = 0; i < 2; i++) {
        const int y = 104 + i * 92;
        C->rect(M, y, CW, 84, 3);
        C->text(fS(), M + 12, y + 34, st[i].label);
        C->text(fS(), M + 12, y + 68, st[i].unit, true, &fSym());
        const int uw = C->width(fS(), st[i].unit, &fSym());
        (void)uw;
        C->textRight(fXL(), Canvas::W - M - 14, y + 66, st[i].val);
      }
      for (int i = 2; i < 4; i++) {
        const int x = M + (i - 2) * (CW / 2 + 6), y = 292;
        C->rect(x, y, CW / 2 - 6, 108, 1);
        C->text(fS(), x + 10, y + 30, st[i].label);
        const int ex = C->text(fXL(), x + 10, y + 88, st[i].val);
        C->text(fS(), ex + 8, y + 88, st[i].unit, true, &fSym());
      }
      static const int ic4[] = {IC_SHOWER, IC_TEETH, IC_JOY, IC_TEXT};
      static const char* nm4[] = {"Showers", "Teeth", "Enjoyed", "Texted"};
      const int cnt[4] = {s.showers, s.teeth, s.joy, s.texted}, w = CW / 2 - 6;
      for (int i = 0; i < 4; i++) {
        const int x = M + (i % 2) * (w + 12), y = 412 + (i / 2) * 68;
        char b[8]; if (s.loggedDays) snprintf(b, sizeof b, "%d", cnt[i]); else strcpy(b, "–");
        C->rect(x, y, w, 60, 1);
        C->icon(ic4[i], x + 8, y + 12, 36);
        C->text(fS(), x + 52, y + 38, nm4[i]);
        C->textRight(fB(), x + w - 10, y + 40, b);
      }
      std::string pack; int kp = 0;
      char path[24]; snprintf(path, sizeof path, "/kw/%04d-%02d.txt", y0, m0);
      if (hal::readFile(path, pack)) { size_t p = pack.find("\nkeeper="); if (p != std::string::npos) kp = atoi(pack.c_str() + p + 8); }
      char foot[96];
      if (kp) snprintf(foot, sizeof foot, "Keeper p. %d: copy the two bold boxes.", kp);
      else snprintf(foot, sizeof foot, "Keeper handoff: copy the two bold boxes.");
      int fy = wrapAll(fS(), M, 570, CW, foot, 29);
      wrapAll(fS(), M, fy + 6, CW, "Mood, meds, meals, work hours: paper tracker.", 29);
    } else {
      int y = 132;
      C->text(fS(), M, y, "CARE TICKS, BY DAY");
      struct tm first = {}; first.tm_year = y0 - 1900; first.tm_mon = m0 - 1; first.tm_mday = 1; first.tm_hour = 12; mktime(&first);
      const int lead = (first.tm_wday + 6) % 7, cellW = CW / 7, rows = (lead + s.days + 6) / 7, cellH = rows > 5 ? 60 : 68;
      static const char* WD = "MTWTFSS";
      y += 14;
      for (int i = 0; i < 7; i++) { char b[2] = {WD[i], 0}; C->textCenter(fS(), M + i * cellW + cellW / 2, y + 22, b); }
      y += 32;
      for (int d = 1; d <= s.days; d++) {
        const int k = lead + d - 1, cx = M + (k % 7) * cellW + cellW / 2, cy = y + (k / 7) * cellH + cellH / 2, n = s.doneByDay[d];
        char b[4]; snprintf(b, sizeof b, "%d", d);
        if (n) { C->fillCircle(cx, cy, 14 + n * 8 / 5); C->text(fS(), cx - C->width(fS(), b) / 2, cy + 8, b, false); }
        else C->text(fS(), cx - C->width(fS(), b) / 2, cy + 8, b);
      }
      int ly = y + rows * cellH + 26;
      C->text(fS(), M, ly, "Bigger dot: more care ticks that day.");
      if (s.focusRounds || s.focusInterruptions) {
        char fb[48]; snprintf(fb, sizeof fb, s.focusInterruptions ? "Focus %d · %d interrupted" : "Focus %d rounds", s.focusRounds, s.focusInterruptions);
        ly += 34; C->text(fS(), M, ly, fb, true, &fSym());
      }
      if (s.moodN || s.medsAny) {
        char old[80];
        if (s.moodN) snprintf(old, sizeof old, "Earlier X4 entries: mood %+.1f avg, meds %d days", s.avgMood, s.medsBoth);
        else snprintf(old, sizeof old, "Earlier X4 entries: meds %d days", s.medsBoth);
        wrapAll(fS(), M, ly + 34, CW, old, 29);
      }
    }
    char pgs[24]; snprintf(pgs, sizeof pgs, S.page == 0 ? "1 / 2  down: more" : "2 / 2  up: back");
    C->textRight(fS(), Canvas::W - M, HINT_Y - 10, pgs, &fSym());
    hintBar("Back", "", "◀ month", S.monthOffset == -1 && atoi(bd.c_str() + 8) <= 3 ? "this month ▶" : "month ▶");
    return;
  }
  for (int i = 0; i < 4; i++) {
    const int col = i % 2, row = i / 2, x = M + col * (CW / 2 + 6), y = 104 + row * 108;
    C->rect(x, y, CW / 2 - 6, 96, i < 2 ? 3 : 1);  // the two Keeper boxes get the heavier frame
    C->text(fS(), x + 12, y + 26, st[i].label);
    const int ex = C->text(fXL(), x + 12, y + 76, st[i].val);
    C->text(fS(), ex + 8, y + 76, st[i].unit);
  }
  // Care ticks: days each was ticked.
  {
    static const int ic4[] = {IC_SHOWER, IC_TEETH, IC_JOY, IC_TEXT};
    static const char* nm4[] = {"Showers", "Teeth", "Enjoyed", "Texted"};
    const int cnt[4] = {s.showers, s.teeth, s.joy, s.texted}, w = (CW - 3 * 8) / 4;
    for (int i = 0; i < 4; i++) {
      const int x = M + i * (w + 8), y = 320;
      char b[8]; if (s.loggedDays) snprintf(b, sizeof b, "%d", cnt[i]); else strcpy(b, "–");
      C->rect(x, y, w, 76, 1);
      C->icon(ic4[i], x + 8, y + 8, 24);
      C->text(fS(), x + 8, y + 68, nm4[i]);
      C->textRight(fB(), x + w - 8, y + 30, b);
    }
  }
  // Calendar: each day's dot grows with the care ticks done that day.
  int y = 424;
  C->text(fS(), M, y, "CARE TICKS, BY DAY");
  if (s.focusRounds || s.focusInterruptions) {  // a count, nothing more: no streaks, no goals
    char fb[48]; snprintf(fb, sizeof fb, s.focusInterruptions ? "Focus %d · %d interrupted" : "Focus %d rounds", s.focusRounds, s.focusInterruptions);
    C->textRight(fS(), Canvas::W - M, y, fb, &fSym());
  }
  y += 8;
  struct tm first = {}; first.tm_year = y0 - 1900; first.tm_mon = m0 - 1; first.tm_mday = 1; first.tm_hour = 12; mktime(&first);
  const int lead = (first.tm_wday + 6) % 7, cellW = CW / 7, rows = (lead + s.days + 6) / 7, cellH = rows > 5 ? 38 : 44;
  static const char* WD = "MTWTFSS";
  for (int i = 0; i < 7; i++) { char b[2] = {WD[i], 0}; C->textCenter(fS(), M + i * cellW + cellW / 2, y + 18, b); }
  y += 26;
  for (int d = 1; d <= s.days; d++) {
    const int k = lead + d - 1, cx = M + (k % 7) * cellW + cellW / 2, cy = y + (k / 7) * cellH + cellH / 2;
    const int n = s.doneByDay[d];
    char b[4]; snprintf(b, sizeof b, "%d", d);
    if (n) C->fillCircle(cx, cy, 5 + n * 12 / 5 > 17 ? 17 : 5 + n * 12 / 5);
    else C->circle(cx, cy, 5, 1);
    if (!n) C->text(fS(), cx + 8, cy - 6, b);
  }
  // Logs from before the care split may still hold mood and meds: read, never lost, shown as one quiet line.
  if (s.moodN || s.medsAny) {
    char old[80];
    if (s.moodN) snprintf(old, sizeof old, "Earlier X4 entries: mood %+.1f avg, meds %d days", s.avgMood, s.medsBoth);
    else snprintf(old, sizeof old, "Earlier X4 entries: meds %d days", s.medsBoth);
    C->text(fS(), M, HINT_Y - 52, old);
  }
  // Where it goes in the Keeper.
  std::string pack; int kp = 0;
  char path[24]; snprintf(path, sizeof path, "/kw/%04d-%02d.txt", y0, m0);
  if (hal::readFile(path, pack)) { size_t p = pack.find("\nkeeper="); if (p != std::string::npos) kp = atoi(pack.c_str() + p + 8); }
  char foot[96];
  if (kp) snprintf(foot, sizeof foot, "Keeper p. %d: copy the two bold boxes.", kp);
  else snprintf(foot, sizeof foot, "Keeper handoff: copy the two bold boxes.");
  C->text(fS(), M, HINT_Y - 30, foot);
  C->text(fS(), M, HINT_Y - 10, "Mood, meds, meals, work hours: paper tracker.");
  // First days of a month open on the month just finished (its totals go to the Keeper); ▶ reaches the new one.
  hintBar("Back", "", "◀ month", S.monthOffset == -1 && atoi(bd.c_str() + 8) <= 3 ? "this month ▶" : "month ▶");
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
  C->icon(IC_HEART, M, LG() ? 26 : 28, 36, false);
  C->text(fTitle(), M + 48, 62, "Support", false);
  C->text(fB(), Canvas::W - M - C->width(fB(), "Emergency 911"), 60, "Emergency 911", false);
  // Paginate: lay out entries top to bottom with every line of every entry (nothing is cut with "…"); a page ends when the
  // next entry would not fit. Large text just means fewer entries per page.
  const int nameLH = fB().lineHeight + 2, detLH = LG() ? 36 : fUI().lineHeight, detOff = LG() ? 40 : 28, gap = LG() ? 46 : 40, headAdv = LG() ? 54 : 40, chipW = LG() ? 88 : 64;
  int page = 0, y = 120; std::string lastH;
  supportPages = 1;
  for (size_t i = 0; i < v.size(); i++) {
    const Entry& e = v[i];
    const bool canText = e.how.find("TEXT") != std::string::npos;
    std::vector<std::string> nl, dl;
    breakLines(fB(), e.name, canText ? CW - chipW : CW, nl);
    breakLines(fUI(), e.detail, CW, dl);
    if (nl.empty()) nl.push_back("");
    const int need = (e.h != lastH ? headAdv : 0) + (int)(nl.size() - 1) * nameLH + detOff + (dl.empty() ? 0 : ((int)dl.size() - 1) * detLH) + gap;
    if (y + need > HINT_Y - 10 && y > 120) { page++; y = 120; lastH = ""; supportPages = page + 1; }
    const bool draw = page == S.page;
    if (e.h != lastH) {
      if (draw) { std::string H = e.h; for (auto& ch : H) if (ch >= 'a' && ch <= 'z') ch -= 32; C->text(fS(), M, y + 10, H.c_str()); C->hline(M, y + 18, CW); }
      y += headAdv; lastH = e.h;
    }
    if (draw) {
      // Only TEXT gets a badge: it is the one thing worth spotting at a glance.
      for (size_t k = 0; k < nl.size(); k++) C->text(fB(), M, y + (int)k * nameLH, nl[k].c_str());
      if (canText) chip(Canvas::W - M - (LG() ? 70 : 54), y, "TEXT", true);
      for (size_t k = 0; k < dl.size(); k++) C->text(fUI(), M, y + (int)(nl.size() - 1) * nameLH + detOff + (int)k * detLH, dl[k].c_str());
    }
    y += (int)(nl.size() - 1) * nameLH + detOff + (dl.empty() ? 0 : ((int)dl.size() - 1) * detLH) + gap;
  }
  if (v.empty()) wrapAll(fBody(), M, 150, CW, "Call or text 988, any hour. Text HOME to 741741. Copy the kw-update folder to the card for the full list.", LG() ? 36 : 28);
  char pg[16]; snprintf(pg, sizeof pg, "%d / %d", S.page + 1, supportPages);
  hintBar("Back", "Safety plan", S.page ? "◀ page" : "", S.page + 1 < supportPages ? "page ▶" : "");
  C->textRight(fS(), Canvas::W - M, HINT_Y - 10, pg);
}

// The plan is laid out as a flat list of lines, then paged with Up/Down like Support. A page breaks
// before a section when that section fits on one page; a longer section flows on, never mid-line.
// The "when talking is too hard" box sits under the text on the last page.
struct PlanLine { uint8_t kind; bool start; std::string s; int adv; };  // kind: 0 heading, 1 body, 2 dotted, 3 note, 4 gap
static int planPages = 1;
static void drawPlan() {
  static const char* const HELP = "“Hey, I’m having a hard time. I’m not up for a call. Can you text with me for a bit?”";
  std::vector<std::string> helpLines; breakLines(fBody(), HELP, CW - 28, helpLines);
  const int helpLH = LG() ? 38 : fBody().lineHeight;
  const int BOX_H = LG() ? 58 + (int)helpLines.size() * helpLH : 130;
  const int TOP = 120, BOX_Y = LG() ? HINT_Y - 34 - BOX_H : HINT_Y - 162;
  const int LIMIT = HINT_Y - 44, LIMIT_LAST = BOX_Y - 14;  // lowest baseline on a page
  std::string f; hal::readFile("/kw/me.txt", f);
  size_t a = 0; bool any = false;
  std::vector<std::pair<std::string, std::string>> sec;
  while (a < f.size()) {
    size_t b = f.find('\n', a); if (b == std::string::npos) b = f.size();
    std::string line = f.substr(a, b - a); a = b + 1;
    if (!line.empty() && line.back() == '\r') line.pop_back();
    if (line.rfind("# ", 0) == 0 || line.empty()) continue;
    if (line[0] == '#') { sec.push_back({line.substr(1), ""}); continue; }
    if (!sec.empty()) { if (!sec.back().second.empty()) sec.back().second += "; "; sec.back().second += line; any = true; }
  }
  std::vector<PlanLine> L;
  std::vector<std::string> tmp;
  for (size_t i = 0; i < sec.size(); i++) {
    tmp.clear(); breakLines(fB(), std::to_string(i + 1) + ". " + sec[i].first, CW, tmp);
    for (size_t k = 0; k < tmp.size(); k++) L.push_back({0, k == 0, tmp[k], LG() ? 38 : 28});
    if (sec[i].second.empty()) { L.push_back({2, false, "", LG() ? 30 : 16}); continue; }
    tmp.clear(); breakLines(fBody(), sec[i].second, CW - 24, tmp);
    for (size_t k = 0; k < tmp.size(); k++) L.push_back({1, false, tmp[k], (LG() ? 37 : fBody().lineHeight) + (k + 1 == tmp.size() ? 8 : 0)});
  }
  if (!any) {
    L.push_back({4, true, "", 4});
    tmp.clear(); breakLines(fBodyI(), "Empty for now. Fill it in on the Wi-Fi page, or use the safety plan page at the back of your journal.", CW, tmp);
    for (auto& t : tmp) L.push_back({3, false, t, LG() ? 37 : fBodyI().lineHeight});
  }
  // How far lines [from, n) get on one page whose lowest baseline is `limit`.
  const int n = (int)L.size();
  auto fill = [&](int from, int limit) {
    int y = TOP, i = from;
    while (i < n && (y <= limit || L[i].kind == 4)) { y += L[i].adv; i++; }
    if (i >= n || i == from) return i == from ? from + 1 : n;
    int s = i; while (s > from && !L[s].start) s--;  // start of the section that did not fit
    if (s > from) {
      int h = 0, e = s; do { h += L[e].adv; e++; } while (e < n && !L[e].start);
      bool onlyHead = true; for (int k = s; k < i; k++) if (L[k].kind != 0) onlyHead = false;
      if (h - L[e - 1].adv <= LIMIT - TOP || onlyHead) return s;  // whole section fits a page, or only its heading would
    }
    return i;
  };
  // Page starts. Every page but the last may use the full height; the last one leaves room for the box.
  std::vector<int> starts;  // heap, no page cap: every line gets a page
  int pages = 0;
  for (int from = 0;;) {
    starts.push_back(from); pages++;
    const int e = fill(from, LIMIT_LAST);
    if (e >= n) break;
    const int full = fill(from, LIMIT);
    from = full >= n ? e : full;
  }
  planPages = pages;
  if (S.page >= pages) S.page = pages - 1;
  const bool last = S.page == pages - 1;
  const int endI = last ? n : starts[S.page + 1];

  C->clear();
  char pg[16] = "";
  if (pages > 1) snprintf(pg, sizeof pg, "%d / %d", S.page + 1, pages);
  header("My safety plan", pg, IC_PERSON);
  int y = TOP;
  for (int i = starts[S.page]; i < endI; i++) {
    const PlanLine& l = L[i];
    if (l.kind == 0) C->text(fB(), M, y, l.s.c_str());
    else if (l.kind == 1) C->text(fBody(), M + 24, y, l.s.c_str());
    else if (l.kind == 2) C->dotted(M + 24, y - 6, CW - 24);
    else if (l.kind == 3) C->text(fBodyI(), M, y, l.s.c_str());
    y += l.adv;
  }
  if (last) {
    C->rect(M, BOX_Y, CW, BOX_H, 3);
    C->text(fS(), M + 14, BOX_Y + 30, "WHEN TALKING IS TOO HARD, SEND:");
    if (LG()) wrapAll(fBody(), M + 14, BOX_Y + 66, CW - 28, HELP, helpLH);
    else C->wrap(fBody(), M + 14, BOX_Y + 60, CW - 28, HELP, 3);
  } else {  // quiet cue that the plan goes on
    const int x = Canvas::W - M - 14, cy = HINT_Y - 22;
    if (!LG()) C->textRight(fS(), x - 10, HINT_Y - 14, "more");
    C->line(x - 6, cy - 3, x, cy + 3, 2); C->line(x, cy + 3, x + 6, cy - 3, 2);
  }
  // The paper safety plan is the source of truth; this is a copy of it.
  C->text(fS(), M, HINT_Y - 10, "If this differs, trust the book.");
  hintBar("Back", "Support", S.page ? "◀ page" : "", S.page + 1 < pages ? "page ▶" : "");
}

// ---------------------------------------------------------------------------------------------
// WI-FI (Menu, Wi-Fi) — the hotspot, or the user's own Wi-Fi (BUILD-PLAN section 19, slice N1).
// core/net.cpp owns the modes, the saved networks (/kw/net.txt), the PIN and the one-client rule; these are the screens.
// The radio and its memory belong to this screen: nothing starts until a mode is picked, and leaving frees it all.
// ---------------------------------------------------------------------------------------------
static void drawQr(const char* text, int x, int y, int size) {
  using qrcodegen::QrCode;
  const QrCode qr = QrCode::encodeText(text, QrCode::Ecc::MEDIUM);
  const int n = qr.getSize(), s = size / (n + 4), off = (size - s * n) / 2;
  C->fill(x, y, size, size, false);
  for (int j = 0; j < n; j++) for (int i = 0; i < n; i++) if (qr.getModule(i, j)) C->fill(x + off + i * s, y + off + j * s, s, s);
}

enum class Wv : uint8_t { Home, Saved, Forget, Msg, SyncPre };
static struct WifiView {
  Wv v = Wv::Home;
  int sel = 0;        // Home row, or Saved row
  int fsel = 0;       // network offered for Forget
  const char* head = "";
  const char* msg = "";
  bool busy = false;  // the radio is starting (a blocking call): draw "Starting…" first
  int sig = -1;       // what the last draw showed, so the screen redraws only when something changed
  uint32_t lastPress = 0;
  int net = 0;        // saved network the sync would use
  bool fromSync = false;   // the message on screen is a sync result: Back returns to the Sync row
} WV;
static const int WIFI_HOME_N = 5;
static SyncCfg SC;      // /kw/sync.txt as loaded for the preview (the token never leaves this struct and is never drawn)
static SyncPlan SP;     // what is waiting to be sent, from the card alone
static bool wifiRunning() { return NC.phase != NetPhase::Off; }
static int wifiPages() { return (LG() && (NC.phase == NetPhase::Hotspot || NC.phase == NetPhase::Wifi)) ? 2 : 1; }
static int wifiSig() { return (int)NC.phase * 100000 + NC.clients() * 1000 + (NC.guard.locked ? 100 : 0) + (int)NC.why * 10 + (NC.apUp ? 1 : 0); }

static void wifiHelp(int y, const char* t) { wrapAll(fS(), M, y, CW, t, LG() ? 29 : 24); }

static void drawWifiHome() {
  C->clear();
  header("Wi-Fi", "radio off", IC_WIFI);
  const NetConfig& c = NC.cfg;
  char sub[3][64];
  snprintf(sub[0], sizeof sub[0], "%s", c.n == 0 ? "no network saved yet" : c.n == 1 ? c.nets[0].ssid : "");
  if (c.n > 1) snprintf(sub[0], sizeof sub[0], "%d networks saved", c.n);
  snprintf(sub[1], sizeof sub[1], "%s", c.n == 0 ? "none yet" : c.n == 1 ? "1 network" : "");
  if (c.n > 1) snprintf(sub[1], sizeof sub[1], "%d networks", c.n);
  static const char* LABEL[WIFI_HOME_N] = {"Hotspot", "On my Wi-Fi", "Join a network", "Saved networks", "Sync with Studio"};
  const char* SUB[WIFI_HOME_N] = {"its own network, no internet", sub[0], "add one, typed on your phone", sub[1], "send check-ins, on demand"};
  const int rh = LG() ? 94 : 84;
  for (int i = 0; i < WIFI_HOME_N; i++) {
    const int y = 100 + i * rh;
    C->icon(i == 3 ? IC_CHECK : IC_WIFI, M + 4, y + (rh - 36) / 2, 36);
    C->text(fB(), M + 60, y + (LG() ? 40 : 34), LABEL[i]);
    C->text(fS(), M + 60, y + (LG() ? 76 : 60), SUB[i], &fSym());
    C->hline(M, y + rh - 4, CW);
    if (i == WV.sel) C->invert(M - 8, y + 2, CW + 16, rh - 8);
  }
  static const char* HELP[WIFI_HOME_N] = {
    "Its own network: your phone joins it. No internet, and nothing is sent anywhere.",
    "Joins a saved network and serves the page there. Changes need the PIN. Nothing is sent to the internet.",
    "Add a network. Open the hotspot page on your phone and type the password there.",
    "Networks kept on the card. Connect to one, or forget it and its password.",
    "Sends your check-in log to your own Studio, only when you press Send. Off until you switch it on."};
  wifiHelp(100 + WIFI_HOME_N * rh + 22, HELP[WV.sel]);
  hintBar("Back", "Open", "", "");
}

// Saved networks: as many rows as fit, scrolled so the highlighted one is on screen. A long name wraps, it is never cut.
static int savedLines(int i, std::vector<std::string>* out = nullptr) {
  std::vector<std::string> ls; breakLines(fB(), NC.cfg.nets[i].ssid, CW - 24, ls);
  if (ls.size() > 2) ls.resize(2);
  if (out) *out = ls;
  return (int)ls.size();
}
static int savedRowH(int i) { return savedLines(i) * (LG() ? 36 : 30) + (LG() ? 58 : 50); }
static void drawWifiSaved() {
  C->clear();
  header("Saved networks", "", IC_WIFI);
  const int top = 100, room = HINT_Y - 12 - top;
  int first = 0;
  for (;;) { int h = 0; for (int i = first; i <= WV.sel; i++) h += savedRowH(i); if (h <= room || first >= WV.sel) break; first++; }
  int y = top;
  for (int i = first; i < NC.cfg.n; i++) {
    const int rh = savedRowH(i);
    if (y + rh > top + room) break;
    std::vector<std::string> ls; savedLines(i, &ls);
    int by = y + (LG() ? 34 : 28);
    for (auto& l : ls) { C->text(fB(), M + 8, by, l.c_str()); by += LG() ? 36 : 30; }
    C->text(fS(), M + 8, by + (LG() ? 2 : 0), i == NC.cfg.last ? "used last" : "saved");
    C->hline(M, y + rh - 4, CW);
    if (i == WV.sel) C->invert(M - 8, y + 2, CW + 16, rh - 8);
    y += rh;
  }
  hintBar("Back", "Connect", "", "Forget");
}

static void drawWifiForget() {
  C->clear();
  header("Forget?", "", IC_WIFI);
  int y = wrapAll(fB(), M, 150, CW, NC.cfg.nets[WV.fsel].ssid, LG() ? 40 : 34);
  wrapAll(fBody(), M, y + 24, CW, "The X4 deletes this network and its password from the card. You can add it again from your phone.", LG() ? 36 : 30);
  hintBar("Keep", "Forget", "", "");
}


// ---- Sync with Studio (BUILD-PLAN N2): a preview of what would be sent, then Send. Nothing is sent until Send is pressed. ----
static std::string kbText(long b) { char t[24]; if (b < 1024) snprintf(t, sizeof t, "%ld bytes", b); else snprintf(t, sizeof t, "%.1f KB", b / 1024.0); return t; }
static void drawSyncPre() {
  C->clear();
  header("Sync with Studio", "", IC_WIFI);
  const int lh = LG() ? 36 : 30;
  int y = 140;
  y = wrapAll(fS(), M, y, CW, std::string("TO  ") + SC.host, lh - 4) + 6;
  y = wrapAll(fS(), M, y, CW, std::string("OVER  ") + (NC.cfg.n ? NC.cfg.nets[WV.net].ssid : "no network"), lh - 4, &fSym()) + 14;
  y = wrapAll(fB(), M, y, CW, SC.log ? "Check-in log: ON" : "Check-in log: OFF", lh + 4) + 10;
  std::string will;
  if (!SC.log) will = "Nothing will be sent. The log holds health check-ins, so it stays off until you switch it on (Right).";
  else if (SP.pending == 0) will = "Nothing new: the Studio already has everything from the last sync.";
  else will = "Will send " + kbText(SP.pending) + " from " + std::to_string(SP.files) + (SP.files == 1 ? " month" : " months") + " of check-ins and Focus counts.";
  y = wrapAll(fBody(), M, y, CW, will, lh) + 10;
  if (SP.last) y = wrapAll(fS(), M, y, CW, "Last sent " + dateStr(SP.last) + " " + clockStr(SP.last), lh - 4) + 6;
  wrapAll(fS(), M, y, CW, "Only the log is sent: never the safety plan, Wi-Fi passwords, books or this token.", LG() ? 29 : 24);
  hintBar("Back", "Send", NC.cfg.n > 1 ? "Network" : "", SC.log ? "Log off" : "Log on");
}
static void drawWifiMsg() {
  C->clear();
  header("Wi-Fi", "", IC_WIFI);
  int y = 150;
  if (*WV.head) { y = wrapAll(fTitle(), M, y, CW, WV.head, LG() ? 50 : 42) + 10; }
  wrapAll(fBody(), M, y, CW, WV.msg, LG() ? 36 : 30);
  hintBar(WV.busy ? "" : "Back", "", "", "");
}

// Hotspot: the QR joins the network in one scan; the page is at 192.168.4.1.
static void drawHotspot(int page, int pages) {
  C->clear();
  header("Wi-Fi", NC.joinPage ? "join a network" : "hotspot on", IC_WIFI);
  if (page == 0) {
    char wifi[96]; snprintf(wifi, sizeof wifi, "WIFI:T:WPA;S:%s;P:%s;;", NC.apSsid, NC.apPass);
    const int qr = LG() ? 260 : 300;  // a QR needs its quiet zone and 6+ px modules: 260 px still scans fine
    drawQr(wifi, (Canvas::W - qr) / 2, LG() ? 100 : 104, qr);
    int y = LG() ? 396 : 440;
    C->textCenter(fS(), Canvas::W / 2, y, "1. SCAN TO JOIN, OR CONNECT TO"); y += LG() ? 32 : 34;
    C->textCenter(fB(), Canvas::W / 2, y, NC.apSsid); y += LG() ? 36 : 30;
    char pw[40]; snprintf(pw, sizeof pw, "password %s", NC.apPass);
    C->textCenter(fUI(), Canvas::W / 2, y, pw); y += LG() ? 48 : 50;
    C->textCenter(fS(), Canvas::W / 2, y, "2. OPEN"); y += 40;
    C->textCenter(fTitle(), Canvas::W / 2, y, "192.168.4.1"); y += LG() ? 40 : 44;
    if (!LG()) {
      const char* about = NC.joinPage ? "Under Wi-Fi on the page, pick your network and type its password. The X4 saves it to the card and joins."
                                      : "Upload month packs, download your check-in log, edit your safety plan, and set the clock from your phone. Nothing leaves this device.";
      if (NC.why != NetWhy::None) C->wrap(fB(), M, y, CW, (std::string("Last try: ") + netWhyText(NC.why) + " Nothing was saved.").c_str(), 5);   // the reason takes the place of the paragraph
      else C->wrap(fS(), M, y, CW, about, 4);
    } else if (NC.why != NetWhy::None) {
      C->textCenter(fB(), Canvas::W / 2, y + 12, "The last try failed:");
      C->textCenter(fS(), Canvas::W / 2, y + 44, "the reason is on the next page");
    }
  } else {
    int y = 150;
    const char* about = NC.joinPage ? "On the page, open Wi-Fi, pick your network and type its password there. The X4 saves it to the card and joins. The password is never uploaded or logged."
                                    : "Upload month packs, download your check-in log, edit your safety plan, and set the clock from your phone. Nothing leaves this device.";
    y = wrapAll(fUI(), M, y, CW, about, 34);
    if (NC.why != NetWhy::None) wrapAll(fB(), M, y + 16, CW, std::string("Last try: ") + netWhyText(NC.why), 34);
  }
  if (page == pages - 1 && NC.why == NetWhy::None) {
    const std::string built = builtStamp(baseDay().substr(0, 7));
    if (!built.empty()) C->text(fS(), M, HINT_Y - 10, ("pack " + built).c_str());  // compare with "Built" on the book's title page
  }
  if (page == pages - 1) { char cl[32]; snprintf(cl, sizeof cl, "%d connected", NC.clients()); C->textRight(fS(), Canvas::W - M, HINT_Y - 10, cl); }
  hintBar("Stop", "", page > 0 ? "◀ page" : "", page + 1 < pages ? "page ▶" : "");
}

static void spacedPin(const char* pin, char* out) { snprintf(out, 12, "%.3s %.3s", pin, pin + 3); }

// On the user's Wi-Fi: the address and the PIN, and a QR that opens the page in one scan.
static void drawLan(int page, int pages) {
  C->clear();
  header("Wi-Fi", "on your Wi-Fi", IC_WIFI);
  char url[48]; snprintf(url, sizeof url, "http://%s/", NC.ip);
  char local[48]; snprintf(local, sizeof local, "%s.local", NC.cfg.name);
  if (page == 0) {
    const int qr = LG() ? 220 : 260;
    drawQr(url, (Canvas::W - qr) / 2, 100, qr);
    int y = 100 + qr + (LG() ? 34 : 32);
    C->textCenter(fS(), Canvas::W / 2, y, "OPEN, ON THE SAME WI-FI"); y += LG() ? 44 : 44;
    C->textCenter(fTitle(), Canvas::W / 2, y, NC.ip); y += LG() ? 40 : 34;
    C->textCenter(fB(), Canvas::W / 2, y, local); y += LG() ? 46 : 44;
    if (NC.guard.locked) {
      C->textCenter(fS(), Canvas::W / 2, y, "LOCKED: TOO MANY WRONG PINS"); y += LG() ? 40 : 34;
      wrapAll(fS(), M, y, CW, "Press Back, then open Wi-Fi again for a new PIN.", LG() ? 29 : 24);
    } else {
      C->textCenter(fS(), Canvas::W / 2, y, "PIN, TO MAKE CHANGES"); y += LG() ? 60 : 56;
      char pin[12]; spacedPin(NC.guard.pin, pin);
      C->textCenter(fXL(), Canvas::W / 2, y, pin); y += LG() ? 36 : 34;
      if (NC.why != NetWhy::None) { if (!LG()) C->wrap(fB(), M, y, CW, netWhyText(NC.why), 3); else C->textCenter(fS(), Canvas::W / 2, y + 12, "A NOTE IS ON THE NEXT PAGE"); }
      else if (!LG()) C->wrap(fS(), M, y, CW, "New for each visit. Looking at the page needs no PIN. Changing anything, or opening your log or plan, does.", 3);
    }
  } else {
    int y = 150;
    C->text(fS(), M, y, "NETWORK"); y += LG() ? 40 : 34;
    y = wrapAll(fB(), M, y, CW, NC.ssid, 38) + 14;
    C->text(fS(), M, y, "THIS X4 IS CALLED"); y += LG() ? 40 : 34;
    y = wrapAll(fB(), M, y, CW, local, 38) + 14;
    y = wrapAll(fUI(), M, y, CW, "New PIN each visit. Looking at the page needs no PIN. Changing anything, or opening your log or plan, does. One device at a time.", 34) + 14;
    if (NC.why != NetWhy::None) wrapAll(fB(), M, y, CW, netWhyText(NC.why), 34);
  }
  if (page == pages - 1) {
    char cl[40]; snprintf(cl, sizeof cl, "%d connected", NC.clients());
    if (!LG()) C->text(fS(), M, HINT_Y - 10, NC.ssid, &fSym());
    C->textRight(fS(), Canvas::W - M, HINT_Y - 10, cl);
  }
  hintBar("Stop", "", page > 0 ? "◀ page" : "", page + 1 < pages ? "page ▶" : "");
}

static void drawJoining() {
  C->clear();
  header("Wi-Fi", "joining", IC_WIFI);
  int y = 150;
  C->text(fS(), M, y, "JOINING"); y += LG() ? 44 : 40;
  y = wrapAll(fTitle(), M, y, CW, NC.ssid, LG() ? 50 : 42) + 16;
  y = wrapAll(fBody(), M, y, CW, "This can take up to half a minute. The password is only used for this and is not shown or logged.", LG() ? 36 : 30) + 16;
  if (NC.target == -1) wrapAll(fBody(), M, y, CW, "Your phone may drop off the hotspot now. That is expected: let it go back to your usual Wi-Fi, then open the address this screen shows next.", LG() ? 36 : 30);
  hintBar("Cancel", "", "", "");
}

static void drawFailed() {
  C->clear();
  header("Wi-Fi", "not connected", IC_WIFI);
  int y = 150;
  y = wrapAll(fTitle(), M, y, CW, NC.target == -2 ? "Couldn't start" : "Couldn't join", LG() ? 50 : 42) + 6;
  if (NC.ssid[0]) y = wrapAll(fB(), M, y, CW, NC.ssid, LG() ? 40 : 34) + 12;
  y = wrapAll(fBody(), M, y, CW, netWhyText(NC.why), LG() ? 36 : 30) + 16;
  wrapAll(fS(), M, y, CW, "Try again, or go back and pick another network. Nothing was saved from this try.", LG() ? 29 : 24);
  hintBar("Back", "Try again", "", "");
}

static void drawSync() {
  if (WV.busy) { WV.head = "Starting…"; WV.msg = "The Wi-Fi radio is starting. This takes a few seconds."; drawWifiMsg(); return; }
  if (wifiRunning()) {
    const int pages = wifiPages(), page = S.page < pages ? S.page : pages - 1;
    switch (NC.phase) {
      case NetPhase::Hotspot: drawHotspot(page, pages); break;
      case NetPhase::Joining: drawJoining(); break;
      case NetPhase::Wifi: drawLan(page, pages); break;
      default: drawFailed(); break;
    }
    return;
  }
  switch (WV.v) {
    case Wv::Home: drawWifiHome(); break;
    case Wv::Saved: drawWifiSaved(); break;
    case Wv::Forget: drawWifiForget(); break;
    case Wv::Msg: drawWifiMsg(); break;
    case Wv::SyncPre: drawSyncPre(); break;
  }
}

// ---------------------------------------------------------------------------------------------
// CLOCK — set date and time with buttons when there is no phone handy.
// ---------------------------------------------------------------------------------------------
static void drawClock() {
  C->clear();
  const std::string problem = clockProblem();
  header("Clock", problem.empty() ? "running" : "not set", IC_PRN);
  char f[5][16];
  snprintf(f[0], 16, "%04d", S.edit.tm_year + 1900); snprintf(f[1], 16, "%02d", S.edit.tm_mon + 1);
  snprintf(f[2], 16, "%02d", S.edit.tm_mday); snprintf(f[3], 16, "%02d", S.edit.tm_hour); snprintf(f[4], 16, "%02d", S.edit.tm_min);
  const char* L[5] = {"YEAR", "MONTH", "DAY", "HOUR", "MIN"};
  const int xs[5] = {M, M + 150, M + 250, M + 60, M + 200}, ys[5] = {230, 230, 230, 420, 420};
  for (int i = 0; i < 5; i++) {
    C->text(fS(), xs[i], ys[i] - 70, L[i]);
    C->text(fXL(), xs[i], ys[i], f[i]);
    if (i == S.field) C->fill(xs[i], ys[i] + 12, C->width(fXL(), f[i]), 4);
  }
  C->text(fXL(), M + 150, 420, ":");
  const char* tz = "Pacific time; daylight saving is handled for you. The Wi-Fi page can also set this from your phone in one tap.";
  if (LG()) {
    if (!problem.empty()) wrapAll(fBody(), M, 500, CW, problem, 36);
    else wrapAll(fBodyI(), M, 520, CW, tz, 36);
  } else {
    if (!problem.empty()) C->wrap(fBody(), M, 500, CW, problem.c_str(), 4);
    C->wrap(fBodyI(), M, problem.empty() ? 520 : 640, CW, tz, 3);
  }
  hintBar("Cancel", "Save", "◀ field", "field ▶");
}

// ---------------------------------------------------------------------------------------------
// FOCUS — silent work rounds and breaks. Draws a phase once, deep-sleeps until it ends (no sound, no per-minute
// refresh, no notification). The run lives in /kw/focus.txt because RAM does not survive deep sleep. Rounds and
// interruptions go to the month CSV as focus_rounds / focus_interruptions (counts only, see core/focus.h).
// ---------------------------------------------------------------------------------------------
static FocusPlan FP;
static FocusRun FRUN;
static const int PRESETS[3][2] = {{25, 5}, {15, 5}, {45, 10}};
static int presetOf() { for (int i = 0; i < 3; i++) if (FP.work == PRESETS[i][0] && FP.brk == PRESETS[i][1]) return i; return -1; }

// Walks the run forward to the clock (a wake can land late, even after 4 a.m.), logging finished rounds. True if it changed.
static bool focusTick() {
  if (!hal::timeValid() || !(focusActive(FRUN) || FRUN.phase == FPhase::Done)) return false;
  const FPhase ph = FRUN.phase; const int rd = FRUN.round;
  FocusCredits cr; focusAdvance(FP, FRUN, hal::now(), cr);
  if (cr.n) focusLogRounds(cr, hal::now());
  const bool ch = cr.n || ph != FRUN.phase || rd != FRUN.round;
  if (ch) focusSave(FP, FRUN);
  return ch;
}

static void drawFocus(bool sleeping) {
  C->clear();
  const std::string today = baseDay();
  const int rounds = loggedCount(today, KEY_FOCUS_ROUNDS);
  if (FRUN.phase == FPhase::Idle) {
    header("Focus", "silent · no alarms", IC_WORK);
    char v[4][24];
    const int pi = presetOf();
    if (pi >= 0) snprintf(v[0], 24, "%d / %d", PRESETS[pi][0], PRESETS[pi][1]); else strcpy(v[0], "Custom");
    snprintf(v[1], 24, "%d min", FP.work); snprintf(v[2], 24, "%d min", FP.brk); strcpy(v[3], "Start");
    static const char* L[4] = {"PRESET (work / break)", "WORK", "BREAK", ""};
    const int rowH = LG() ? 100 : 92, pitch = LG() ? 108 : 104, top = LG() ? 100 : 112;
    for (int i = 0; i < 4; i++) {
      const int y = top + i * pitch;
      if (i < 3) { C->text(fS(), M + 12, y + (LG() ? 30 : 26), L[i]); C->text(fXL(), M + 12, y + (LG() ? 88 : 74), v[i]); }
      else C->textCenter(fXL(), Canvas::W / 2, y + (LG() ? 68 : 60), v[i]);
      C->rect(M, y, CW, rowH, i == 3 ? 3 : 1);
      if (i == S.sel) C->invert(M, y, CW, rowH);
    }
    char info[160];
    if (LG()) {
      snprintf(info, sizeof info, "%d rounds, then a %d min break. Silent: no sound, no alarm.", FP.rounds, FP.longBrk);
      wrapAll(fS(), M, 568, CW, info, 29);
      if (rounds) { snprintf(info, sizeof info, "%d round%s finished today.", rounds, rounds == 1 ? "" : "s"); C->text(fS(), M, 676, info); }
    } else {
      snprintf(info, sizeof info, "%d rounds, then a %d min break. No sound: the screen is drawn once, the X4 sleeps and wakes itself.", FP.rounds, FP.longBrk);
      C->wrap(fS(), M, 550, CW, info, 3);
      if (rounds) { snprintf(info, sizeof info, "%d round%s finished today.", rounds, rounds == 1 ? "" : "s"); C->text(fS(), M, 640, info); }
    }
    hintBar("Back", S.sel == 3 ? "Start" : "Next", S.sel == 3 ? "" : "◀ less", S.sel == 3 ? "" : "more ▶");
    return;
  }
  if (FRUN.phase == FPhase::Done) {
    header("Focus", "done", IC_WORK);
    char b[48]; snprintf(b, sizeof b, "%d", rounds);
    const int x = C->text(F_HUGE, M, 300, b);
    C->text(fUI(), x + 14, 296, rounds == 1 ? "round finished today" : "rounds finished today");
    if (FRUN.interruptions) { snprintf(b, sizeof b, "%d interruption%s this session", FRUN.interruptions, FRUN.interruptions == 1 ? "" : "s"); C->text(fBody(), M, 380, b); }
    if (LG()) wrapAll(fBodyI(), M, FRUN.interruptions ? 440 : 390, CW, "That was the last round. Nothing else to do here.", 36);
    else C->wrap(fBodyI(), M, FRUN.interruptions ? 430 : 380, CW, "That was the last round. Nothing else to do here.", 2);
    hintBar("Menu", "", "", "");
    return;
  }
  const bool work = FRUN.phase == FPhase::Work;
  const bool lng = focusLong(FP, FRUN);
  const std::string until = clockStr(FRUN.end);
  char sub[32]; snprintf(sub, sizeof sub, "round %d of %d", FRUN.round, FP.rounds);
  header(work ? "Focus" : lng ? "Long break" : "Break", sub, IC_WORK);
  C->textCenter(fXL(), Canvas::W / 2, 300, until.c_str());
  std::string line = std::string(work ? "Focus" : lng ? "Long break" : "Break") + " until " + until;
  if (work) line += std::string(" · ") + sub;
  if (LG()) wrapAll(fBody(), M, 390, CW, line, 36, &fSym()); else C->wrap(fBody(), M, 380, CW, line.c_str(), 3, 0, &fSym());
  char b[64]; int y = LG() ? 500 : 470;
  if (work && FRUN.interruptions) { snprintf(b, sizeof b, "Interrupted %d time%s", FRUN.interruptions, FRUN.interruptions == 1 ? "" : "s"); C->text(fUI(), M, y, b); y += 34; }
  if (rounds) { snprintf(b, sizeof b, "%d round%s finished today", rounds, rounds == 1 ? "" : "s"); C->text(fS(), M, y, b); }
  if (sleeping) {
    C->hline(0, HINT_Y, Canvas::W);
    if (LG()) {
      battery(M, HINT_Y + 34);
      C->textRight(fS(), Canvas::W - M, HINT_Y + 34, ("wakes itself " + until).c_str());
      C->textCenter(fS(), Canvas::W / 2, HINT_Y + 66, "Silent: no sound, no alarm");
    } else {
      battery(M, HINT_Y + 28);
      C->textRight(fS(), Canvas::W - M, HINT_Y + 28, ("Silent · wakes itself " + until).c_str());
    }
  } else {
    hintBar("End", work ? "Interrupted" : "", "", "");
  }
}

// ---------------------------------------------------------------------------------------------
// SETTINGS — text size, contrast, button remap, sleep and refresh timing. Saved to /kw/settings.txt on every change.
// Left/Right or Confirm change the highlighted value (they follow the button remap like everything else).
// ---------------------------------------------------------------------------------------------
static const int SET_N = 6;
static const char* settingLabel(int i) {
  static const char* L[SET_N] = {"TEXT SIZE", "CONTRAST", "BUTTONS", "SLEEP AFTER", "CLEAN THE SCREEN", "HOLD BACK FOR SUPPORT"};
  return L[i];
}
static const char* settingValue(int i) {
  switch (i) {
    case 0: return ST.large ? "Large" : "Normal";
    case 1: return ST.bold ? "Bold" : "Normal";
    case 2: { static const char* V[4] = {"Standard", "Left-handed", "Confirm and Back swapped", "Left-handed + swapped"}; return V[ST.buttons % 4]; }
    case 3: { static const char* V[3] = {"90 seconds", "5 minutes", "15 minutes"}; return V[ST.sleep % 3]; }
    case 4: { static const char* V[3] = {"Every 4 moves", "Every 8 moves", "Every 16 moves"}; return V[ST.clean % 3]; }
    default: { static const char* V[3] = {"1.2 seconds", "2.5 seconds", "Off (use the Menu)"}; return V[ST.hold % 3]; }
  }
}
static const char* settingHelp(int i) {
  switch (i) {
    case 0: return "Bigger type on every screen. Long screens get pages (up/down).";
    case 1: return "Heavier text and lines. Nothing is drawn in a thin stroke.";
    case 2: {
      static const char* V[4] = {"The buttons do what their labels say.", "Left and Right trade places, and so do Up and Down. Labels follow.",
                                 "Confirm and Back trade places. Labels follow.", "Both swaps at once. Labels follow."};
      return V[ST.buttons % 4];
    }
    case 3: return "Time without a press before it sleeps. Support, your plan and the Clock wait at least 15 minutes.";
    case 4: return "Every Nth move is a full clean redraw. A bigger number means fewer flashes and a little more ghosting.";
    default: return "How long to hold Back to open Support from anywhere. Off: use Menu, then Support.";
  }
}
static void drawSettings() {
  C->clear();
  header("Settings", "saved on the card", IC_GEAR);
  const int rh = LG() ? 88 : 90, top = 100;
  for (int i = 0; i < SET_N; i++) {
    const int y = top + i * rh;
    C->text(fS(), M + 8, y + (LG() ? 30 : 26), settingLabel(i));
    C->text(fB(), M + 8, y + (LG() ? 68 : 60), settingValue(i));
    C->hline(M, y + rh - 6, CW);
    if (i == S.sel) C->invert(M - 8, y + 2, CW + 16, rh - 12);
  }
  wrapAll(fS(), M, top + SET_N * rh + 24, CW, settingHelp(S.sel), LG() ? 29 : 24);
  hintBar("Back", "Change", "◀", "▶");
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
    case Scr::Sync: drawSync(); break;
    case Scr::Clock: drawClock(); break;
    case Scr::Focus: drawFocus(sleeping); break;
    case Scr::Settings: drawSettings(); break;
  }
  Refresh r = Refresh::Half;
  if (sleeping) r = Refresh::Full;
  else if (sameScreen) { r = (++S.changes % settingsCleanEvery(ST) == 0) ? Refresh::Half : Refresh::Fast; }
  else S.changes = 0;
  static const char* NAMES[] = {"today", "checkin", "menu", "month", "support", "plan", "sync", "clock", "focus", "settings"};
  hal::show(r, NAMES[(int)S.scr]);
}

// Sleeping: a Focus run in progress sleeps showing its phase and wakes when the phase ends; otherwise Today until 4:31 a.m.
// A finished session (Done) stays on screen only when the timer woke us; touched and idle, it clears back to Today.
[[noreturn]] static void goToSleep(bool redraw = true, bool keepDone = false) {
  NC.stop();  // the radio and its memory are the Wi-Fi screen's: gone before anything sleeps
  if (FRUN.phase == FPhase::Done && !keepDone) { FRUN = FocusRun(); focusSave(FP, FRUN); }
  if (focusActive(FRUN) || FRUN.phase == FPhase::Done) {
    S.scr = Scr::Focus;
    if (redraw) render(false, true);
    hal::sleepUntil(focusActive(FRUN) ? FRUN.end + 5 : nextDayStart(hal::now()));
  }
  S.scr = Scr::Today; S.dayOffset = 0;
  render(false, true);
  hal::sleepUntil(nextDayStart(hal::now()));  // 4:31 a.m., when the new day starts; leaves room for RTC drift
}

// Opens the Clock editor on the current time, or on the day the books were built when the clock is wrong.
static void go(Scr s);
static void openClock() {
  time_t t = clockOk() ? hal::now() : dateNoon(builtStamp(dateStr(hal::now()).substr(0, 7)));
  if (!t) t = 1790000000;
  localtime_r(&t, &S.edit); S.field = 0;
  go(Scr::Clock);
}
static void go(Scr s) { S.prev = S.scr; S.scr = s; S.sel = 0; S.page = 0; S.scroll = 0; render(false); }

// ---- Wi-Fi screen: what the buttons do ----
static void wifiOpen() {  // Menu > Wi-Fi: nothing starts yet; the radio is off until a mode is picked
  NC.stop(); NC.load();
  WV = WifiView(); WV.lastPress = hal::millis(); S.scr = Scr::Sync; S.page = 0;
  render(false);
}
static void wifiBegin(int what, int idx = 0) {  // 0 hotspot, 1 hotspot to join a network, 2 a saved network
  WV.busy = true; render(false);
  if (what == 2) NC.startWifi(idx); else NC.startHotspot(what == 1);
  WV.busy = false; WV.sig = wifiSig(); S.page = 0;
  render(false);
}
static void wifiMsg(const char* head, const char* msg, Wv next) { WV.v = Wv::Msg; WV.head = head; WV.msg = msg; WV.sel = (int)next; render(false); }
static void syncPre() {
  NC.load(); syncLoad(SC); syncPlan(SP);
  WV.fromSync = true;
  if (NC.cfg.n == 0) { wifiMsg("No network saved", syncResText(SyncRes::NoNetwork), Wv::Home); return; }
  if (!SC.ok()) { wifiMsg("Not set up", syncResText(SyncRes::NotSetUp), Wv::Home); return; }
  WV.net = NC.cfg.last >= 0 ? NC.cfg.last : 0;
  WV.v = Wv::SyncPre; render(false);
}
static void syncGo() {   // the ONE call to syncRun: Send on the preview screen
  WV.v = Wv::Msg; WV.head = "Sending…"; WV.msg = "Joining your Wi-Fi and sending your check-ins. Press Back to stop."; WV.busy = true; WV.sel = (int)Wv::Home; render(false);
  const SyncOut o = syncRun(NC.cfg, WV.net);
  WV.busy = false;
  static char m[420];
  if (o.res == SyncRes::Ok) snprintf(m, sizeof m, "%d %s, %s, went to %s.%s", o.files, o.files == 1 ? "month" : "months", kbText(o.bytes).c_str(), SC.host, o.skipped ? " The Studio already holds more of some months; those were left alone." : "");
  else snprintf(m, sizeof m, "%s", syncResText(o.res));
  if (o.res == SyncRes::Cancelled && o.bytes) snprintf(m, sizeof m, "Stopped after %s. What was sent is kept; the rest goes next time.", kbText(o.bytes).c_str());
  WV.fromSync = true;
  wifiMsg(o.res == SyncRes::Ok ? "Sent" : o.res == SyncRes::NothingNew ? "Up to date" : o.res == SyncRes::Cancelled ? "Stopped" : "Not sent", m, Wv::Home);
}

static void wifiTick() {
  NC.tick();
  const int sg = wifiSig();
  if (sg == WV.sig) return;
  const bool screenChanged = sg / 100000 != WV.sig / 100000;
  WV.sig = sg; render(!screenChanged);
}
static void wifiKey(Btn b) {
  if (wifiRunning()) {
    const int pages = wifiPages();
    if (b == Btn::Back) { NC.stop(); loadCheckins(); NC.load(); WV.v = Wv::Home; render(false); return; }   // radio off, memory freed; packs or check-ins uploaded meanwhile load now
    if (NC.phase == NetPhase::Failed && b == Btn::Confirm) { WV.busy = true; render(false); NC.retry(); WV.busy = false; WV.sig = wifiSig(); render(false); return; }
    if ((b == Btn::Down || b == Btn::Right) && S.page + 1 < pages) { S.page++; render(true); }
    else if ((b == Btn::Up || b == Btn::Left) && S.page > 0) { S.page--; render(true); }
    return;
  }
  const NetConfig& c = NC.cfg;
  switch (WV.v) {
    case Wv::Home:
      if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = menuIndex(Scr::Sync); render(false); }
      else if (b == Btn::Up || b == Btn::Left) { WV.sel = (WV.sel + WIFI_HOME_N - 1) % WIFI_HOME_N; render(true); }
      else if (b == Btn::Down || b == Btn::Right) { WV.sel = (WV.sel + 1) % WIFI_HOME_N; render(true); }
      else if (b == Btn::Confirm) {
        if (WV.sel == 0) wifiBegin(0);
        else if (WV.sel == 2) wifiBegin(1);
        else if (WV.sel == 4) syncPre();
        else if (c.n == 0) wifiMsg("Nothing saved yet", "Choose Join a network first. You type the password on your phone, and the X4 remembers the network on its card.", Wv::Home);
        else if (WV.sel == 1 && c.n == 1) wifiBegin(2, 0);
        else { WV.v = Wv::Saved; WV.sel = c.last >= 0 ? c.last : 0; render(false); }
      }
      break;
    case Wv::Saved:
      if (b == Btn::Back) { WV.v = Wv::Home; WV.sel = 1; render(false); }
      else if (b == Btn::Up) { WV.sel = (WV.sel + c.n - 1) % c.n; render(true); }
      else if (b == Btn::Down) { WV.sel = (WV.sel + 1) % c.n; render(true); }
      else if (b == Btn::Confirm) wifiBegin(2, WV.sel);
      else if (b == Btn::Right) { WV.fsel = WV.sel; WV.v = Wv::Forget; render(false); }
      break;
    case Wv::Forget:
      if (b == Btn::Back) { WV.v = Wv::Saved; WV.sel = WV.fsel; render(false); }
      else if (b == Btn::Confirm) {
        static char gone[SSID_MAX + 40];
        snprintf(gone, sizeof gone, "%s and its password were deleted from the card.", c.nets[WV.fsel].ssid);
        netForgetAt(NC.cfg, WV.fsel); netSave(NC.cfg);
        wifiMsg("Forgotten", gone, NC.cfg.n ? Wv::Saved : Wv::Home);
      }
      break;
    case Wv::Msg: {
      if (b == Btn::Back || b == Btn::Confirm) { WV.v = (Wv)WV.sel; WV.sel = WV.v == Wv::Saved ? 0 : WV.fromSync ? 4 : 1; WV.fromSync = false; render(false); }
      break;
    }
    case Wv::SyncPre:
      if (b == Btn::Back) { WV.v = Wv::Home; WV.sel = 4; WV.fromSync = false; render(false); }
      else if (b == Btn::Confirm) syncGo();
      else if (b == Btn::Left && c.n > 1) { WV.net = (WV.net + 1) % c.n; render(true); }
      else if (b == Btn::Right) { if (!syncSaveLog(SC, !SC.log)) wifiMsg("Not saved", "The card wouldn't save that setting.", Wv::SyncPre); else render(true); }
      break;
  }
}

void appMain() {
  hal::begin();
  kwupdate::apply();  // packs copied to /kw-update move into /kw (never /kw/log or an existing /kw/me.txt)
  timeInit();
  FB = hal::framebuffer();
  static Canvas canvas(FB); C = &canvas;
  settingsLoad(ST); applyStyle(); hal::setBackHold(settingsHoldMs(ST));  // before anything is drawn, the sleep screen included
  focusLoad(FP, FRUN);  // a Focus run survives deep sleep on the card
  if (hal::woke_by_timer()) {
    // A phase ended: log it, draw the next one, sleep again. Woken early by clock drift: sleep on without redrawing.
    if (focusActive(FRUN) || FRUN.phase == FPhase::Done) { const bool ch = focusTick(); goToSleep(ch, true); }
    goToSleep();  // day start: redraw today's page and go straight back to sleep
  }
  loadCheckins();  // custom check-ins from the day page layout, if the card has them
  if (focusTick() || focusActive(FRUN) || FRUN.phase == FPhase::Done) S.scr = Scr::Focus;  // power button during a run: show where it is

  render(false);
  for (;;) {
    // Idle sleep never discards work in progress (every check-in press is saved when it happens), and it never
    // cuts short someone reading or setting something slowly: Support, the plan and the Clock wait at least 15 minutes.
    uint32_t idle = settingsIdleMs(ST);
    if ((S.scr == Scr::Support || S.scr == Scr::Plan || S.scr == Scr::Clock || S.scr == Scr::Sync) && idle < 900000u) idle = 900000u;  // typing a password on the phone is slow too
    uint32_t wait = (S.scr == Scr::Sync && wifiRunning()) ? 250 : idle;
    if (S.scr == Scr::Focus && focusActive(FRUN)) { const time_t left = FRUN.end - hal::now(); if (left >= 0 && (uint32_t)left * 1000 + 1000 < wait) wait = (uint32_t)left * 1000 + 1000; }
    Btn b = hal::waitButton(wait);
    if (b == Btn::BackHold && ST.hold == 2) b = Btn::Back;  // "no long press": Support is in the Menu
    b = settingsMap(ST, b);                                  // the button remap (Power and the holds are never remapped)
    if (b != Btn::None) WV.lastPress = hal::millis();
    if (S.scr == Scr::Focus && focusTick()) { render(false); if (b == Btn::None) continue; }
    if (b == Btn::None) {
      if (S.scr == Scr::Sync && wifiRunning()) {
        hal::wifiLoop(); wifiTick();
        // The page being used counts as activity, like a button press; the same sleep-after setting applies (never under 15 minutes here).
        uint32_t act = WV.lastPress; if ((int32_t)(NC.lastReq - act) > 0) act = NC.lastReq;
        if ((uint32_t)(hal::millis() - act) >= idle) goToSleep();
        continue;
      }
      goToSleep();
    }
    if (b == Btn::Power || b == Btn::PowerHold) goToSleep();
    if (b == Btn::BackHold) {
      if (S.scr == Scr::Sync) { NC.stop(); loadCheckins(); }
      if (S.scr != Scr::Support) go(Scr::Support);
      continue;
    }

    switch (S.scr) {
      case Scr::Today:
        if (b == Btn::Confirm) { if (clockOk()) go(Scr::Checkin); else openClock(); }
        else if (b == Btn::Left || b == Btn::Right) { S.dayOffset += (b == Btn::Right) ? 1 : -1; S.page = 0; render(true); }
        else if (b == Btn::Back) { if (S.dayOffset) { S.dayOffset = 0; S.page = 0; render(true); } else go(Scr::Menu); }
        else if ((b == Btn::Up || b == Btn::Down) && LG() && todayPages > 1) {  // large text: more of the day on the next page
          const int np = S.page + (b == Btn::Down ? 1 : -1);
          if (np >= 0 && np < todayPages) { S.page = np; render(true); }
        }
        else if (b == Btn::Up || b == Btn::Down) go(Scr::Menu);
        break;
      case Scr::Checkin:
        if (b == Btn::Back) { S.scr = Scr::Today; render(false); }
        else if (b == Btn::Up) { S.sel = stepSel(S.sel, -1); render(true); }
        else if (b == Btn::Down) { S.sel = stepSel(S.sel, 1); render(true); }
        else { checkinPress(b); render(true); }
        break;
      case Scr::Menu:
        if (b == Btn::Back) { S.scr = Scr::Today; S.dayOffset = 0; render(false); }
        else if (b == Btn::Up || b == Btn::Left) { S.sel = (S.sel + MENU_N - 1) % MENU_N; render(true); }
        else if (b == Btn::Down || b == Btn::Right) { S.sel = (S.sel + 1) % MENU_N; render(true); }
        else if (b == Btn::Confirm) {
          const Scr to = MENU[S.sel].to;
          if (to == Scr::Today) S.dayOffset = 0;
          if (to == Scr::Month) S.monthOffset = atoi(baseDay().c_str() + 8) <= 3 ? -1 : 0;
          if (to == Scr::Sync) { wifiOpen(); break; }
          if (to == Scr::Clock) { openClock(); break; }
          if (to == Scr::Focus && !clockOk()) { openClock(); break; }  // rounds are filed under the day: never guess it
          if (to == Scr::Checkin && !clockOk()) { openClock(); break; }  // never save under a guessed date
          go(to);
        }
        break;
      case Scr::Month:
        if (b == Btn::Back) go(Scr::Menu);
        else if (LG() && (b == Btn::Up || b == Btn::Down)) {  // large text: Up/Down turn pages, Left/Right change month
          const int np = S.page + (b == Btn::Down ? 1 : -1);
          if (np >= 0 && np < monthPages) { S.page = np; render(true); }
        }
        else if (b == Btn::Left || b == Btn::Up) { S.monthOffset--; render(true); }
        else if (b == Btn::Right || b == Btn::Down) { if (S.monthOffset < 0) S.monthOffset++; render(true); }
        break;
      case Scr::Support:
        if (b == Btn::Back) { S.scr = S.prev == Scr::Support ? Scr::Today : S.prev; S.sel = 0; render(false); }
        else if (b == Btn::Confirm) { S.prev = Scr::Support; S.scr = Scr::Plan; S.page = 0; render(false); }
        else if ((b == Btn::Right || b == Btn::Down) && S.page + 1 < supportPages) { S.page++; render(true); }
        else if ((b == Btn::Left || b == Btn::Up) && S.page > 0) { S.page--; render(true); }
        break;
      case Scr::Plan:
        if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = menuIndex(Scr::Plan); render(false); }
        else if (b == Btn::Confirm) { S.prev = Scr::Plan; S.scr = Scr::Support; S.page = 0; render(false); }
        else if ((b == Btn::Right || b == Btn::Down) && S.page + 1 < planPages) { S.page++; render(true); }
        else if ((b == Btn::Left || b == Btn::Up) && S.page > 0) { S.page--; render(true); }
        break;
      case Scr::Sync:
        wifiKey(b);
        break;
      case Scr::Focus:
        if (FRUN.phase == FPhase::Idle) {
          if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = menuIndex(Scr::Focus); render(false); }
          else if (b == Btn::Up) { S.sel = (S.sel + 3) % 4; render(true); }
          else if (b == Btn::Down) { S.sel = (S.sel + 1) % 4; render(true); }
          else if (b == Btn::Confirm && S.sel == 3) { focusStart(FP, hal::now(), FRUN); focusSave(FP, FRUN); goToSleep(); }
          else if (b == Btn::Confirm) { S.sel++; render(true); }
          else if ((b == Btn::Left || b == Btn::Right) && S.sel < 3) {
            const int d = b == Btn::Right ? 1 : -1;
            if (S.sel == 0) { const int p = presetOf(); const int n = p < 0 ? (d > 0 ? 0 : 2) : (p + d + 3) % 3; FP.work = PRESETS[n][0]; FP.brk = PRESETS[n][1]; }
            else if (S.sel == 1) { FP.work += 5 * d; if (FP.work < FOCUS_WORK_MIN) FP.work = FOCUS_WORK_MIN; if (FP.work > FOCUS_WORK_MAX) FP.work = FOCUS_WORK_MAX; }
            else { FP.brk += d; if (FP.brk < FOCUS_BREAK_MIN) FP.brk = FOCUS_BREAK_MIN; if (FP.brk > FOCUS_BREAK_MAX) FP.brk = FOCUS_BREAK_MAX; }
            focusSave(FP, FRUN);
            render(true);
          }
        } else if (b == Btn::Back || (FRUN.phase == FPhase::Done && b == Btn::Confirm)) {  // End: rounds already finished stay in the log
          FRUN = FocusRun(); focusSave(FP, FRUN); S.scr = Scr::Menu; S.sel = menuIndex(Scr::Focus); render(false);
        } else if (b == Btn::Confirm && FRUN.phase == FPhase::Work) {
          FRUN.interruptions++; focusLogInterruption(hal::now()); focusSave(FP, FRUN); render(true);
        }
        break;
      case Scr::Settings:
        if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = menuIndex(Scr::Settings); render(false); }
        else if (b == Btn::Up) { S.sel = (S.sel + SET_N - 1) % SET_N; render(true); }
        else if (b == Btn::Down) { S.sel = (S.sel + 1) % SET_N; render(true); }
        else {  // Left = previous value, Right / Confirm = next
          const int d = b == Btn::Left ? -1 : 1;
          switch (S.sel) {
            case 0: ST.large = !ST.large; break;
            case 1: ST.bold = !ST.bold; break;
            case 2: ST.buttons = (ST.buttons + 4 + d) % 4; break;
            case 3: ST.sleep = (ST.sleep + 3 + d) % 3; break;
            case 4: ST.clean = (ST.clean + 3 + d) % 3; break;
            default: ST.hold = (ST.hold + 3 + d) % 3; break;
          }
          settingsSave(ST); applyStyle(); hal::setBackHold(settingsHoldMs(ST));
          render(S.sel >= 2);  // text size and contrast redraw everything: a half refresh, not a partial one
        }
        break;
      case Scr::Clock:
        if (b == Btn::Back) { S.scr = Scr::Menu; S.sel = menuIndex(Scr::Clock); render(false); }
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
