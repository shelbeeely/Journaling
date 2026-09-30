// Settings persistence and the button remap (core/settings.cpp) against the host card.
#include "../src/core/settings.h"
#include <cstdio>
#include <cstdlib>
void appMain() {}
static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL %s:%d %s\n", __FILE__, __LINE__, #c); fails++; } } while (0)
int main() {
  hal::begin();
  Settings a; CHECK(a == Settings()); CHECK(!a.large && !a.bold && a.buttons == 0);
  CHECK(settingsIdleMs(a) == 90000); CHECK(settingsCleanEvery(a) == 8); CHECK(settingsHoldMs(a) == 1200);
  // save, then load from the card
  a.large = true; a.bold = true; a.buttons = 3; a.sleep = 2; a.clean = 2; a.hold = 2;
  CHECK(settingsSave(a));
  Settings b; settingsLoad(b); CHECK(b == a);
  CHECK(settingsIdleMs(b) == 900000); CHECK(settingsCleanEvery(b) == 16); CHECK(settingsHoldMs(b) == 0);
  // bad values, unknown keys, CRLF and comments fall back to defaults without breaking the rest
  Settings c; settingsParse("# hi\r\ntext=huge\r\ncontrast=bold\r\nbuttons=sideways\r\nsleep=7\nclean=99\nhold=abc\nfuture=1\nnonsense\n", c);
  CHECK(!c.large); CHECK(c.bold); CHECK(c.buttons == 0); CHECK(c.sleep == 0); CHECK(c.clean == 1); CHECK(c.hold == 0);
  Settings d; settingsParse("", d); CHECK(d == Settings());
  Settings e; settingsParse(settingsText(a), e); CHECK(e == a);
  // a missing file is the default
  remove((std::string(getenv("KW_SD")) + SETTINGS_PATH).c_str());
  Settings f; f.large = true; settingsLoad(f); CHECK(f == Settings());
  // remap tables
  Settings m;
  CHECK(settingsMap(m, Btn::Left) == Btn::Left && settingsMap(m, Btn::Back) == Btn::Back);
  m.buttons = 1; CHECK(settingsMap(m, Btn::Left) == Btn::Right); CHECK(settingsMap(m, Btn::Right) == Btn::Left);
  CHECK(settingsMap(m, Btn::Up) == Btn::Down); CHECK(settingsMap(m, Btn::Down) == Btn::Up); CHECK(settingsMap(m, Btn::Back) == Btn::Back);
  m.buttons = 2; CHECK(settingsMap(m, Btn::Back) == Btn::Confirm); CHECK(settingsMap(m, Btn::Confirm) == Btn::Back); CHECK(settingsMap(m, Btn::Left) == Btn::Left);
  m.buttons = 3; CHECK(settingsMap(m, Btn::Back) == Btn::Confirm); CHECK(settingsMap(m, Btn::Right) == Btn::Left);
  for (int k = 0; k < 4; k++) {
    m.buttons = k; CHECK(settingsMap(m, Btn::Power) == Btn::Power); CHECK(settingsMap(m, Btn::BackHold) == Btn::BackHold);
    for (Btn x : {Btn::Back, Btn::Confirm, Btn::Left, Btn::Right, Btn::Up, Btn::Down}) CHECK(settingsMap(m, settingsMap(m, x)) == x);  // every remap is its own inverse
  }
  m.buttons = 2; CHECK(settingsSlotOf(m, Btn::Confirm) == 0); CHECK(settingsSlotOf(m, Btn::Back) == 1);
  printf(fails ? "settings test: %d FAILED\n" : "settings test: ok\n", fails);
  return fails ? 1 : 0;
}
