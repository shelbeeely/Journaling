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

static std::string env(const char* k, const char* d = "") { const char* v = getenv(k); return v ? v : d; }

namespace hal {
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
  if (keyPos >= keys.size()) { printf("script done\n"); exit(0); }
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
  return Btn::None;
}
void setBackHold(uint32_t ms) { backHoldMs = ms; printf("back hold %u ms\n", (unsigned)ms); }
uint32_t millis() { using namespace std::chrono; return (uint32_t)duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count(); }
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
bool wifiStart(const char*, const char*) { return true; }
void wifiLoop() {}
void wifiStop() {}
int wifiClients() { return 1; }
void sleepUntil(time_t wakeAt) {
  char b[64]; struct tm tm; localtime_r(&wakeAt, &tm); strftime(b, sizeof b, "%Y-%m-%d %H:%M", &tm);
  printf("deep sleep until %s (or power button)\n", b);
  exit(0);
}
}  // namespace hal

#include "../src/app.h"
int main() { appMain(); }
