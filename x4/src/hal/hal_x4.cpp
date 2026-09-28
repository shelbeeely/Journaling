// Xteink X4 implementation of the HAL on the FreeInk SDK (ESP32-C3, SSD1677/UC8179 800x480 panel).
#ifdef ARDUINO
#include "hal.h"
#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
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
      if (OUT[i] == Btn::Back || OUT[i] == Btn::Power) {
        const uint32_t t0 = ::millis(), holdMs = OUT[i] == Btn::Back ? 1200 : 3000;
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

int batteryPercent() { static const BatteryMonitor battery; return battery.readPercentage(); }
bool woke_by_timer() { return esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER; }

// ---------- Wi-Fi hotspot + local web page ----------
// Where an uploaded file may go: month packs, support list and safety plan in /kw; books in
// /kw/library. Anything else is refused, and names can't climb out of those folders.
static String uploadDir(const String& n) {
  if (n.indexOf('/') >= 0 || n.indexOf('\\') >= 0 || n.startsWith(".")) return "";
  if (n == "support.txt" || n == "me.txt") return "/kw/";
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
static String uploadName;

bool wifiStart(const char* ssid, const char* pass) {
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(ssid, pass)) return false;
  server = new (std::nothrow) WebServer(80);
  if (!server) return false;
  server->on("/", HTTP_GET, [] { server->send(200, "text/html; charset=utf-8", WEB_PAGE); });
  server->on("/api/lib", HTTP_GET, [] {
    const String n = server->arg("f");
    if (uploadDir(n) != "/kw/library/") { server->send(400, "text/plain", "Not a book."); return; }
    FsFile f = sdcard.open(("/kw/library/" + n).c_str(), O_RDONLY);
    if (!f) { server->send(404, "text/plain", "That book isn't on the card."); return; }
    sendFile(f, n.endsWith(".pdf") ? "application/pdf" : "application/epub+zip", n);
  });
  server->on("/api/status", HTTP_GET, [] {
    String j = "{\"now\":" + String((long long)time(nullptr)) + ",\"trusted\":" + (clockTrusted ? "true" : "false") +
               ",\"battery\":" + String(batteryPercent()) + ",\"files\":[";
    bool first = true;
    for (auto& n : sdcard.listFiles("/kw", 100)) { j += (first ? "\"" : ",\"") + n + "\""; first = false; }
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
    const long long t = server->arg("plain").toInt();
    if (t < MIN_VALID) { server->send(400, "text/plain", "That time looks wrong."); return; }
    setTime((time_t)t);
    server->send(200, "text/plain", "Clock set.");
  });
  server->on("/api/log", HTTP_GET, [] {
    const String m = server->arg("m");
    if (m.length() != 7) { server->send(400, "text/plain", "Pick a month."); return; }
    FsFile f = sdcard.open(("/kw/log/" + m + ".csv").c_str(), O_RDONLY);
    if (!f) { server->send(404, "text/plain", "No check-ins that month."); return; }
    sendFile(f, "text/csv", "keeping-watch-" + m + ".csv");
  });
  server->on("/api/me", HTTP_GET, [] { std::string s; readFile("/kw/me.txt", s); server->send(200, "text/plain; charset=utf-8", s.c_str()); });
  server->on("/api/me", HTTP_POST, [] {
    const String body = server->arg("plain");
    if (body.length() > 8000) { server->send(413, "text/plain", "That is too long for the device."); return; }
    writeFile("/kw/me.txt", std::string(body.c_str()));
    server->send(200, "text/plain", "Saved.");
  });
  server->on("/api/upload", HTTP_POST, [] { server->send(200, "text/plain", uploadName.length() ? "Uploaded " + uploadName : "Nothing uploaded."); },
    [] {
      HTTPUpload& up = server->upload();
      if (up.status == UPLOAD_FILE_START) {
        uploadName = up.filename;
        const String dir = uploadDir(uploadName);
        if (!dir.length()) { uploadName = ""; return; }
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
void wifiLoop() { if (server) server->handleClient(); }
void wifiStop() {
  if (server) { server->stop(); delete server; server = nullptr; }
  if (WiFi.getMode() != WIFI_MODE_NULL) { WiFi.softAPdisconnect(true); WiFi.mode(WIFI_OFF); }
}
int wifiClients() { return server ? WiFi.softAPgetStationNum() : 0; }

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
