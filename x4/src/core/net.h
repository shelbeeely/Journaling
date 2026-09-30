#pragma once
// Wi-Fi modes (BUILD-PLAN section 19, slice N1): the hotspot, or the user's own Wi-Fi.
// Portable on purpose: the saved-network file, the PIN and one-client rules, the join state machine and the web API's
// answers live here, so the host tests run the same code the device does. hal:: does the radio, the app draws the screens.
//
// Rules this file keeps:
//  - /kw/net.txt holds Wi-Fi passwords in plain text, marked as such in its first lines. Nothing here uploads, logs or prints it.
//  - On the user's Wi-Fi every change, and every read of private data, needs the PIN shown on the device (new for each session).
//    Read-only info pages need none. The hotspot needs no PIN: its own password and its one-client limit are the gate.
//  - One client at a time. A second device is told the X4 is in use until the first has been quiet for two minutes.
//  - Static buffers only. Nothing large lives on the 16 KB loop stack.
#include <stdint.h>
#include <string>
#include "../hal/hal.h"

static const char* const NET_PATH = "/kw/net.txt";
static const int NET_MAX = 8;         // saved networks
static const int SSID_MAX = 32;       // 802.11 limit
static const int PASS_MAX = 63;       // WPA2 passphrase limit
static const int NETNAME_MAX = 24;    // <name>.local (a DNS label allows 63; short names are easier to type)
static const uint32_t JOIN_MS = 25000;
static const uint32_t LEASE_MS = 120000;   // a client that has been quiet this long gives up its place
static const int PIN_TRIES = 5;

struct SavedNet { char ssid[SSID_MAX + 1]; char pass[PASS_MAX + 1]; };
struct NetConfig {
  char name[NETNAME_MAX + 1] = "keeping-watch";
  SavedNet nets[NET_MAX] = {};
  int n = 0;
  int last = -1;   // the network used last (index into nets), -1 = none
};

// mDNS name: letters, digits and hyphens, 1..24, not starting or ending with a hyphen. netNameClean lowercases and drops what is not allowed.
bool netNameValid(const char* s);
void netNameClean(const char* in, char* out, int cap);
bool netTextOk(const char* s, int maxLen, bool allowEmpty);   // no control characters, length within the limit

std::string netText(const NetConfig& c);                 // the file contents, with its warning header
void netParse(const std::string& text, NetConfig& c);    // tolerant: unknown lines, CRLF and bad values are ignored
void netLoad(NetConfig& c);
bool netSave(const NetConfig& c);
int netFind(const NetConfig& c, const char* ssid);       // -1 if not saved
bool netAdd(NetConfig& c, const char* ssid, const char* pass);   // replaces a saved network of the same name; false if the list is full
void netForgetAt(NetConfig& c, int i);

// ---- who may do what over the LAN ----
enum class Route : uint8_t { Info, Read, Write };     // Info: read-only, nothing private. Read: private data. Write: changes something.
enum class Verdict : uint8_t { Ok, NeedPin, Busy, Locked };
struct NetGuard {
  char pin[7] = "";          // six digits, shown on the device, new for each session
  char token[17] = "";       // handed out (as a cookie) when the PIN is right; only the client that unlocked holds it
  uint32_t owner = 0;        // address of that client, 0 = nobody
  uint32_t lastUse = 0;
  uint8_t fails = 0;
  bool locked = false;       // too many wrong PINs: closed until the screen is left and opened again
  void begin(uint32_t r1);                                                  // a new session: new PIN, nobody holds the place, not locked
  Verdict check(Route r, bool lan, uint32_t cip, const char* token, uint32_t now);
  Verdict unlock(uint32_t ip, const char* pin, uint32_t now, uint32_t r1, uint32_t r2);
  bool held(uint32_t now) const { return owner && (uint32_t)(now - lastUse) < LEASE_MS; }
  int triesLeft() const { return locked ? 0 : PIN_TRIES - fails; }
};

// ---- the mode the screen is in ----
enum class NetPhase : uint8_t { Off, Hotspot, Joining, Wifi, Failed };
enum class NetWhy : uint8_t { None, NotFound, BadPassword, Timeout, Lost, Radio, NoCard, Full, Bad };
const char* netWhyText(NetWhy w);        // plain words for the screen and the page
struct NetResp { int code; const char* type; const char* body; const char* cookie; };  // body: a static buffer, valid until the next call

struct NetCtl {
  NetConfig cfg;
  NetGuard guard;
  NetPhase phase = NetPhase::Off;
  NetWhy why = NetWhy::None;
  bool joinPage = false;        // hotspot opened to add a network (the screen says so)
  bool fromPhone = false;       // the join in flight was typed on the phone (save it on success, keep the page informed)
  char apSsid[24] = "", apPass[16] = "";
  char ssid[SSID_MAX + 1] = ""; // the network being joined, or joined
  char ip[16] = "";
  int target = -1;              // saved network being joined (-1 = one typed on the phone)
  uint32_t lastReq = 0;         // when a web request last came in (the idle sleep counts it as activity)
  uint32_t joinAt = 0, dropApAt = 0;
  bool apUp = false;

  void load() { netLoad(cfg); }
  bool startHotspot(bool forJoin);
  bool startWifi(int savedIndex);       // join a saved network, no hotspot
  void retry();                         // start the same thing again after a failure
  void stop();                          // everything off, secrets wiped
  void tick();                          // call every 250 ms while the screen is up
  int clients() const { return phase == NetPhase::Off ? 0 : hal::wifiClients(); }
  bool lan() const { return phase == NetPhase::Wifi && !apUp; }

  // web API (hal_x4.cpp turns each into a route; the host test calls them directly)
  Verdict gate(Route r, bool lanClient, uint32_t cip, const char* token);
  NetResp info(bool lanClient, uint32_t cip, const char* token);
  NetResp unlock(bool lanClient, uint32_t cip, const char* pin);
  NetResp scan(bool lanClient, uint32_t cip, const char* token);
  NetResp join(bool lanClient, uint32_t cip, const char* token, const char* ssid, const char* pass);   // pass "" and a saved ssid = use the saved password
  NetResp forget(bool lanClient, uint32_t cip, const char* token, const char* ssid);
  NetResp rename(bool lanClient, uint32_t cip, const char* token, const char* name);
  NetResp denied(Verdict v);
 private:
  void begin(NetPhase p);
  void fail(NetWhy w);
  void up();
  bool beginJoin(const char* ssid, const char* pass, bool phone, int idx);
  char pend[PASS_MAX + 1] = "";   // the password for the join in flight; wiped when it ends
};
extern NetCtl NC;
