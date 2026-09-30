// Host (PC) implementation of the HAL: the SD card is a folder, the panel writes PBM frames, and
// buttons come from a script, so every screen can be previewed exactly as the X4 would draw it.
//   KW_SD=host/sd  KW_OUT=host/out  KW_NOW="2026-10-14 08:30"  KW_KEYS="confirm down down confirm back"
//   KW_TIMER=1 simulates the day-start wake. KW_CLOCK=unset simulates a flat battery (clock not set).
#include "../src/hal/hal.h"
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <sys/stat.h>
#include <dirent.h>
#include <unistd.h>

static uint8_t fb[800 * 480 / 8];
static std::string sd = "host/sd", outDir = "host/out";
static std::vector<std::string> keys;
static size_t keyPos = 0;
static int frame = 0;
static time_t offset = 0;  // simulated clock = real clock + offset
static bool timerWake = false;
static uint32_t backHoldMs = 1200;
static bool clockSet = true;  // KW_CLOCK=unset simulates a flat battery: not set until Clock > Save
namespace hal { bool hostRadioOn(); void hostAdvance(uint32_t ms); }
static uint32_t skewMs = 0;   // "skip<ms>" in KW_KEYS moves the clock the app sees forward (idle sleep tests)
void hostPhone(const char* what) __attribute__((weak));  // host/phone_sim.cpp: a phone on the page, for the preview and the network test

static std::string env(const char* k, const char* d = "") { const char* v = getenv(k); return v ? v : d; }

