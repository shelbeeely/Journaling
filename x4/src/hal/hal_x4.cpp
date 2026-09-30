// Xteink X4 implementation of the HAL on the FreeInk SDK (ESP32-C3, SSD1677/UC8179 800x480 panel).
#ifdef ARDUINO
#include "hal.h"
#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <esp_random.h>
#include <sys/time.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include <BoardConfig.h>
#include <EInkDisplay.h>
#include <InputManager.h>
#include <SDCardManager.h>
#include <BatteryMonitor.h>
#include <PowerManager.h>
#include <XteinkDetect.h>
#include "../net/webpage.h"
#include "../core/net.h"

#ifdef FREEINK_NET_WOLFSSL
bool kwTlsProbe();  // net/tlsprobe.cpp
#endif
static EInkDisplay display(BoardConfig::ACTIVE.display.sclk, BoardConfig::ACTIVE.display.mosi, BoardConfig::ACTIVE.display.cs,
                           BoardConfig::ACTIVE.display.dc, BoardConfig::ACTIVE.display.rst, BoardConfig::ACTIVE.display.busy);
static InputManager input;
static SDCardManager sdcard;
static WebServer* server = nullptr;
static bool sdOk = false;

// Survives deep sleep (not a battery power-off): whether the clock was set by a person since power-up.
RTC_DATA_ATTR static bool clockTrusted = false;
RTC_DATA_ATTR static uint32_t bootCount = 0;
static constexpr time_t MIN_VALID = 1767225600;  // 2026-01-01

