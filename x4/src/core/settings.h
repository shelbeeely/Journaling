#pragma once
// Display, button and timing settings, kept on the card in /kw/settings.txt (plain key=value lines) so they
// survive deep sleep and a flat battery. Nothing here leaves the device. Unknown keys and values fall back to the default.
#include <string>
#include "../hal/hal.h"

struct Settings {
  bool large = false;    // text=large: bigger type on every screen, pages instead of cut lines
  bool bold = false;     // contrast=bold: heavier strokes, no hairlines
  uint8_t buttons = 0;   // buttons=standard|left|swap|both  (left: Left/Right and Up/Down trade places; swap: Confirm and Back trade places)
  uint8_t sleep = 0;     // sleep=90|300|900 seconds without a press before it sleeps
  uint8_t clean = 1;     // clean=4|8|16: every Nth same-screen move is a cleaning refresh (more = fewer flashes)
  uint8_t hold = 0;      // hold=1200|2500|0 ms to hold Back for Support (0 = no long press: Support is in the Menu)
  bool operator==(const Settings& o) const {
    return large == o.large && bold == o.bold && buttons == o.buttons && sleep == o.sleep && clean == o.clean && hold == o.hold;
  }
};

static const char* const SETTINGS_PATH = "/kw/settings.txt";
static const int SLEEP_SECS[3] = {90, 300, 900};
static const int CLEAN_EVERY[3] = {4, 8, 16};
static const int HOLD_MS[3] = {1200, 2500, 0};

std::string settingsText(const Settings& s);                // the file contents
void settingsParse(const std::string& text, Settings& s);   // tolerant: bad lines are ignored, values snap to a known choice
void settingsLoad(Settings& s);
bool settingsSave(const Settings& s);
inline uint32_t settingsIdleMs(const Settings& s) { return (uint32_t)SLEEP_SECS[s.sleep % 3] * 1000u; }
inline int settingsCleanEvery(const Settings& s) { return CLEAN_EVERY[s.clean % 3]; }
inline uint32_t settingsHoldMs(const Settings& s) { return (uint32_t)HOLD_MS[s.hold % 3]; }
// Which logical button a physical press means. Power and the hold buttons are never remapped.
Btn settingsMap(const Settings& s, Btn physical);
// The reverse, for the hint bar: the physical slot (0 Back, 1 Confirm, 2 Left, 3 Right) that now triggers logical button `b`.
int settingsSlotOf(const Settings& s, Btn logical);
