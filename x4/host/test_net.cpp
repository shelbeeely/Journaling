// Wi-Fi modes against a simulated network (host/hal_host.cpp): the saved-network file, the PIN and one-client rules, joining, the phone's
// page API, and what the radio is asked to do. Every API answer is printed as "resp: ..." so test_net.sh can prove no password or
// PIN ever appears in one, and every radio call prints "net: ..." so it can prove nothing but the allowed calls happen.
#include "../src/core/net.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
namespace hal { bool hostRadioOn(); void hostAdvance(uint32_t ms); }
void appMain() {}
static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL %s:%d %s\n", __FILE__, __LINE__, #c); fails++; } } while (0)
static const uint32_t PHONE = 0x0a000002u, LAPTOP = 0xc0a80107u, OTHER = 0xc0a80108u;

static const NetResp& show(const NetResp& r) { printf("resp: %d %s\n", r.code, r.body); return r; }
static std::string cookieToken(const NetResp& r) {  // "kw=<token>; Path=/; ..." -> token
  if (!r.cookie) return "";
  std::string c = r.cookie; const size_t e = c.find(';');
  return c.substr(3, e == std::string::npos ? std::string::npos : e - 3);
}
static void ticks(int n) { for (int i = 0; i < n; i++) NC.tick(); }
static std::string pinNow() { return NC.guard.pin; }
static int homeIdx() { NetConfig r; netLoad(r); return netFind(r, "HomeNet"); }