namespace hal {
bool hostRadioOn();
void hostAdvance(uint32_t ms) { skewMs += ms; }
void begin() {
  sd = env("KW_SD", "host/sd"); outDir = env("KW_OUT", "host/out");
  mkdir(outDir.c_str(), 0755);
  std::istringstream ks(env("KW_KEYS")); std::string k; while (ks >> k) keys.push_back(k);
  timerWake = env("KW_TIMER") == "1";
  clockSet = env("KW_CLOCK") != "unset";
  std::string n = env("KW_NOW");
  if (!n.empty()) {
    setenv("TZ", "PST8PDT,M3.2.0,M11.1.0", 1); tzset();
    struct tm tm = {}; sscanf(n.c_str(), "%d-%d-%d %d:%d", &tm.tm_year, &tm.tm_mon, &tm.tm_mday, &tm.tm_hour, &tm.tm_min);
    tm.tm_year -= 1900; tm.tm_mon -= 1; tm.tm_isdst = -1;
    offset = mktime(&tm) - time(nullptr);
  }
}
uint8_t* framebuffer() { return fb; }
void show(Refresh mode, const char* tag) {
  char path[512]; snprintf(path, sizeof path, "%s/%02d-%s-%s.pbm", outDir.c_str(), frame++, tag,
                           mode == Refresh::Full ? "full" : mode == Refresh::Half ? "half" : "fast");
  FILE* f = fopen(path, "wb");
  fprintf(f, "P4\n800 480\n");
  for (int i = 0; i < 800 * 480 / 8; i++) fputc(~fb[i] & 0xFF, f);  // PBM: 1 = black
  fclose(f);
  printf("frame %s\n", path);
}
Btn waitButton(uint32_t) {
  if (keyPos >= keys.size()) { printf("radio at end: %s\nscript done\n", hostRadioOn() ? "ON" : "off"); exit(0); }
  const std::string& k = keys[keyPos++];
  if (k == "back") return Btn::Back;
  if (k == "confirm") return Btn::Confirm;
  if (k == "left") return Btn::Left;
  if (k == "right") return Btn::Right;
  if (k == "up") return Btn::Up;
  if (k == "down") return Btn::Down;
  if (k == "power") return Btn::Power;
  if (k == "backhold") return Btn::BackHold;
  if (k == "idle") return Btn::None;
  if (k.compare(0, 4, "skip") == 0) { skewMs += (uint32_t)atol(k.c_str() + 4); return Btn::None; }
  if (k.compare(0, 6, "phone-") == 0) { if (hostPhone) hostPhone(k.c_str() + 6); return Btn::None; }
  return Btn::None;
}
void setBackHold(uint32_t ms) { backHoldMs = ms; printf("back hold %u ms\n", (unsigned)ms); }
uint32_t millis() { using namespace std::chrono; return skewMs + (uint32_t)duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count(); }
time_t now() { return time(nullptr) + offset; }
void setTime(time_t utc) { offset = utc - time(nullptr); clockSet = true; }
bool timeValid() { return clockSet; }

static std::string full(const char* p) { return sd + p; }
bool readFile(const char* path, std::string& out) {
  std::ifstream f(full(path), std::ios::binary); if (!f) return false;
  std::stringstream ss; ss << f.rdbuf(); out = ss.str(); return true;
}
bool writeFile(const char* path, const std::string& data) { std::ofstream f(full(path), std::ios::binary); f << data; return (bool)f; }
bool appendLine(const char* path, const std::string& line) { std::ofstream f(full(path), std::ios::app); f << line << "\n"; return (bool)f; }
bool exists(const char* path) { struct stat st; return stat(full(path).c_str(), &st) == 0; }
int listFiles(const char* dir, char (*names)[48], int max) {
  DIR* d = opendir(full(dir).c_str()); if (!d) return 0;
  int n = 0;
  while (dirent* e = readdir(d)) {
    struct stat st; if (stat(full((std::string(dir) + "/" + e->d_name).c_str()).c_str(), &st) != 0 || S_ISDIR(st.st_mode)) continue;
    if (n < max && strlen(e->d_name) <= 47) strcpy(names[n++], e->d_name);
  }
  closedir(d); return n;
}
bool removeFile(const char* path) { return unlink(full(path).c_str()) == 0; }
bool renameFile(const char* from, const char* to) { return !exists(to) && rename(full(from).c_str(), full(to).c_str()) == 0; }
bool makeDir(const char* path) { return mkdir(full(path).c_str(), 0755) == 0 || exists(path); }
bool removeEmptyDir(const char* path) { return rmdir(full(path).c_str()) == 0; }
int batteryPercent() { return 82; }
bool woke_by_timer() { return timerWake; }
// ---- simulated Wi-Fi: no network is touched. KW_WIFI="Home=hunter22:-48;Cafe=:-80" (ssid=password:rssi, empty password = open),
// KW_WIFI_POLLS (how many polls a join takes, default 2), KW_WIFI_HANG=1 (a join that never answers), KW_WIFI_DROP=1 (the network vanishes once up),
// KW_WIFI_IP, KW_CLIENTS, KW_SEED (random source). Every radio call prints one "net: ..." line (never a password) so tests can audit them.
struct SimNet { std::string ssid, pass; int rssi; };
static std::vector<SimNet> simNets;
static bool simParsed = false, apOn = false, staOn = false, dropped = false;
bool hostRadioOn() { return apOn || staOn; }
static Link simLink = Link::Off; static LinkErr simErr = LinkErr::None; static int joinPolls = 0; static std::string joinSsid, joinPass, mdnsName;
static uint32_t rngState = 0;
static void simParse() {
  if (simParsed) return;
  simParsed = true;
  std::string w = env("KW_WIFI"); size_t a = 0;
  while (a < w.size()) {
    size_t b = w.find(';', a); if (b == std::string::npos) b = w.size();
    std::string e = w.substr(a, b - a); a = b + 1;
    const size_t eq = e.find('='), co = e.rfind(':'); if (eq == std::string::npos || co == std::string::npos || co < eq) continue;
    simNets.push_back({e.substr(0, eq), e.substr(eq + 1, co - eq - 1), atoi(e.c_str() + co + 1)});
  }
}
bool wifiStart(const char*, const char*) { if (hostRadioOn()) return false; simParse(); apOn = staOn = true; printf("net: start-ap\n"); return true; }
bool wifiStartStation(const char*) { if (hostRadioOn()) return false; simParse(); staOn = true; printf("net: start-sta\n"); return true; }
void wifiLoop() {}
void wifiStop() { if (hostRadioOn()) printf("net: stop\n"); apOn = staOn = false; simLink = Link::Off; mdnsName.clear(); }
int wifiClients() { return hostRadioOn() ? atoi(env("KW_CLIENTS", "1").c_str()) : 0; }
int wifiScan(WifiNet* out, int max) {
  simParse(); printf("net: scan\n"); int n = 0;
  for (auto& s : simNets) { if (n >= max) break; snprintf(out[n].ssid, sizeof out[n].ssid, "%s", s.ssid.c_str()); out[n].rssi = (int8_t)s.rssi; out[n].secure = !s.pass.empty(); n++; }
  return n;
}
bool wifiJoin(const char* ssid, const char* pass) {
  if (!staOn) return false;
  joinSsid = ssid; joinPass = pass; simLink = Link::Joining; simErr = LinkErr::None; dropped = false;
  joinPolls = atoi(env("KW_WIFI_POLLS", "2").c_str()); printf("net: join %s\n", ssid);
  return true;
}
Link wifiLink(LinkErr* why) {
  if (why) *why = simErr;
  if (simLink == Link::Joining && env("KW_WIFI_HANG") != "1" && --joinPolls <= 0) {
    const SimNet* f = nullptr; for (auto& s : simNets) if (s.ssid == joinSsid) f = &s;
    if (!f) { simLink = Link::Failed; simErr = LinkErr::NotFound; }
    else if (f->pass != joinPass) { simLink = Link::Failed; simErr = LinkErr::BadPassword; }
    else simLink = Link::Up;
    if (why) *why = simErr;
  }
  if (simLink == Link::Up && env("KW_WIFI_DROP") == "1" && dropped) simLink = Link::Off;   // the network vanishes after it was seen up once
  else if (simLink == Link::Up) dropped = true;
  return simLink;
}
void wifiJoinCancel() { if (simLink == Link::Joining) simLink = Link::Off; printf("net: join-cancel\n"); }
void wifiDropHotspot() { if (apOn) printf("net: drop-ap\n"); apOn = false; }
bool wifiAddress(char* out, int cap) { if (simLink != Link::Up) return false; snprintf(out, cap, "%s", env("KW_WIFI_IP", "192.168.1.42").c_str()); return true; }
bool wifiMdns(const char* name) { mdnsName = name; printf("net: mdns %s.local\n", name); return true; }
uint32_t random32() { if (!rngState) rngState = (uint32_t)atol(env("KW_SEED", "20261014").c_str()) | 1; rngState ^= rngState << 13; rngState ^= rngState >> 17; rngState ^= rngState << 5; return rngState; }
void memInfo(uint32_t* f, uint32_t* lo, uint32_t* blk) { *f = *lo = *blk = 0; }
void sleepUntil(time_t wakeAt) {
  char b[64]; struct tm tm; localtime_r(&wakeAt, &tm); strftime(b, sizeof b, "%Y-%m-%d %H:%M", &tm);
  printf("radio at sleep: %s\n", hostRadioOn() ? "ON" : "off");
  printf("deep sleep until %s (or power button)\n", b);
  exit(0);
}
}  // namespace hal

#include "../src/app.h"
int main() { appMain(); }
