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
void setBackHold(uint32_t ms);          // how long Back is held to become Btn::BackHold (0 = never: Back is always a plain press)

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

// Wi-Fi hotspot with the local web page (device only; the host build simulates it).
// The radio and the web server are owned by the Wi-Fi screen (core/net.cpp): started when it opens a mode, freed by wifiStop().
bool wifiStart(const char* ssid, const char* pass);  // hotspot (AP + station, so it can scan and join) and the web server; one client
void wifiLoop();                        // serve requests; call often while the Wi-Fi screen is up
void wifiStop();                        // web server, mDNS and radio off, memory freed. Safe to call when nothing is running.
int wifiClients();
// Station mode (the user's own Wi-Fi). Nothing here opens a connection to anywhere but the joined network's own access point
// (DHCP, its gateway and DNS); there is deliberately no "connect to host" call. Sync (BUILD-PLAN N2) will add one, and the off test will change with it.
struct WifiNet { char ssid[33]; int8_t rssi; bool secure; };
enum class Link : uint8_t { Off, Joining, Up, Failed };
enum class LinkErr : uint8_t { None, NotFound, BadPassword, Other };
bool wifiStartStation(const char* hostname);                 // radio in station mode plus the web server, no hotspot
int wifiScan(WifiNet* out, int max);                         // blocking (a few seconds); strongest first, no duplicates or hidden names
bool wifiJoin(const char* ssid, const char* pass);           // begin joining; poll wifiLink(). Never persisted by the radio driver.
Link wifiLink(LinkErr* why);
void wifiJoinCancel();                                       // stop trying, leave the hotspot (if any) up
void wifiDropHotspot();                                      // after a phone-driven join: keep only the station side
bool wifiAddress(char* out, int cap);                        // the station's IPv4 address as text, false if none
bool wifiMdns(const char* name);                             // announce <name>.local (http, port 80) on the joined network
uint32_t random32();                                         // hardware random (esp_random) / the host's seeded source
void memInfo(uint32_t* freeBytes, uint32_t* lowWater, uint32_t* largestBlock);  // heap numbers for the on-device probe (0s on the host)

// ---- Sync with the user's Studio (BUILD-PLAN N2). The ONLY calls that reach a host other than the joined network's own access point.
// Called only from core/sync.cpp (syncRun), which the app calls only when the user presses Send on the sync preview screen. The default
// firmware build has no TLS: syncBuilt() is false and every other call here does nothing. The x4-tls build pins the CA the caller gives
// and checks the host name against it (net/hostcheck.cpp); a build that cannot check the host name refuses to send (SyncNet::NoHostCheck).
enum class SyncNet : uint8_t { Ok, NotBuilt, Unreachable, Tls, NoHostCheck, WrongServer, Aborted, Failed };
bool syncBuilt();
bool wifiStartSync();                                        // radio in station mode ONLY: no web page, no hotspot, no name announcement
SyncNet syncOpen(const char* host, uint16_t port, const char* caPem);   // TCP probe, TLS with the pinned CA + host name check, GET /api/health
// One request on the open session. offset >= 0 sends X-Offset. body may be null. The answer's body goes in reply (NUL-terminated, cut at cap).
SyncNet syncRequest(const char* method, const char* path, const char* token, long offset, const uint8_t* body, size_t len, int* code, char* reply, size_t cap, int* retryAfter);
void syncClose();
bool syncAbort();                                            // true once Back was pressed since the last call
void pauseMs(uint32_t ms);
long fileSize(const char* path);                             // -1 if missing
int readAt(const char* path, uint32_t offset, uint8_t* buf, int cap);   // bytes read, 0 at the end, -1 on error

// Power: show whatever is in the framebuffer and deep-sleep until `wakeAt` (UTC) or the power button.
[[noreturn]] void sleepUntil(time_t wakeAt);
}  // namespace hal