int main() {
  hal::begin();
  const std::string sd = getenv("KW_SD");
  auto fileText = [&](const char* p) { std::string s; hal::readFile(p, s); return s; };

  // ---- names ----
  CHECK(netNameValid("keeping-watch")); CHECK(netNameValid("x")); CHECK(netNameValid("A1-b2"));
  CHECK(!netNameValid("")); CHECK(!netNameValid("-lead")); CHECK(!netNameValid("trail-")); CHECK(!netNameValid("has space")); CHECK(!netNameValid("dot.name"));
  CHECK(!netNameValid("ünï")); CHECK(!netNameValid("abcdefghijklmnopqrstuvwxyz"));   // 26 > 24
  char c[32]; netNameClean("  My X4!! ", c, sizeof c); CHECK(!strcmp(c, "myx4"));
  netNameClean("--Shelf-1--", c, sizeof c); CHECK(!strcmp(c, "shelf-1")); netNameClean("!!!", c, sizeof c); CHECK(!c[0]);
  CHECK(netTextOk("Café Wi-Fi", 32, false)); CHECK(!netTextOk("a\tb", 32, false)); CHECK(!netTextOk("a\nb", 32, false)); CHECK(!netTextOk("", 32, false)); CHECK(netTextOk("", 63, true));
  CHECK(!netTextOk("0123456789012345678901234567890123", 32, false));

  // ---- the saved-network file ----
  NetConfig a; CHECK(a.n == 0 && !strcmp(a.name, "keeping-watch"));
  CHECK(netAdd(a, "Home Wi-Fi", "hunter22")); CHECK(netAdd(a, "Café", "p@ss word \"q\" \\ é")); CHECK(netAdd(a, "Open Cafe", ""));
  a.last = 1; strcpy(a.name, "shelf-x4");
  const std::string t = netText(a);
  CHECK(t.find("PLAIN TEXT") != std::string::npos && t.find("never uploaded") != std::string::npos);   // the file says what it holds
  NetConfig b; netParse(t, b);
  CHECK(b.n == 3 && b.last == 1 && !strcmp(b.name, "shelf-x4") && !strcmp(b.nets[1].pass, "p@ss word \"q\" \\ é") && !b.nets[2].pass[0]);
  CHECK(netSave(a)); NetConfig d; netLoad(d); CHECK(d.n == 3 && !strcmp(d.nets[0].ssid, "Home Wi-Fi"));
  CHECK(!hal::exists("/kw/net.tmp"));                                                              // the temporary file is gone after a save
  CHECK(netAdd(a, "Home Wi-Fi", "newpass99") && a.n == 3 && !strcmp(a.nets[0].pass, "newpass99")); // same name: replaced, not duplicated
  for (int i = a.n; i < NET_MAX; i++) { char s[16]; snprintf(s, sizeof s, "net%d", i); CHECK(netAdd(a, s, "password1")); }
  CHECK(a.n == NET_MAX); CHECK(!netAdd(a, "ninth", "password1"));                                    // full
  netForgetAt(a, 0); CHECK(a.n == NET_MAX - 1 && netFind(a, "Home Wi-Fi") < 0 && a.last == 0);       // last follows the list
  netForgetAt(a, 0); CHECK(a.last == -1);
  NetConfig e; netParse("junk\r\nname=bad name!\r\nlast=9\r\nnet=NoTab\r\nnet=Ok\tpassword1\r\nnet=\tx\nfuture=1\n", e);
  CHECK(!strcmp(e.name, "keeping-watch") && e.n == 2 && !strcmp(e.nets[0].ssid, "NoTab") && !e.nets[0].pass[0] && !strcmp(e.nets[1].ssid, "Ok") && e.last == -1);
  // a crash between the temporary write and the rename must not lose the networks
  hal::removeFile(NET_PATH); hal::writeFile("/kw/net.tmp", netText(d)); NetConfig f; netLoad(f); CHECK(f.n == 3);
  hal::removeFile("/kw/net.tmp"); NetConfig none; netLoad(none); CHECK(none.n == 0);                 // no file: an empty list
  netSave(d);

  // ---- the PIN and the one-client rule ----
  NetGuard g; g.begin(483921u);
  CHECK(!strcmp(g.pin, "483921")); g.begin(7u); CHECK(!strcmp(g.pin, "000007")); g.begin(1234567u); CHECK(strlen(g.pin) == 6);
  { NetGuard h1, h2; h1.begin(111111u); h2.begin(222222u); CHECK(strcmp(h1.pin, h2.pin) != 0); }    // new for each session
  g.begin(483921u); uint32_t t0 = 1000;
  CHECK(g.check(Route::Info, true, LAPTOP, nullptr, t0) == Verdict::Ok);                              // read-only info: no PIN
  CHECK(g.check(Route::Read, true, LAPTOP, nullptr, t0) == Verdict::NeedPin);                        // private data: PIN
  CHECK(g.check(Route::Write, true, LAPTOP, nullptr, t0) == Verdict::NeedPin);                       // any write: PIN
  CHECK(g.check(Route::Write, false, LAPTOP, nullptr, t0) == Verdict::Ok);                           // hotspot: no PIN (its own password)
  CHECK(g.unlock(LAPTOP, "", t0, 1, 2) == Verdict::NeedPin && g.unlock(LAPTOP, "000000", t0, 1, 2) == Verdict::NeedPin);
  CHECK(g.fails == 2 && g.triesLeft() == 3);
  CHECK(g.unlock(LAPTOP, "483 921", t0, 0xabcd1234u, 0x5678u) == Verdict::Ok);                       // a space in the middle is fine
  const std::string tok = g.token; CHECK(tok.size() == 16 && g.owner == LAPTOP);
  CHECK(g.check(Route::Write, true, LAPTOP, tok.c_str(), t0 + 5000) == Verdict::Ok);
  CHECK(g.check(Route::Write, true, LAPTOP, "0000000000000000", t0 + 5000) == Verdict::NeedPin);      // a wrong token is no token
  CHECK(g.check(Route::Write, true, OTHER, tok.c_str(), t0 + 5000) == Verdict::Busy);               // one client at a time: someone else's token, from another device
  CHECK(g.check(Route::Read, true, OTHER, nullptr, t0 + 5000) == Verdict::Busy);
  CHECK(g.unlock(OTHER, "483921", t0 + 5000, 9, 9) == Verdict::Busy);                                 // and they cannot take the place, even with the right PIN
  CHECK(g.check(Route::Info, true, OTHER, nullptr, t0 + 5000) == Verdict::Ok);                       // but the read-only page still loads
  CHECK(g.check(Route::Write, true, LAPTOP, tok.c_str(), t0 + 5000 + LEASE_MS - 1) == Verdict::Ok);  // every request renews the place
  const uint32_t quiet = t0 + 5000 + LEASE_MS - 1 + LEASE_MS + 1;
  CHECK(g.check(Route::Write, true, LAPTOP, tok.c_str(), quiet) == Verdict::NeedPin);                // quiet for two minutes: the place is given up
  CHECK(g.unlock(OTHER, "483921", quiet, 3, 4) == Verdict::Ok && g.owner == OTHER);                  // now someone else may take it
  CHECK(g.check(Route::Write, true, LAPTOP, tok.c_str(), quiet + 1) != Verdict::Ok);                 // the old token is dead
  for (int i = 0; i < PIN_TRIES - 1; i++) { NetGuard h; h.begin(111111u); CHECK(h.unlock(LAPTOP, "999999", 5, 1, 2) == Verdict::NeedPin); }
  { NetGuard h; h.begin(111111u); Verdict v = Verdict::Ok; for (int i = 0; i < PIN_TRIES; i++) v = h.unlock(LAPTOP, "999999", 5, 1, 2);
    CHECK(v == Verdict::Locked && h.locked);                                                           // too many wrong PINs
    CHECK(h.unlock(LAPTOP, "111111", 6, 1, 2) == Verdict::Locked);                                    // even the right one is refused now
    CHECK(h.check(Route::Write, true, LAPTOP, nullptr, 6) == Verdict::Locked && h.check(Route::Info, true, LAPTOP, nullptr, 6) == Verdict::Ok);
    h.begin(222222u); CHECK(!h.locked && h.unlock(LAPTOP, "222222", 7, 1, 2) == Verdict::Ok); }       // leaving the screen and coming back starts fresh
  { NetGuard h; CHECK(h.unlock(LAPTOP, "", 5, 1, 2) == Verdict::Locked); }                            // never begun: nothing opens

  // ---- joining from the phone on the hotspot ----
  NC.load(); CHECK(NC.cfg.n == 3);
  CHECK(!hal::hostRadioOn());
  CHECK(NC.startHotspot(true) && NC.phase == NetPhase::Hotspot && NC.apUp && NC.joinPage && hal::hostRadioOn());
  CHECK(!strncmp(NC.apSsid, "KeepingWatch-", 13) && strlen(NC.apPass) == 8);
  { NetResp r = show(NC.info(false, PHONE, nullptr)); CHECK(r.code == 200 && strstr(r.body, "\"phase\":\"hotspot\"") && strstr(r.body, "\"needPin\":false") && strstr(r.body, "\"unlocked\":true")); }
  { NetResp r = show(NC.scan(false, PHONE, nullptr)); CHECK(r.code == 200 && strstr(r.body, "\"CoffeeShop\"") && strstr(r.body, "\"HomeNet\"") && strstr(r.body, "\"saved\":[{")); }
  { NetResp r = show(NC.join(false, PHONE, nullptr, "HomeNet", "short")); CHECK(r.code == 400); }   // 5 characters is not a WPA password
  { NetResp r = show(NC.join(false, PHONE, nullptr, "Bad\tName", "password1")); CHECK(r.code == 400); }
  CHECK(NC.phase == NetPhase::Hotspot);
  // a wrong password: the hotspot stays, the reason is given, nothing is saved
  const std::string before = fileText(NET_PATH);
  { NetResp r = show(NC.join(false, PHONE, nullptr, "HomeNet", "wrongpass1")); CHECK(r.code == 202); }
  CHECK(NC.phase == NetPhase::Joining && NC.fromPhone); ticks(4);
  CHECK(NC.phase == NetPhase::Hotspot && NC.why == NetWhy::BadPassword && NC.apUp && hal::hostRadioOn());
  CHECK(fileText(NET_PATH) == before && fileText(NET_PATH).find("wrongpass1") == std::string::npos);
  { NetResp r = show(NC.info(false, PHONE, nullptr)); CHECK(strstr(r.body, "\"phase\":\"hotspot\"") && strstr(r.body, "password is probably wrong")); }
  // a network that is not there
  NC.join(false, PHONE, nullptr, "Nowhere", "password1"); ticks(4); CHECK(NC.phase == NetPhase::Hotspot && NC.why == NetWhy::NotFound);
  // the right password
  { NetResp r = show(NC.join(false, PHONE, nullptr, "HomeNet", "hunter22")); CHECK(r.code == 202); }
  { NetResp r = show(NC.join(false, PHONE, nullptr, "HomeNet", "hunter22")); CHECK(r.code == 409); }   // one join at a time
  ticks(4);
  CHECK(NC.phase == NetPhase::Wifi && !strcmp(NC.ip, "192.168.1.42") && NC.why == NetWhy::None);
  CHECK(fileText(NET_PATH).find("net=HomeNet\thunter22") != std::string::npos);                       // saved to the card, as the file says
  { NetConfig r; netLoad(r); CHECK(r.n == 4 && r.last == 3); }
  CHECK(NC.apUp && strlen(NC.guard.pin) == 6);                                                        // the hotspot lingers a few seconds for the phone's page
  { NetResp r = show(NC.info(false, PHONE, nullptr)); CHECK(strstr(r.body, "\"phase\":\"wifi\"") && strstr(r.body, "\"ip\":\"192.168.1.42\"")); }
  hal::hostAdvance(9000); NC.tick(); CHECK(!NC.apUp && NC.lan());
  NC.stop(); CHECK(!hal::hostRadioOn() && NC.phase == NetPhase::Off && !NC.ssid[0] && !NC.ip[0] && !NC.guard.pin[0]);

  // ---- a saved network, on the user's Wi-Fi ----
  CHECK(NC.startWifi(homeIdx()) && NC.phase == NetPhase::Joining && !NC.apUp && !NC.fromPhone); ticks(4);
  CHECK(NC.phase == NetPhase::Wifi && !NC.apUp && NC.lan() && !strcmp(NC.ip, "192.168.1.42"));
  const std::string pin = pinNow(); CHECK(pin.size() == 6);
  // read-only info: no PIN
  { NetResp r = show(NC.info(true, LAPTOP, nullptr)); CHECK(r.code == 200 && strstr(r.body, "\"lan\":true") && strstr(r.body, "\"needPin\":true") && strstr(r.body, "\"unlocked\":false"));
    CHECK(!strstr(r.body, pin.c_str())); }                                                            // the PIN is never in an answer
  // anything private or changing: PIN
  CHECK(show(NC.scan(true, LAPTOP, nullptr)).code == 401);
  CHECK(show(NC.forget(true, LAPTOP, nullptr, "HomeNet")).code == 401);
  CHECK(show(NC.rename(true, LAPTOP, nullptr, "sneaky")).code == 401);
  CHECK(NC.gate(Route::Read, true, LAPTOP, nullptr) == Verdict::NeedPin && NC.gate(Route::Write, true, LAPTOP, nullptr) == Verdict::NeedPin);
  CHECK(NC.gate(Route::Info, true, LAPTOP, nullptr) == Verdict::Ok);
  { NetResp r = show(NC.unlock(true, LAPTOP, "000000")); CHECK(r.code == 403 && strstr(r.body, "4 tries left")); }
  NetResp ok = show(NC.unlock(true, LAPTOP, pin.c_str()));
  CHECK(ok.code == 200 && ok.cookie && strstr(ok.cookie, "SameSite=Strict") && strstr(ok.cookie, "HttpOnly")); CHECK(!strstr(ok.body, pin.c_str()));
  const std::string token = cookieToken(ok);
  CHECK(show(NC.info(true, LAPTOP, token.c_str())).code == 200);
  { NetResp r = show(NC.info(true, LAPTOP, token.c_str())); CHECK(strstr(r.body, "\"unlocked\":true")); }
  CHECK(show(NC.scan(true, LAPTOP, token.c_str())).code == 200);
  CHECK(show(NC.scan(true, OTHER, token.c_str())).code == 423);                                       // a second device: told the X4 is in use
  CHECK(show(NC.unlock(true, OTHER, pin.c_str())).code == 423);
  { NetResp r = show(NC.join(true, LAPTOP, token.c_str(), "Neighbor", "secretpw1")); CHECK(r.code == 409); CHECK(NC.phase == NetPhase::Wifi); }   // joining another network is a hotspot job
  { NetResp r = show(NC.rename(true, LAPTOP, token.c_str(), "Bad Name!")); CHECK(r.code == 200 && strstr(r.body, "badname")); }   // cleaned: letters and digits kept
  CHECK(show(NC.rename(true, LAPTOP, token.c_str(), "!!!")).code == 400);
  CHECK(show(NC.rename(true, LAPTOP, token.c_str(), "shelf-x4")).code == 200);
  { NetConfig r; netLoad(r); CHECK(!strcmp(r.name, "shelf-x4")); }
  CHECK(show(NC.forget(true, LAPTOP, token.c_str(), "Neighbor")).code == 404);
  CHECK(show(NC.forget(true, LAPTOP, token.c_str(), "Open Cafe")).code == 200);
  { NetConfig r; netLoad(r); CHECK(netFind(r, "Open Cafe") < 0 && r.n == 3); CHECK(fileText(NET_PATH).find("Open Cafe") == std::string::npos); }
  // five wrong PINs from someone else on the network lock everything until the screen is opened again
  hal::hostAdvance(LEASE_MS + 1000);
  for (int i = 0; i < PIN_TRIES; i++) NC.unlock(true, OTHER, "999999");
  CHECK(NC.guard.locked && show(NC.unlock(true, LAPTOP, pin.c_str())).code == 429 && show(NC.scan(true, LAPTOP, token.c_str())).code == 429);
  CHECK(show(NC.info(true, LAPTOP, nullptr)).code == 200);                                            // the info page still answers
  NC.stop();
  { std::string seen[6]; int distinct = 0;                                                            // a new PIN each session (two draws can collide once in a million, so: at least 5 of 6 differ)
    for (int i = 0; i < 6; i++) { NC.startWifi(homeIdx()); ticks(4); seen[i] = pinNow(); if (i == 0) CHECK(show(NC.scan(true, LAPTOP, token.c_str())).code == 401);   // and the old cookie means nothing
      NC.stop(); bool dup = false; for (int j = 0; j < i; j++) if (seen[j] == seen[i]) dup = true; if (!dup) distinct++; }
    CHECK(distinct >= 5); }

  // ---- things that go wrong ----
  setenv("KW_WIFI_HANG", "1", 1);
  NC.startWifi(homeIdx()); ticks(3); CHECK(NC.phase == NetPhase::Joining);
  hal::hostAdvance(JOIN_MS + 1000); NC.tick(); CHECK(NC.phase == NetPhase::Failed && NC.why == NetWhy::Timeout && !hal::hostRadioOn());   // gave up, radio off
  NC.retry(); CHECK(NC.phase == NetPhase::Joining); NC.stop();
  unsetenv("KW_WIFI_HANG");
  { NetConfig r; netLoad(r); NC.startWifi(netFind(r, "Café")); } ticks(4); CHECK(NC.phase == NetPhase::Failed && NC.why == NetWhy::NotFound && !hal::hostRadioOn());      // "Café" is not in the simulated air
  CHECK(!NC.startWifi(9) && NC.phase == NetPhase::Failed && NC.why == NetWhy::Bad);
  NC.stop();
  setenv("KW_WIFI_DROP", "1", 1);
  NC.startWifi(homeIdx()); ticks(2); CHECK(NC.phase == NetPhase::Wifi); NC.tick(); CHECK(NC.phase == NetPhase::Failed && NC.why == NetWhy::Lost && !hal::hostRadioOn());   // the network went away: shown, not retried in the background
  unsetenv("KW_WIFI_DROP"); NC.stop();
  // the card cannot save: the join still works and says the network will not be remembered
  hal::makeDir("/kw/net.tmp");                                                                        // a folder where the temporary file goes: every save fails
  NC.startHotspot(true); NC.join(false, PHONE, nullptr, "Neighbor", "secretpw1"); ticks(4);
  CHECK(NC.phase == NetPhase::Wifi && NC.why == NetWhy::NoCard && netFind(NC.cfg, "Neighbor") < 0);
  { NetConfig r; netLoad(r); CHECK(netFind(r, "Neighbor") < 0); }
  NC.stop(); hal::removeEmptyDir("/kw/net.tmp");
  // eight networks are saved: the ninth connects but is not remembered, and the screen says why
  { NetConfig r; netLoad(r); for (int i = r.n; i < NET_MAX; i++) { char s[16]; snprintf(s, sizeof s, "extra%d", i); netAdd(r, s, "password1"); } netSave(r); }
  NC.startHotspot(true); NC.join(false, PHONE, nullptr, "Neighbor", "secretpw1"); ticks(4);
  CHECK(NC.phase == NetPhase::Wifi && NC.why == NetWhy::Full); { NetConfig r; netLoad(r); CHECK(r.n == NET_MAX && netFind(r, "Neighbor") < 0); }
  NC.stop();

  printf(fails ? "net test: %d FAILED\n" : "net test: ok\n", fails);
  return fails ? 1 : 0;
}
