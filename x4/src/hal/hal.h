#pragma once
// Hardware abstraction: the app talks only to this interface. hal_x4.cpp implements it on the
// Xteink X4 with the FreeInk SDK; host/hal_host.cpp implements it on a PC (files + PNG output),
// so every screen can be previewed pixel-for-pixel without a device.
#include <stdint.h>
#include <string>
#include <time.h>

enum class Btn : uint8_t { None, Back, Confirm, Left, Right, Up, Down, Power, BackHold, PowerHold };
enum class Refresh : uint8_t { Full, Half, Fast };  // Full = flash & clean, Fast = partial, no flash

namespace hal {
void begin();
uint8_t* framebuffer();                 // 800x480 1-bit, bit set = white
void show(Refresh mode, const char* tag);  // push the framebuffer to the panel
Btn waitButton(uint32_t timeoutMs);     // Btn::None on timeout
uint32_t millis();

// Clock (local time comes from TZ; the device keeps UTC).
time_t now();
void setTime(time_t utc);
bool timeValid();  // false after a full power loss until the clock is set

// SD card (paths are absolute from the card root, e.g. "/kw/2026-10.txt").
bool readFile(const char* path, std::string& out);
bool writeFile(const char* path, const std::string& data);
bool appendLine(const char* path, const std::string& line);
bool exists(const char* path);
// Folder helpers for the card-update step (core/update.cpp). File names only, no path, UTF-8; folders are skipped.
int listFiles(const char* dir, char (*names)[48], int max);  // returns how many were stored (names over 47 bytes are skipped)
bool removeFile(const char* path);
bool renameFile(const char* from, const char* to);            // fails if `to` exists
bool makeDir(const char* path);
bool removeEmptyDir(const char* path);                        // fails if the folder still holds anything

int batteryPercent();                   // -1 if unknown
bool woke_by_timer();                   // this boot came from the midnight timer, not a button

// Wi-Fi hotspot with the local web page (device only; the host build returns false).
bool wifiStart(const char* ssid, const char* pass);
void wifiLoop();                        // serve requests; call often while the Sync screen is up
void wifiStop();
int wifiClients();

// Power: show whatever is in the framebuffer and deep-sleep until `wakeAt` (UTC) or the power button.
[[noreturn]] void sleepUntil(time_t wakeAt);
}  // namespace hal