namespace hal {

void begin() {
  BoardConfig::holdPowerRails();                  // keep GPIO13 (battery latch) up
  bootCount++;
  freeink::applyXteinkDisplayController();        // SSD1677 or UC8179, probed before SPI owns the pins
  SPI.begin(BoardConfig::ACTIVE.display.sclk, BoardConfig::ACTIVE.sd.miso, BoardConfig::ACTIVE.display.mosi, BoardConfig::ACTIVE.display.cs);
  display.begin();
  input.begin();
#ifdef FREEINK_NET_WOLFSSL
  Serial.printf("[tls] probe %d\n", kwTlsProbe() ? 1 : 0);  // x4-tls only: keeps wolfSSL linked so CI can size it
#endif
  sdOk = sdcard.begin();
  if (sdOk) { sdcard.mkdir("/kw"); sdcard.mkdir("/kw/log"); sdcard.mkdir("/kw/library"); }
  // After a battery power-off the RTC restarts at 1970: fall back to the last saved time so the
  // day pages still roughly match, and mark the clock untrusted until it is set again.
  if (time(nullptr) < MIN_VALID) {
    std::string s;
    if (readFile("/kw/clock.txt", s)) { struct timeval tv = {(time_t)atoll(s.c_str()), 0}; settimeofday(&tv, nullptr); }
    clockTrusted = false;
  }
}

uint8_t* framebuffer() { return display.getFrameBuffer(); }

void show(Refresh mode, const char*) {
  display.displayBuffer(mode == Refresh::Full ? EInkDisplay::FULL_REFRESH
                        : mode == Refresh::Half ? EInkDisplay::HALF_REFRESH : EInkDisplay::FAST_REFRESH);
}

static uint32_t backHoldMs = 1200;  // Settings: 1200, 2500 or 0 (no long press)
void setBackHold(uint32_t ms) { backHoldMs = ms; }
uint32_t millis() { return ::millis(); }

// Buttons: short press on release, long-press Back (1.2 s) = Support, long-press Power (3 s) = sleep.
Btn waitButton(uint32_t timeoutMs) {
  const uint32_t start = ::millis();
  static const uint8_t MAP[] = {InputManager::BTN_BACK, InputManager::BTN_CONFIRM, InputManager::BTN_LEFT, InputManager::BTN_RIGHT,
                                InputManager::BTN_UP, InputManager::BTN_DOWN, InputManager::BTN_POWER};
  static const Btn OUT[] = {Btn::Back, Btn::Confirm, Btn::Left, Btn::Right, Btn::Up, Btn::Down, Btn::Power};
  while (::millis() - start < timeoutMs) {
    input.update();
    for (int i = 0; i < 7; i++) {
      if (!input.wasPressed(MAP[i])) continue;
      if ((OUT[i] == Btn::Back && backHoldMs) || OUT[i] == Btn::Power) {
        const uint32_t t0 = ::millis(), holdMs = OUT[i] == Btn::Back ? backHoldMs : 3000;
        while (input.isPressed(MAP[i])) {
          input.update();
          if (::millis() - t0 > holdMs) {
            while (input.isPressed(MAP[i])) { input.update(); delay(10); }
            return OUT[i] == Btn::Back ? Btn::BackHold : Btn::PowerHold;
          }
          delay(10);
        }
      }
      return OUT[i];
    }
    if (server) server->handleClient();
    delay(10);
  }
  return Btn::None;
}

time_t now() { return time(nullptr); }
void setTime(time_t utc) {
  struct timeval tv = {utc, 0};
  settimeofday(&tv, nullptr);
  clockTrusted = true;
  writeFile("/kw/clock.txt", std::to_string((long long)utc));
}
bool timeValid() { return clockTrusted && time(nullptr) >= MIN_VALID; }

bool readFile(const char* path, std::string& out) {
  if (!sdOk) return false;
  FsFile f = sdcard.open(path, O_RDONLY);
  if (!f) return false;
  const size_t n = f.size();
  out.resize(n);
  const int got = f.read(&out[0], n);
  if (got < 0) { out.clear(); return false; }
  out.resize(got);
  return true;
}
bool writeFile(const char* path, const std::string& data) {
  if (!sdOk) return false;
  FsFile f = sdcard.open(path, O_WRONLY | O_CREAT | O_TRUNC);
  if (!f) return false;
  return f.write(data.data(), data.size()) == data.size();
}
bool appendLine(const char* path, const std::string& line) {
  if (!sdOk) return false;
  FsFile f = sdcard.open(path, O_WRONLY | O_CREAT | O_APPEND);
  if (!f) return false;
  f.write(line.data(), line.size());
  f.write("\n", 1);
  f.sync();
  return true;
}
bool exists(const char* path) { return sdOk && sdcard.exists(path); }
int listFiles(const char* dir, char (*names)[48], int max) {
  if (!sdOk) return 0;
  int n = 0;
  for (auto& s : sdcard.listFiles(dir, max)) {
    if (n >= max) break;
    if (s.length() > 47) continue;
    strcpy(names[n++], s.c_str());
  }
  return n;
}
bool removeFile(const char* path) { return sdOk && sdcard.remove(path); }
bool renameFile(const char* from, const char* to) { return sdOk && !sdcard.exists(to) && sdcard.rename(from, to); }
bool makeDir(const char* path) { return sdOk && sdcard.mkdir(path); }
bool removeEmptyDir(const char* path) { return sdOk && sdcard.rmdir(path); }  // rmdir refuses a folder with files in it

int batteryPercent() { static const BatteryMonitor battery; return battery.readPercentage(); }
bool woke_by_timer() { return esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER; }

// ---------- Wi-Fi: hotspot or the user's own network, and the local web page ----------
// The radio and the web server belong to the Wi-Fi screen (core/net.cpp starts and stops them); nothing here runs by itself.
// The driver is told not to persist anything (WiFi.persistent(false)): the only place a network password is kept is /kw/net.txt.
// No call in this file opens a connection to a host: the station side only joins the user's access point (DHCP, its gateway, DNS).
//
// Who may do what (core/net.cpp, NetGuard): on the user's Wi-Fi every write and every read of private data needs the PIN shown on
// the device (sent as a cookie after /api/unlock); the hotspot is gated by its own password and its one-client limit.
static uint8_t joinState = 0;  // 0 not joining, 1 joining, 2 up
static void logMem(const char* tag) {
  Serial.printf("[mem] %s free=%u low=%u block=%u\n", tag, (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMinFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
}

// Where an uploaded file may go: month packs, check-ins and support list in /kw; books in /kw/library.
// Anything else is refused, and names can't climb out of those folders. `me.txt` (her safety plan) is
// never accepted as an upload: only the safety-plan editor (POST /api/me) writes it. Nothing here can
// reach /kw/log (no folder names pass), so check-ins are never overwritten. /kw/net.txt (Wi-Fi passwords) is not on the list either.
static String uploadDir(const String& n) {
  if (n.indexOf('/') >= 0 || n.indexOf('\\') >= 0 || n.startsWith(".")) return "";
  if (n == "support.txt" || n == "checkins.txt") return "/kw/";
  if (n.length() == 11 && n.endsWith(".txt") && n[4] == '-' && isDigit(n[0]) && isDigit(n[5])) return "/kw/";
  if (n.endsWith(".pdf") || n.endsWith(".epub")) return "/kw/library/";
  return "";
}
// WebServer::streamFile wants Arduino's File; SdFat files are sent in chunks instead.
static void sendFile(FsFile& f, const char* type, const String& downloadName) {
  server->sendHeader("Content-Disposition", "attachment; filename=" + downloadName);
  server->setContentLength(f.size());
  server->send(200, type, "");
  static uint8_t buf[2048];
  WiFiClient c = server->client();
  int n;
  while ((n = f.read(buf, sizeof buf)) > 0) { if (c.write(buf, n) != (size_t)n) break; }
}
static FsFile uploadFile;
static String uploadName, uploadRefused;
static Verdict uploadVerdict = Verdict::Ok;

// A request that came in on the hotspot's own address is a hotspot request; anything else arrived over the user's Wi-Fi.
static bool viaLan() { return server->client().localIP() != WiFi.softAPIP(); }
static uint32_t peerIp() { return (uint32_t)server->client().remoteIP(); }
static String cookieToken() {
  const String c = server->header("Cookie");
  int i = c.indexOf("kw=");
  if (i < 0) return "";
  i += 3;
  const int e = c.indexOf(';', i);
  return e < 0 ? c.substring(i) : c.substring(i, e);
}
static void reply(const NetResp& r) {
  if (r.cookie) server->sendHeader("Set-Cookie", r.cookie);
  server->sendHeader("Cache-Control", "no-store");
  server->send(r.code, r.type, r.body);
}
static bool allow(Route r) {
  const Verdict v = NC.gate(r, viaLan(), peerIp(), cookieToken().c_str());
  if (v == Verdict::Ok) return true;
  reply(NC.denied(v));
  return false;
}
static void wipe(String& s) { for (unsigned i = 0; i < s.length(); i++) s[i] = 0; }

static bool serverStart() {
  server = new (std::nothrow) WebServer(80);
  if (!server) return false;
  static const char* HDRS[] = {"Cookie"};
  server->collectHeaders(HDRS, 1);
  server->on("/", HTTP_GET, [] { NC.lastReq = ::millis(); server->send(200, "text/html; charset=utf-8", WEB_PAGE); });
  server->on("/api/info", HTTP_GET, [] { reply(NC.info(viaLan(), peerIp(), cookieToken().c_str())); });
  server->on("/api/unlock", HTTP_POST, [] { String p = server->arg("pin"); reply(NC.unlock(viaLan(), peerIp(), p.c_str())); wipe(p); });
  server->on("/api/net/scan", HTTP_GET, [] { reply(NC.scan(viaLan(), peerIp(), cookieToken().c_str())); });
  server->on("/api/net/join", HTTP_POST, [] {
    String s = server->arg("ssid"), p = server->arg("pass");
    reply(NC.join(viaLan(), peerIp(), cookieToken().c_str(), s.c_str(), p.c_str()));
    wipe(p);  // the password lives on in one place only: the join in flight, then /kw/net.txt
  });
  server->on("/api/net/forget", HTTP_POST, [] { reply(NC.forget(viaLan(), peerIp(), cookieToken().c_str(), server->arg("ssid").c_str())); });
  server->on("/api/net/name", HTTP_POST, [] { reply(NC.rename(viaLan(), peerIp(), cookieToken().c_str(), server->arg("name").c_str())); });
  server->on("/api/lib", HTTP_GET, [] {
    if (!allow(Route::Read)) return;
    const String n = server->arg("f");
    if (uploadDir(n) != "/kw/library/") { server->send(400, "text/plain", "Not a book."); return; }
    FsFile f = sdcard.open(("/kw/library/" + n).c_str(), O_RDONLY);
    if (!f) { server->send(404, "text/plain", "That book isn't on the card."); return; }
    sendFile(f, n.endsWith(".pdf") ? "application/pdf" : "application/epub+zip", n);
  });
  server->on("/api/status", HTTP_GET, [] {
    if (!allow(Route::Read)) return;
    String j = "{\"now\":" + String((long long)time(nullptr)) + ",\"trusted\":" + (clockTrusted ? "true" : "false") +
               ",\"battery\":" + String(batteryPercent()) + ",\"files\":[";
    bool first = true;
    for (auto& n : sdcard.listFiles("/kw", 100)) { if (n == "net.txt" || n == "net.tmp") continue; j += (first ? "\"" : ",\"") + n + "\""; first = false; }
    j += "],\"logs\":[";
    first = true;
    for (auto& n : sdcard.listFiles("/kw/log", 100)) { j += (first ? "\"" : ",\"") + n + "\""; first = false; }
    j += "],\"library\":[";
    first = true;
    for (auto& n : sdcard.listFiles("/kw/library", 200)) {
      FsFile f = sdcard.open(("/kw/library/" + n).c_str(), O_RDONLY);
      j += (first ? "{\"n\":\"" : ",{\"n\":\"") + n + "\",\"s\":" + String((unsigned long)(f ? f.size() : 0)) + "}";
      first = false;
    }
    j += "]}";
    server->send(200, "application/json", j);
  });
  server->on("/api/time", HTTP_POST, [] {
    if (!allow(Route::Write)) return;
    const long long t = server->arg("plain").toInt();
    if (t < MIN_VALID) { server->send(400, "text/plain", "That time looks wrong."); return; }
    setTime((time_t)t);
    server->send(200, "text/plain", "Clock set.");
  });
  server->on("/api/log", HTTP_GET, [] {
    if (!allow(Route::Read)) return;
    const String m = server->arg("m");
    if (m.length() != 7) { server->send(400, "text/plain", "Pick a month."); return; }
    FsFile f = sdcard.open(("/kw/log/" + m + ".csv").c_str(), O_RDONLY);
    if (!f) { server->send(404, "text/plain", "No check-ins that month."); return; }
    sendFile(f, "text/csv", "keeping-watch-" + m + ".csv");
  });
  server->on("/api/me", HTTP_GET, [] { if (!allow(Route::Read)) return; std::string s; readFile("/kw/me.txt", s); server->send(200, "text/plain; charset=utf-8", s.c_str()); });
  server->on("/api/me", HTTP_POST, [] {
    if (!allow(Route::Write)) return;
    const String body = server->arg("plain");
    if (body.length() > 8000) { server->send(413, "text/plain", "That is too long for the device."); return; }
    writeFile("/kw/me.txt", std::string(body.c_str()));
    server->send(200, "text/plain", "Saved.");
  });
  server->on("/api/upload", HTTP_POST, [] {
      if (uploadVerdict != Verdict::Ok) { reply(NC.denied(uploadVerdict)); return; }
      if (uploadName.length()) { server->send(200, "text/plain", "Uploaded " + uploadName); return; }
      const bool plan = uploadRefused == "me.txt";
      server->send(plan ? 403 : 400, "text/plain", plan ? "Not uploaded: me.txt is your safety plan. Change it in the My safety plan box above." : "Not uploaded: the X4 doesn't take that file name.");
    },
    [] {
      HTTPUpload& up = server->upload();
      if (up.status == UPLOAD_FILE_START) {
        uploadVerdict = NC.gate(Route::Write, viaLan(), peerIp(), cookieToken().c_str());   // checked before the first byte is stored
        uploadName = up.filename; uploadRefused = "";
        if (uploadVerdict != Verdict::Ok) { uploadName = ""; return; }
        const String dir = uploadDir(uploadName);
        if (!dir.length()) { uploadRefused = uploadName; uploadName = ""; return; }
        uploadFile = sdcard.open((dir + uploadName).c_str(), O_WRONLY | O_CREAT | O_TRUNC);
      } else if (up.status == UPLOAD_FILE_WRITE) {
        if (uploadFile) uploadFile.write(up.buf, up.currentSize);
      } else if (up.status == UPLOAD_FILE_END || up.status == UPLOAD_FILE_ABORTED) {
        if (uploadFile) uploadFile.close();
      }
    });
  server->begin();
  return true;
}

bool wifiStart(const char* ssid, const char* pass) {
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);                        // the station half is there so the page can scan and join; nothing connects until she asks
  WiFi.setAutoReconnect(false);
  if (!WiFi.softAP(ssid, pass, 1, 0, 1)) return false;   // WPA2, one client at a time
  logMem("hotspot up");
  return serverStart();
}
bool wifiStartStation(const char* hostname) {
  WiFi.persistent(false);
  WiFi.setHostname(hostname);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  return serverStart();
}
void wifiLoop() { if (server) server->handleClient(); }
void wifiStop() {
  const bool was = server || WiFi.getMode() != WIFI_MODE_NULL;
  if (server) { server->stop(); delete server; server = nullptr; }
  MDNS.end();
  if (WiFi.getMode() != WIFI_MODE_NULL) { WiFi.softAPdisconnect(true); WiFi.disconnect(true, false); WiFi.mode(WIFI_OFF); }   // false: leave the driver's own stored settings alone
  joinState = 0;
  if (was) logMem("wifi off");
}
int wifiClients() {
  if (!server) return 0;
  if (WiFi.getMode() == WIFI_AP_STA || WiFi.getMode() == WIFI_AP) return WiFi.softAPgetStationNum();
  return NC.guard.held(::millis()) ? 1 : 0;      // on the user's Wi-Fi: the one device that has unlocked the page
}

int wifiScan(WifiNet* out, int max) {
  const int n = WiFi.scanNetworks(false, false);   // blocking, hidden networks left out
  int k = 0;
  for (int i = 0; i < n; i++) {
    const String s = WiFi.SSID(i);
    if (!s.length() || s.length() > 32) continue;
    int at = -1;
    for (int j = 0; j < k; j++) if (s == out[j].ssid) at = j;
    const int8_t r = (int8_t)WiFi.RSSI(i);
    if (at >= 0) { if (r > out[at].rssi) out[at].rssi = r; continue; }   // the same name on two access points: keep the stronger
    if (k >= max) continue;
    snprintf(out[k].ssid, sizeof out[k].ssid, "%s", s.c_str());
    out[k].rssi = r; out[k].secure = WiFi.encryptionType(i) != WIFI_AUTH_OPEN; k++;
  }
  WiFi.scanDelete();
  for (int a = 1; a < k; a++) { WifiNet t = out[a]; int b = a - 1; while (b >= 0 && out[b].rssi < t.rssi) { out[b + 1] = out[b]; b--; } out[b + 1] = t; }
  return k;
}
bool wifiJoin(const char* ssid, const char* pass) {
  WiFi.disconnect(false);
  WiFi.begin(ssid, (pass && *pass) ? pass : nullptr);
  joinState = 1;
  return true;
}
Link wifiLink(LinkErr* why) {
  if (why) *why = LinkErr::None;
  if (!joinState) return Link::Off;
  const wl_status_t st = WiFi.status();
  if (st == WL_CONNECTED) { if (joinState == 1) logMem("joined"); joinState = 2; return Link::Up; }
  if (joinState == 2) return Link::Off;                    // was up, now gone
  if (st == WL_NO_SSID_AVAIL || st == WL_CONNECT_FAILED || st == WL_CONNECTION_LOST) {
    if (why) *why = st == WL_NO_SSID_AVAIL ? LinkErr::NotFound : st == WL_CONNECT_FAILED ? LinkErr::BadPassword : LinkErr::Other;
    WiFi.disconnect(false);                                // stop the driver retrying by itself
    joinState = 0;
    return Link::Failed;
  }
  return Link::Joining;
}
void wifiJoinCancel() { WiFi.disconnect(false); joinState = 0; }
void wifiDropHotspot() { WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA); }
bool wifiAddress(char* out, int cap) {
  const IPAddress a = WiFi.localIP();
  if (a == IPAddress((uint32_t)0)) return false;
  snprintf(out, cap, "%u.%u.%u.%u", a[0], a[1], a[2], a[3]);
  return true;
}
bool wifiMdns(const char* name) {
  MDNS.end();
  if (!MDNS.begin(name)) return false;
  MDNS.addService("http", "tcp", 80);
  return true;
}
uint32_t random32() { return esp_random(); }
void memInfo(uint32_t* f, uint32_t* lo, uint32_t* blk) { *f = ESP.getFreeHeap(); *lo = ESP.getMinFreeHeap(); *blk = ESP.getMaxAllocHeap(); }

// ---------- sleep ----------
// Unlike CrossPoint's "off" (which drops GPIO13 and cuts the battery), this keeps the battery latch
// held so the RTC keeps time and the midnight timer can redraw the page. Standby draw is higher than
// off, so expect weeks, not months, per charge.
void sleepUntil(time_t wakeAt) {
  wifiStop();
  writeFile("/kw/clock.txt", std::to_string((long long)time(nullptr)));
  display.deepSleep();
  sdcard.shutdown();
  const int8_t latch = BoardConfig::ACTIVE.power.latch0;
  if (latch >= 0) {
    gpio_hold_dis((gpio_num_t)latch);
    pinMode(latch, OUTPUT); digitalWrite(latch, HIGH);
    gpio_hold_en((gpio_num_t)latch);
  }
  const time_t n = time(nullptr);
  if (wakeAt > n && timeValid()) esp_sleep_enable_timer_wakeup((uint64_t)(wakeAt - n) * 1000000ULL);
  freeink::PowerManager::waitForPowerButtonRelease();
  freeink::PowerManager::armPowerButtonWakeup();
  freeink::PowerManager::deepSleep();
}

}  // namespace hal
#endif
