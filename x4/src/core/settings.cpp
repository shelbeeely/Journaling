#include "settings.h"
#include <stdlib.h>
#include <string.h>

static const char* const BUTTON_NAMES[4] = {"standard", "left", "swap", "both"};

std::string settingsText(const Settings& s) {
  std::string t = "# Keeping Watch display, button and timing settings (Menu, Settings). Safe to delete.\n";
  t += std::string("text=") + (s.large ? "large" : "normal") + "\n";
  t += std::string("contrast=") + (s.bold ? "bold" : "normal") + "\n";
  t += std::string("buttons=") + BUTTON_NAMES[s.buttons % 4] + "\n";
  t += "sleep=" + std::to_string(SLEEP_SECS[s.sleep % 3]) + "\n";
  t += "clean=" + std::to_string(CLEAN_EVERY[s.clean % 3]) + "\n";
  t += "hold=" + std::to_string(HOLD_MS[s.hold % 3]) + "\n";
  return t;
}

static uint8_t pick(const int* table, int n, const std::string& text, uint8_t def) {
  if (text.empty() || text[0] < '0' || text[0] > '9') return def;  // "abc" is not 0
  const int v = atoi(text.c_str());
  for (int i = 0; i < n; i++) if (table[i] == v) return (uint8_t)i;
  return def;
}

void settingsParse(const std::string& text, Settings& s) {
  s = Settings();
  size_t a = 0;
  while (a < text.size()) {
    size_t b = text.find('\n', a); if (b == std::string::npos) b = text.size();
    std::string line = text.substr(a, b - a); a = b + 1;
    if (!line.empty() && line.back() == '\r') line.pop_back();
    const size_t eq = line.find('=');
    if (line.empty() || line[0] == '#' || eq == std::string::npos) continue;
    const std::string k = line.substr(0, eq), v = line.substr(eq + 1);
    if (k == "text") s.large = v == "large";
    else if (k == "contrast") s.bold = v == "bold";
    else if (k == "buttons") { for (int i = 0; i < 4; i++) if (v == BUTTON_NAMES[i]) s.buttons = (uint8_t)i; }
    else if (k == "sleep") s.sleep = pick(SLEEP_SECS, 3, v, 0);
    else if (k == "clean") s.clean = pick(CLEAN_EVERY, 3, v, 1);
    else if (k == "hold") s.hold = pick(HOLD_MS, 3, v, 0);
  }
}

void settingsLoad(Settings& s) {
  std::string t;
  s = Settings();
  if (hal::readFile(SETTINGS_PATH, t)) settingsParse(t, s);
}
bool settingsSave(const Settings& s) { return hal::writeFile(SETTINGS_PATH, settingsText(s)); }

Btn settingsMap(const Settings& s, Btn b) {
  if (s.buttons == 1 || s.buttons == 3) {
    if (b == Btn::Left) b = Btn::Right; else if (b == Btn::Right) b = Btn::Left;
    else if (b == Btn::Up) b = Btn::Down; else if (b == Btn::Down) b = Btn::Up;
  }
  if (s.buttons == 2 || s.buttons == 3) {
    if (b == Btn::Back) b = Btn::Confirm; else if (b == Btn::Confirm) b = Btn::Back;
  }
  return b;
}

int settingsSlotOf(const Settings& s, Btn logical) {
  static const Btn SLOT[4] = {Btn::Back, Btn::Confirm, Btn::Left, Btn::Right};
  for (int i = 0; i < 4; i++) if (settingsMap(s, SLOT[i]) == logical) return i;
  return 0;
}
